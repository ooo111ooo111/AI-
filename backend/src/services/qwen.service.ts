import OpenAI from 'openai';
import fs from 'fs';
import path from 'path';

// 使用 OpenAI SDK 连接阿里云 DashScope API (Qwen3-VL-Flash)
let openaiClient: OpenAI | null = null;

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
}

export const analyzeChartImage = async (
  imagePath: string,
  symbol: string,
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

    // 构建分析提示词（优化版：包含止盈止损和仓位管理）
    const prompt = `你是一位经验丰富的加密货币量化交易分析师和风险管理专家。请仔细分析这张 ${symbol} 的K线图/走势图，并提供专业的技术分析和完整的交易策略。

请按照以下JSON格式返回分析结果（仅返回JSON，不要其他文字）：

{
  "trend": "bullish/bearish/neutral",
  "confidence": 0-100的数字,
  "keyLevels": {
    "support": [支撑位价格数组，从强到弱排序],
    "resistance": [阻力位价格数组，从强到弱排序]
  },
  "indicators": {
    "rsi": RSI数值（数字类型，如50.5；如果图表中不可见则省略此字段），
    "macd": "MACD状态：金叉/死叉/多头/空头，柱状图变化（如果不可见则写'数据不可见'）",
    "volume": "成交量分析：放量/缩量/价量配合情况（如果不可见则写'数据不可见'）",
    "movingAverages": "均线系统：多头排列/空头排列/金叉/死叉（如果不可见则写'数据不可见'）"
  },
  "analysis": "详细的技术分析（300字以内），包括：\\n1. 当前趋势判断和理由（K线形态、均线系统）\\n2. 关键价位分析（支撑阻力的强弱）\\n3. 技术指标综合判断（RSI超买超卖、MACD动能、成交量确认）\\n4. 潜在风险点和机会",
  "recommendation": "完整的操作建议（纯文本字符串），必须包含以下要点：\\n\\n【交易方向】看多/看空/观望，说明理由\\n\\n【入场策略】\\n- 建议入场价位：$具体价格（基于关键支撑/阻力）\\n- 入场时机：突破确认/回调企稳/其他条件\\n- 仓位配置：建议总资金的X%（根据风险等级：高风险10-20%，中风险20-40%，低风险40-60%）\\n- 分批建仓：可分2-3批入场，避免追高/杀跌\\n\\n【止损策略】\\n- 止损价位：$具体价格（通常设在关键支撑/阻力下方3-5%）\\n- 止损理由：跌破该位置说明分析失效\\n- 单笔最大亏损：不超过总资金的X%（通常1-3%）\\n\\n【止盈策略】\\n- 目标位1：$具体价格（首个阻力位），建议减仓30-50%\\n- 目标位2：$具体价格（次级阻力位），建议减仓30-40%\\n- 目标位3：$具体价格（终极目标），剩余仓位\\n- 移动止盈：价格上涨后，将止损位上移至成本价或盈利保护位\\n\\n【风险提示】\\n- 注意重大消息面影响\\n- 关注市场整体情绪\\n- 严格执行止损，避免侥幸心理",
  "riskLevel": "low/medium/high",
  "timeframe": "识别出的时间周期（1m/5m/15m/1h/4h/1d/1w等）"
}

重要提示：
1. recommendation 字段必须是一个格式化的纯文本字符串，使用 \\n 换行符
2. 不要将 recommendation 写成 JSON 对象或嵌套结构
3. 所有内容必须在字符串中使用中文和符号格式化

分析要求：
1. trend 只能是 bullish（看涨）、bearish（看跌）或 neutral（中性）
2. confidence 是你对趋势判断的信心程度（0-100），基于多个指标的一致性
3. keyLevels 必须提供具体价格数值，支撑和阻力位各2-3个
4. indicators 中的数据必须从图表中准确识别：
   - rsi 必须是纯数字（如 45.2），如果图表不可见则省略该字段（不要返回 null 或字符串）
   - 其他指标如不可见则写"数据不可见"
5. analysis 必须逻辑严密，多维度分析（趋势+形态+指标+成交量）
6. recommendation 必须是纯文本字符串，包含完整的交易计划：入场、止损、止盈、仓位管理
7. riskLevel 判断标准：
   - high：技术形态不明确、指标背离、成交量异常、波动率大
   - medium：技术形态较清晰、指标基本一致、成交量正常
   - low：技术形态明确、多指标共振、趋势强劲、成交量确认
8. 止损位必须基于技术位（关键支撑/阻力、均线、前高/低）
9. 止盈位必须分批设置，至少2个目标位
10. 仓位比例必须与风险等级匹配，避免过度杠杆

记住：你的分析将直接影响真实资金的交易决策，必须严谨、保守、注重风险控制！`;

    // 调用阿里云 DashScope API（Qwen3-VL-Flash）
    const response = await openai.chat.completions.create({
      model: 'qwen3-vl-flash',  // 速度快、成本低的 Qwen3-VL 模型
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

    // 提取 JSON（可能包含在代码块中）
    let jsonText = responseText.trim();
    const jsonMatch = jsonText.match(/```json\s*([\s\S]*?)\s*```/) ||
                     jsonText.match(/```\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
      jsonText = jsonMatch[1];
    }

    const result: AnalysisResult = JSON.parse(jsonText);

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
