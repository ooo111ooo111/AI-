import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

import { ANALYSIS_SCHEMA_DESCRIPTION } from '../constants/analysisSchema';
import { parseModelJson } from '../utils/jsonParser';

// 由于本服务需要依赖 API Key,确保优先加载 .env
dotenv.config();

// 使用 OpenAI SDK 连接阿里云 DashScope API (Qwen3-VL-Flash)
let openaiClient: OpenAI | null = null;
const QWEN_MODEL = 'qwen3-vl-flash';

const getOpenAIClient = () => {
  if (!openaiClient) {
    const apiKey = process.env.DASHSCOPE_API_KEY;

    if (!apiKey) {
      throw new Error('DASHSCOPE_API_KEY 环境变量未设置。请在 .env 文件中配置 API Key。');
    }

    openaiClient = new OpenAI({
      apiKey: apiKey,
      // 北京地域 base_url（新加坡地域请使用：https://dashscope-intl.aliyuncs.com/compatible-mode/v1）
      baseURL: process.env.DASHSCOPE_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1'
    });
  }

  return openaiClient;
};

// 辅助函数：将对象形式的 recommendation 转换为格式化字符串
function formatRecommendationObject(obj: any): string {
  try {
    let formatted = '';

    // 交易方向
    if (obj['交易方向'] || obj.direction) {
      formatted += `【交易方向】${obj['交易方向'] || obj.direction}\n\n`;
    }

    // 入场策略
    if (obj['入场策略'] || obj.entry) {
      const entry = obj['入场策略'] || obj.entry;
      formatted += `【入场策略】\n`;
      if (typeof entry === 'object') {
        if (entry['建议入场价位']) formatted += `- 建议入场价位：$${entry['建议入场价位']}\n`;
        if (entry['入场时机']) formatted += `- 入场时机：${entry['入场时机']}\n`;
        if (entry['仓位配置']) formatted += `- 仓位配置：${entry['仓位配置']}%\n`;
        if (entry['分批建仓']) {
          formatted += `- 分批建仓：\n`;
          if (Array.isArray(entry['分批建仓'])) {
            entry['分批建仓'].forEach((batch: string) => {
              formatted += `  ${batch}\n`;
            });
          }
        }
      } else {
        formatted += `${entry}\n`;
      }
      formatted += '\n';
    }

    // 止损策略
    if (obj['止损策略'] || obj.stopLoss) {
      const stopLoss = obj['止损策略'] || obj.stopLoss;
      formatted += `【止损策略】\n`;
      if (typeof stopLoss === 'object') {
        if (stopLoss['止损价位']) formatted += `- 止损价位：$${stopLoss['止损价位']}\n`;
        if (stopLoss['止损理由']) formatted += `- 止损理由：${stopLoss['止损理由']}\n`;
        if (stopLoss['单笔最大亏损']) formatted += `- 单笔最大亏损：${stopLoss['单笔最大亏损']}%\n`;
      } else {
        formatted += `${stopLoss}\n`;
      }
      formatted += '\n';
    }

    // 止盈策略
    if (obj['止盈策略'] || obj.takeProfit) {
      const takeProfit = obj['止盈策略'] || obj.takeProfit;
      formatted += `【止盈策略】\n`;
      if (typeof takeProfit === 'object') {
        if (takeProfit['目标位1']) formatted += `- 目标位1：$${takeProfit['目标位1']}`;
        if (takeProfit['减仓比例']) formatted += `，减仓${takeProfit['减仓比例']}%\n`;
        else formatted += '\n';

        if (takeProfit['目标位2']) formatted += `- 目标位2：$${takeProfit['目标位2']}\n`;
        if (takeProfit['目标位3']) formatted += `- 目标位3：$${takeProfit['目标位3']}`;
        if (takeProfit['剩余仓位']) formatted += `，剩余${takeProfit['剩余仓位']}%\n`;
        else formatted += '\n';

        if (takeProfit['移动止盈']) formatted += `- 移动止盈：${takeProfit['移动止盈']}\n`;
      } else {
        formatted += `${takeProfit}\n`;
      }
      formatted += '\n';
    }

    // 风险提示
    if (obj['风险提示'] || obj.riskWarning) {
      formatted += `【风险提示】\n${obj['风险提示'] || obj.riskWarning}\n`;
    }

    return formatted || JSON.stringify(obj, null, 2);
  } catch (error) {
    console.error('格式化 recommendation 失败:', error);
    return JSON.stringify(obj, null, 2);
  }
}

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
  strategyDetails?: {
    name: string;
    description: string;
    holdingPeriod: string;
    keyIndicators: string[];
  };
}

