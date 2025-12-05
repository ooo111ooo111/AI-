import { Request, Response } from 'express';
import Analysis from '../models/Analysis';
import { analyzeChartImage } from '../services/qwen.service';
import path from 'path';

// 创建分析（上传图片并分析）
export const createAnalysis = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: '请上传图片文件' });
    }

    const { symbol } = req.body;

    if (!symbol) {
      return res.status(400).json({ message: '请选择币种' });
    }

    const imagePath = req.file.path;
    const imageUrl = `/uploads/${req.file.filename}`;

    // 调用 Qwen3-VL-Flash 分析图片
    const analysisResult = await analyzeChartImage(
      imagePath,
      symbol.toUpperCase(),
      req.body.imageBase64
    );

    // 保存到数据库
    const analysis = new Analysis({
      symbol: symbol.toUpperCase(),
      imagePath,
      imageUrl,
      ...analysisResult
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

// 获取分析列表
export const getAnalyses = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const symbol = req.query.symbol as string;
    const skip = (page - 1) * limit;

    const query: any = {};
    if (symbol) {
      query.symbol = symbol.toUpperCase();
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

    // 可选：删除关联的图片文件
    // fs.unlinkSync(analysis.imagePath);

    res.json({ message: '删除成功' });

  } catch (error) {
    console.error('删除分析失败:', error);
    res.status(500).json({ message: '删除分析失败' });
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
