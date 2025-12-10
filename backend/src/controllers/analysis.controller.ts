import { Request, Response } from 'express';
import Analysis from '../models/Analysis';
import { analyzeChartImage } from '../services/qwen.service';
import { uploadFile, deleteFile } from '../services/oss.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import User from '../models/User';

// 创建分析(上传图片并分析)
const DAILY_LIMIT = Number(process.env.ANALYSIS_DAILY_LIMIT) || 10;

const getTodayRange = () => {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

const getDailyUsage = async (userId: string) => {
  const { start, end } = getTodayRange();
  const used = await Analysis.countDocuments({
    'meta.ownerId': userId,
    createdAt: { $gte: start, $lte: end }
  });
  return used;
};

export const createAnalysis = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请上传图片文件' });
    }

    const { symbol, strategyType } = req.body;

    if (!symbol) {
      return res.status(400).json({ message: '请选择币种' });
    }

    // 验证策略类型
    const validStrategyTypes = ['long-term', 'short-term'];
    const selectedStrategyType = strategyType && validStrategyTypes.includes(strategyType)
      ? strategyType
      : 'short-term';

    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ message: '登录状态已失效，请重新登录' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (!user.quantAccess?.hasAccess) {
      const used = await getDailyUsage(userId);
      if (used >= DAILY_LIMIT) {
        return res.status(429).json({ message: '今日免费次数已用完，填写邀请码可解锁无限分析' });
      }
    }

    const imagePath = req.file.path;

    // 上传到OSS或本地存储
    const imageUrl = await uploadFile(imagePath, req.file.filename);

    // 调用 Qwen3-VL-Flash 分析图片,传入策略类型
    const analysisResult = await analyzeChartImage(
      imagePath,
      symbol.toUpperCase(),
      selectedStrategyType,
      req.body.imageBase64
    );

    // 保存到数据库
    const analysis = new Analysis({
      symbol: symbol.toUpperCase(),
      imagePath,
      imageUrl,
      strategyType: selectedStrategyType,
      ...analysisResult,
      meta: {
        ownerId: userId,
      }
    });

    await analysis.save();

    res.status(201).json(analysis);

  } catch (error: any) {
    console.error('创建分析失败:', error);
    res.status(500).json({
      message: '分析失败',
      error: error.message
    });
  }
};

export const getDailyQuota = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: '未登录' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const hasAccess = Boolean(user.quantAccess?.hasAccess);
    const used = await getDailyUsage(userId);
    const limit = hasAccess ? null : DAILY_LIMIT;
    res.json({
      hasAccess,
      used,
      limit,
      remaining: hasAccess ? null : Math.max(DAILY_LIMIT - used, 0)
    });
  } catch (error) {
    console.error('获取配额失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

// 获取分析列表
export const getAnalyses = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const symbol = req.query.symbol as string;
    const strategyType = req.query.strategyType as string;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (symbol) {
      query.symbol = symbol.toUpperCase();
    }
    if (strategyType && ['long-term', 'short-term'].includes(strategyType)) {
      query.strategyType = strategyType;
    }

    const analyses = await Analysis.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Analysis.countDocuments(query);

    res.json({
      analyses,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('获取分析列表失败:', error);
    res.status(500).json({ message: '获取分析列表失败' });
  }
};

// 获取单个分析
export const getAnalysisById = async (req: Request, res: Response) => {
  try {
    const analysis = await Analysis.findById(req.params.id);

    if (!analysis) {
      return res.status(404).json({ message: '分析记录不存在' });
    }

    res.json(analysis);

  } catch (error) {
    console.error('获取分析详情失败:', error);
    res.status(500).json({ message: '获取分析详情失败' });
  }
};

// 删除分析
export const deleteAnalysis = async (req: Request, res: Response) => {
  try {
    const analysis = await Analysis.findByIdAndDelete(req.params.id);

    if (!analysis) {
      return res.status(404).json({ message: '分析记录不存在' });
    }

    // 删除关联的图片文件(OSS或本地)
    try {
      await deleteFile(analysis.imageUrl);
    } catch (error) {
      console.warn('删除图片文件失败:', error);
      // 继续执行,不影响数据库记录删除
    }

    res.json({ message: '删除成功' });

  } catch (error) {
    console.error('删除分析失败:', error);
    res.status(500).json({ message: '删除分析失败' });
  }
};

export const getUserSymbols = async (req: Request, res: Response) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user?.userId;
    if (!userId) {
      return res.status(401).json({ message: '未登录' });
    }

    const symbols = await Analysis.distinct('symbol', { 'meta.ownerId': userId });
    const formatted = symbols
      .filter(Boolean)
      .map((symbol) => String(symbol).toUpperCase())
      .sort();

    res.json({ symbols: formatted });
  } catch (error) {
    console.error('获取用户币种失败:', error);
    res.status(500).json({ message: '获取币种列表失败' });
  }
};

// 获取统计数据
export const getStats = async (req: Request, res: Response) => {
  try {
    const totalAnalyses = await Analysis.countDocuments();

    const trendStats = await Analysis.aggregate([
      {
        $group: {
          _id: '$trend',
          count: { $sum: 1 }
        }
      }
    ]);

    const symbolStats = await Analysis.aggregate([
      {
        $group: {
          _id: '$symbol',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    res.json({
      total: totalAnalyses,
      byTrend: trendStats,
      bySymbol: symbolStats
    });

  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({ message: '获取统计数据失败' });
  }
};