// 获取长线策略的分析提示词
function getLongTermPrompt(symbol: string): string {
  return `你是一位经验丰富的加密货币量化交易分析师,专注于长线交易策略(持仓周期:数周到数月)。请仔细分析这张 ${symbol} 的K线图/走势图。

【长线交易策略要点】
- 趋势跟随策略(海龟交易法则):顺应市场长期趋势,不预测顶部和底部
- 均值回归策略:价格长期会回到均值
- 基本面驱动:结合宏观经济、供需关系、政策等

【长线关键指标】
- 50日/200日均线系统(金叉/死叉)
- MACD长期趋势
- ADX趋势强度
- 布林带长期通道
- 成交量长期趋势

请按照以下JSON格式返回分析结果(仅返回JSON,不要其他文字):

{
  "trend": "bullish/bearish/neutral",
  "confidence": 0-100的数字,
  "keyLevels": {
    "support": [长期支撑位价格数组,从强到弱],
    "resistance": [长期阻力位价格数组,从强到弱]
  },
  "indicators": {
    "rsi": RSI数值(如50.5,图表不可见则省略),
    "macd": "MACD长期趋势:金叉/死叉/多头/空头",
    "volume": "成交量长期趋势分析",
    "movingAverages": "50日/200日均线系统:多头排列/空头排列/金叉/死叉"
  },
  "analysis": "详细的长线技术分析(400字以内),包括:\\n1. 长期趋势判断(周线/月线形态)\\n2. 主要趋势是否延续,是否接近趋势反转点\\n3. 50日/200日均线系统分析\\n4. 长期支撑阻力的历史有效性\\n5. 基本面因素(市场情绪、政策、供需等)",
  "recommendation": "长线操作建议(纯文本字符串),包含:\\n\\n【交易策略】趋势跟随/均值回归/基本面驱动\\n\\n【交易方向】看多/看空/观望,说明理由\\n\\n【入场策略】\\n- 建议入场价位:$具体价格(基于长期支撑/突破确认)\\n- 入场时机:突破200日均线/回踩50日均线企稳/其他条件\\n- 仓位配置:长线建议总资金的30-60%(风险中低的长期持仓)\\n- 分批建仓:建议分3-5批入场,降低波动风险\\n\\n【止损策略】\\n- 止损价位:$具体价格(通常设在50日或200日均线下方5-10%)\\n- 止损理由:跌破该位置说明长期趋势已破坏\\n- 单笔最大亏损:不超过总资金的5-8%\\n\\n【止盈策略】\\n- 目标位1:$具体价格(第一个长期阻力位),减仓20-30%\\n- 目标位2:$具体价格(次级阻力位),减仓30-40%\\n- 目标位3:$具体价格(终极目标),剩余仓位\\n- 长期持有:若趋势延续,可持有数周到数月,移动止损保护利润\\n\\n【风险提示】\\n- 长线交易需耐心,避免短期波动影响判断\\n- 关注宏观经济、政策、供需等基本面变化\\n- 定期复盘,趋势破坏时果断止损",
  "riskLevel": "low/medium/high",
  "timeframe": "识别的长期时间周期(4h/1d/1w等)",
  "strategyDetails": {
    "name": "具体策略名称(如:趋势跟随策略(海龟交易法则))",
    "description": "策略简要说明",
    "holdingPeriod": "数周到数月",
    "keyIndicators": ["50日均线", "200日均线", "MACD", "ADX", "布林带"]
  }
}

分析要求:
1. 专注长期趋势,忽略短期波动
2. 支撑阻力位必须是历史上多次验证的长期关键位
3. 止损止盈策略要留足空间,避免被短期波动扫损
4. 仓位管理要稳健,强调分批建仓和长期持有
5. recommendation必须是纯文本字符串,使用\\n换行
6. 突出长线交易的耐心和纪律性`;
}

