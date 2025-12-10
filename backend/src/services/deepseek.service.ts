import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

import { ANALYSIS_SCHEMA_DESCRIPTION } from '../constants/analysisSchema';
import { parseModelJson } from '../utils/jsonParser';

// DeepSeek 服务同样依赖环境变量,确保 .env 已被读取
dotenv.config();

// 使用 OpenAI SDK 连接 DeepSeek API
// 注意：OpenAI SDK 会自动查找 OPENAI_API_KEY，所以我们延迟初始化
let openaiClient: OpenAI | null = null;

const DEEPSEEK_MODEL = 'deepseek-chat';

const getOpenAIClient = () => {
  if (!openaiClient) {
    const apiKey = process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      throw new Error('DEEPSEEK_API_KEY 环境变量未设置。请在 .env 文件中配置 API Key。');
    }

    openaiClient = new OpenAI({
      apiKey: apiKey,
      baseURL: process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com'
    });
  }

  return openaiClient;
};

interface AnalysisResult {
  trend: 'bullish' | 'bearish' | 'neutral';
  confidence: number;
  keyLevels: {
    support: number[];
    resistance: number[];
  };
  indicators: {
    rsi?: number;
    macd?: string;
    volume?: string;
    movingAverages?: string;
  };
  analysis: string;
  recommendation: string;
  riskLevel: 'low' | 'medium' | 'high';
  timeframe?: string;
}

export const analyzeChartImage = async (
  imagePath: string,
  symbol: string,
  providedBase64?: string
): Promise<AnalysisResult> => {
  try {
    // 获取 OpenAI 客户端实例
    const openai = getOpenAIClient();

    let base64Data = providedBase64 || '';
    let mimeType = 'image/jpeg';

    if (base64Data) {
      const match = base64Data.match(/^data:(.+?);base64,(.+)$/);
      if (match) {
        mimeType = match[1];
      } else if (base64Data.startsWith('data:')) {
        mimeType = base64Data.split(';')[0]?.replace('data:', '') || mimeType;
      } else {
        base64Data = `data:${mimeType};base64,${base64Data}`;
      }
    } else {
      // 读取图片文件并转换为base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const ext = path.extname(imagePath).toLowerCase();

      // 确定MIME类型
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';

      base64Data = `data:${mimeType};base64,${base64Image}`;
    }

    // 构建分析提示词
    const prompt = `角色: 资深加密货币技术分析师。
任务: 分析 ${symbol} 的K线图(如下 Base64)，结合价格行为、指标与量能给出专业判断，并严格按照下述 JSON 模板输出纯文本：

{
  "trend": "bullish/bearish/neutral",
  "confidence": 0-100,
  "keyLevels": {
    "support": [数字, ...],
    "resistance": [数字, ...]
  },
  "indicators": {
    "rsi": "数值或描述",
    "macd": "多空状态",
    "volume": "放量/缩量等",
    "movingAverages": "均线结构描述"
  },
  "analysis": "<=200字，综述趋势、形态、指标与风险",
  "recommendation": "必须包含入场思路、止损价、止盈目标和仓位管理(如轻仓/分批/仓位上限)的完整中文句子",
  "riskLevel": "low/medium/high",
  "timeframe": "如1h/4h/1d，不确定则填空串"
}

要求:
1. 仅输出 JSON，不要 Markdown 或额外文字。
2. 价格按支撑/阻力由近到远排序，可带小数。
3. 当图形噪声大或信号不足时，需要说明不确定性，并降低 confidence。
4. recommendation 至少写 3 句，明确写出止损、止盈以及仓位管理建议。`

    const userContent = `这是一张${symbol}的K线图，图像使用Base64编码如下：${base64Data}` +
      '\n\n' + prompt;


    // 调用 DeepSeek API（文本模式，包含 Base64 图像数据）
    const response = await openai.chat.completions.create({
      model: DEEPSEEK_MODEL,  // DeepSeek 的聊天模型
      messages: [
        {
          role: 'user',
          content: userContent
        }
      ],
      temperature: 0.3,
      max_tokens: 2048
    });

    // 解析响应
    const responseText = response.choices[0]?.message?.content || '';
    const result = await parseModelJson<AnalysisResult>({
      rawText: responseText,
      client: openai,
      model: DEEPSEEK_MODEL,
      schemaDescription: ANALYSIS_SCHEMA_DESCRIPTION,
      loggerPrefix: 'DeepSeek'
    });

    // 验证和标准化数据
    if (!['bullish', 'bearish', 'neutral'].includes(result.trend)) {
      result.trend = 'neutral';
    }

    if (!['low', 'medium', 'high'].includes(result.riskLevel)) {
      result.riskLevel = 'medium';
    }

    result.confidence = Math.min(100, Math.max(0, result.confidence || 0));

    return result;

  } catch (error: any) {
    console.error('DeepSeek API分析失败:', error);

    // 如果是API错误，记录详细信息
    if (error.response) {
      console.error('API响应错误:', error.response.data);
    }

    // 返回默认结果
    return {
      trend: 'neutral',
      confidence: 0,
      keyLevels: {
        support: [],
        resistance: []
      },
      indicators: {},
      analysis: '图像分析失败，请稍后重试或上传更清晰的图片。错误信息：' + (error.message || '未知错误'),
      recommendation: '由于分析失败，暂无操作建议。',
      riskLevel: 'high'
    };
  }
};