// 获取短线策略的分析提示词
function getShortTermPrompt(symbol: string): string {
  return `你是一位经验丰富的加密货币量化交易分析师,专注于短线交易策略(持仓周期:数分钟到数天)。请仔细分析这张 ${symbol} 的K线图/走势图。

【短线交易策略要点】
- 日内交易:利用价格短期波动,严格止损止盈
- 高频剥头皮:捕捉超短期微小波动
- 摆动交易:抓取几天内的波段

【短线关键指标】
- RSI超买超卖(>70超买,<30超卖)
- 短期均线(5日/10日/20日)
- K线形态(锤子线、十字星、吞没等)
- 支撑阻力位(日内关键价位)
- 成交量短期放量/缩量

请按照以下JSON格式返回分析结果(仅返回JSON,不要其他文字):

{
  "trend": "bullish/bearish/neutral",
  "confidence": 0-100的数字,
  "keyLevels": {
    "support": [短期支撑位价格数组,从强到弱],
    "resistance": [短期阻力位价格数组,从强到弱]
  },
  "indicators": {
    "rsi": RSI数值(如50.5,图表不可见则省略),
    "macd": "MACD短期信号:金叉/死叉/多头/空头",
    "volume": "成交量短期变化:放量/缩量/价量背离",
    "movingAverages": "短期均线:5日/10日/20日金叉/死叉"
  },
  "analysis": "详细的短线技术分析(300字以内),包括:\\n1. 短期趋势判断(日线/4小时形态)\\n2. 日内关键K线形态(锤子线、吞没、十字星等)\\n3. RSI超买超卖信号\\n4. 短期支撑阻力的有效性\\n5. 成交量确认(放量突破/缩量回调)",
  "recommendation": "短线操作建议(纯文本字符串),包含:\\n\\n【交易策略】日内交易/剥头皮/摆动交易\\n\\n【交易方向】看多/看空/观望,说明理由\\n\\n【入场策略】\\n- 建议入场价位:$具体价格(基于短期支撑/突破确认)\\n- 入场时机:突破阻力/回踩支撑/K线反转信号\\n- 仓位配置:短线建议总资金的10-30%(高风险20%以内,中风险30%以内)\\n- 快速入场:短线讲究时效,信号出现后迅速执行\\n\\n【止损策略】\\n- 止损价位:$具体价格(通常设在入场价下方2-5%)\\n- 止损理由:跌破该位置说明短期信号失效\\n- 单笔最大亏损:不超过总资金的1-3%\\n\\n【止盈策略】\\n- 目标位1:$具体价格(第一个短期阻力位),减仓50%\\n- 目标位2:$具体价格(次级阻力位),剩余仓位止盈\\n- 快速止盈:短线以快进快出为主,达到目标迅速离场\\n- 移动止损:价格有利时,快速上移止损至成本价保护利润\\n\\n【风险提示】\\n- 短线交易需盯盘,及时止损止盈\\n- 避免贪婪,达到目标果断离场\\n- 严格控制单笔亏损,连续亏损时暂停交易\\n- 关注突发消息和市场情绪波动",
  "riskLevel": "low/medium/high",
  "timeframe": "识别的短期时间周期(1m/5m/15m/1h/4h等)",
  "strategyDetails": {
    "name": "具体策略名称(如:日内交易策略)",
    "description": "策略简要说明",
    "holdingPeriod": "数分钟到数天",
    "keyIndicators": ["RSI", "5日均线", "10日均线", "K线形态", "支撑阻力"]
  }
}

分析要求:
1. 专注短期机会,关注日内/4小时/日线级别
2. 支撑阻力位必须是近期有效的短期关键位
3. 止损止盈要精准,避免扫损但也要快速离场
4. 仓位管理要灵活,强调快进快出
5. recommendation必须是纯文本字符串,使用\\n换行
6. 突出短线交易的时效性和纪律性`;
}

export const analyzeChartImage = async (
  imagePath: string,
  symbol: string,
  strategyType: 'long-term' | 'short-term' = 'short-term',
  providedBase64?: string
): Promise<AnalysisResult> => {
  try {
    // 获取 OpenAI 客户端实例
    const openai = getOpenAIClient();

    let imageUrl = '';

    if (providedBase64) {
      // 使用提供的 Base64 数据
      const match = providedBase64.match(/^data:(.+?);base64,(.+)$/);
      if (match) {
        imageUrl = providedBase64;
      } else if (providedBase64.startsWith('data:')) {
        imageUrl = providedBase64;
      } else {
        // 补全 data URL 前缀
        imageUrl = `data:image/jpeg;base64,${providedBase64}`;
      }
    } else {
      // 读取图片文件并转换为 Base64
      const imageBuffer = fs.readFileSync(imagePath);
      const base64Image = imageBuffer.toString('base64');
      const ext = path.extname(imagePath).toLowerCase();

      // 确定 MIME 类型
      let mimeType = 'image/jpeg';
      if (ext === '.png') mimeType = 'image/png';
      else if (ext === '.webp') mimeType = 'image/webp';

      imageUrl = `data:${mimeType};base64,${base64Image}`;
    }

    // 构建分析提示词(根据策略类型选择)
    const prompt = strategyType === 'long-term'
      ? getLongTermPrompt(symbol)
      : getShortTermPrompt(symbol);

    // 调用阿里云 DashScope API（Qwen3-VL-Flash）
    const response = await openai.chat.completions.create({
      model: QWEN_MODEL,  // 速度快、成本低的 Qwen3-VL 模型
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: imageUrl }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      temperature: 0.3,
      max_tokens: 3096  // 增加 token 限制以容纳更详细的分析和交易建议
      // 可选：启用思考模式（需要额外 token）
      // enable_thinking: true,
      // thinking_budget: 81920
    });

    // 解析响应
    const responseText = response.choices[0]?.message?.content || '';
    const result = await parseModelJson<AnalysisResult>({
      rawText: responseText,
      client: openai,
      model: QWEN_MODEL,
      schemaDescription: ANALYSIS_SCHEMA_DESCRIPTION,
      loggerPrefix: 'Qwen3-VL'
    });

    // 验证和标准化数据
    if (!['bullish', 'bearish', 'neutral'].includes(result.trend)) {
      result.trend = 'neutral';
    }

    if (!['low', 'medium', 'high'].includes(result.riskLevel)) {
      result.riskLevel = 'medium';
    }

    result.confidence = Math.min(100, Math.max(0, result.confidence || 0));

    // 修复：如果 recommendation 是对象，转换为格式化字符串
    if (typeof result.recommendation === 'object' && result.recommendation !== null) {
      console.warn('⚠️ recommendation 是对象，正在转换为字符串...');
      result.recommendation = formatRecommendationObject(result.recommendation);
    }

    // 确保 recommendation 是字符串
    if (typeof result.recommendation !== 'string') {
      console.warn('⚠️ recommendation 类型异常，使用默认值');
      result.recommendation = '由于数据格式问题，无法生成完整的操作建议。请稍后重试。';
    }

    // 修复：清洗 indicators 数据，移除无效的 rsi 值
    if (result.indicators) {
      // 处理 rsi：必须是有效数字，否则设为 undefined
      if (result.indicators.rsi !== undefined) {
        const rsiValue = Number(result.indicators.rsi);
        if (isNaN(rsiValue) || typeof result.indicators.rsi === 'string') {
          console.warn(`⚠️ indicators.rsi 包含无效值 "${result.indicators.rsi}"，已移除`);
          result.indicators.rsi = undefined;
        }
      }

      // 确保其他指标字段是字符串类型（如果存在）
      if (result.indicators.macd !== undefined && typeof result.indicators.macd !== 'string') {
        result.indicators.macd = String(result.indicators.macd);
      }
      if (result.indicators.volume !== undefined && typeof result.indicators.volume !== 'string') {
        result.indicators.volume = String(result.indicators.volume);
      }
      if (result.indicators.movingAverages !== undefined && typeof result.indicators.movingAverages !== 'string') {
        result.indicators.movingAverages = String(result.indicators.movingAverages);
      }
    }

    return result;

  } catch (error: any) {
    console.error('Qwen3-VL-Flash API 分析失败:', error);

    // 如果是 API 错误，记录详细信息
    if (error.response) {
      console.error('API 响应错误:', error.response.data);
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
