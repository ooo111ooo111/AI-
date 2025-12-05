# Qwen3-VL-Flash 集成使用说明

## 概述

本项目已成功集成阿里云 **Qwen3-VL-Flash** 模型，用于加密货币图表的视觉分析。该模型具有速度快、成本低的优势，非常适合实时交易分析场景。

---

## 快速开始

### 1. 配置 API Key

已在 `.env` 文件中配置：
```bash
DASHSCOPE_API_KEY=sk-1923018d97f2465cb8f10250a519ac83
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

### 2. 启动服务

```bash
# 进入后端目录
cd backend

# 安装依赖（如果还未安装）
npm install

# 启动开发服务器
npm run dev
```

### 3. 测试 API

使用提供的测试脚本：

```bash
cd backend
npx tsx tests/qwen-integration.test.ts
```

---

## API 使用方式

### 上传图片并分析

**端点**: `POST /api/analyses`

**请求格式**:
```bash
curl -X POST http://localhost:3000/api/analyses \
  -F "image=@/path/to/chart.png" \
  -F "symbol=BTC"
```

**响应示例**:
```json
{
  "_id": "...",
  "symbol": "BTC",
  "imagePath": "uploads/...",
  "imageUrl": "/uploads/...",
  "trend": "bullish",
  "confidence": 85,
  "keyLevels": {
    "support": [45000, 44000],
    "resistance": [48000, 50000]
  },
  "indicators": {
    "rsi": 65,
    "macd": "金叉向上",
    "volume": "成交量放大",
    "movingAverages": "MA20 向上穿越 MA50"
  },
  "analysis": "当前 BTC 呈现明显的上涨趋势...",
  "recommendation": "建议等待回调至 45000 支撑位附近买入",
  "riskLevel": "medium",
  "timeframe": "4h",
  "createdAt": "2025-12-05T...",
  "updatedAt": "2025-12-05T..."
}
```

---

## 核心功能

### 视觉分析能力

Qwen3-VL-Flash 可以识别和分析：

1. **趋势判断**: 看涨（bullish）、看跌（bearish）、中性（neutral）
2. **技术指标**: RSI、MACD、成交量、移动平均线
3. **关键价位**: 支撑位和阻力位
4. **图表形态**: K线形态、趋势线、形态学分析
5. **风险评估**: 低、中、高风险等级
6. **时间周期**: 识别图表的时间框架（1h、4h、1d 等）

### 支持的图像格式

- JPEG (.jpg, .jpeg)
- PNG (.png)
- WebP (.webp)

**推荐**:
- 图像分辨率: 800x600 或更高
- 文件大小: < 5MB
- 图表清晰度: 高清晰度，避免模糊

---

## 集成架构

### 文件结构

```
backend/
├── src/
│   ├── services/
│   │   ├── qwen.service.ts         # Qwen3-VL-Flash 服务（新增）
│   │   └── deepseek.service.ts     # DeepSeek 服务（备用）
│   ├── controllers/
│   │   └── analysis.controller.ts  # 调用 qwen.service
│   └── models/
│       └── Analysis.ts              # 数据模型
├── tests/
│   └── qwen-integration.test.ts    # 集成测试
└── .env                             # 环境变量
```

### 服务切换

如需切换回 DeepSeek 或添加其他 AI 提供商：

1. 修改 `analysis.controller.ts` 的导入：
```typescript
// 使用 Qwen
import { analyzeChartImage } from '../services/qwen.service';

// 或使用 DeepSeek
// import { analyzeChartImage } from '../services/deepseek.service';
```

2. 更新 `.env` 中的 API Key

---

## 性能和成本

### Qwen3-VL-Flash 优势

| 指标 | Qwen3-VL-Flash | DeepSeek |
|------|----------------|----------|
| 响应速度 | ⚡ 快（2-4秒） | 🐢 较慢（5-8秒） |
| 成本 | 💰 低 | 💰💰 中等 |
| 视觉能力 | 📊 强 | 📊 强 |
| 适用场景 | 实时分析 | 深度分析 |

### 请求限制

- 阿里云 DashScope 免费额度：查看 [定价页面](https://help.aliyun.com/zh/model-studio/pricing)
- 建议添加请求缓存和限流机制（中期优化）

---

## 故障排查

### 常见问题

**1. API Key 无效**
```
错误: DASHSCOPE_API_KEY 环境变量未设置
```
**解决方案**: 检查 `.env` 文件中的 `DASHSCOPE_API_KEY` 是否正确配置。

**2. 图像分析失败**
```
analysis: "图像分析失败，请稍后重试..."
```
**可能原因**:
- 图像格式不支持
- 图像过大或过小
- 网络连接问题
- API 额度用尽

**解决方案**:
- 检查图像格式和大小
- 查看控制台错误日志
- 验证 API Key 是否有效
- 检查阿里云账户余额

**3. 响应超时**
```
Error: Request timeout
```
**解决方案**:
- 增加 `timeout` 配置（当前 60 秒）
- 检查网络连接
- 减小图像文件大小

---

## 高级配置

### 启用思考模式（可选）

Qwen3-VL 支持"思考后回复"模式，可提高分析质量（消耗更多 token）：

在 `qwen.service.ts` 中启用：
```typescript
const response = await openai.chat.completions.create({
  model: 'qwen3-vl-flash',
  messages: [...],
  temperature: 0.3,
  max_tokens: 2048,
  // 启用思考模式
  enable_thinking: true,
  thinking_budget: 81920
});
```

### 地域切换

**北京地域**（默认）:
```bash
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
```

**新加坡地域**:
```bash
DASHSCOPE_BASE_URL=https://dashscope-intl.aliyuncs.com/compatible-mode/v1
```

**注意**: 不同地域的 API Key 不同，需要重新申请。

---

## 参考资料

### 官方文档
- [视觉理解 - 阿里云百炼](https://help.aliyun.com/zh/model-studio/vision)
- [获取 API Key](https://help.aliyun.com/zh/model-studio/get-api-key)
- [API 参数参考](https://help.aliyun.com/zh/model-studio/use-qwen-by-calling-api)

### 项目文档
- `.claude/context-summary-qwen3-vl-integration.md` - 实现上下文
- `.claude/operations-log.md` - 操作日志
- `.claude/verification-report.md` - 验证报告

---

## 联系支持

- 阿里云工单: [提交工单](https://workorder.console.aliyun.com/)
- 社区论坛: [开发者社区](https://developer.aliyun.com/ask/)

---

**更新时间**: 2025-12-05
**集成版本**: v1.0
**模型**: qwen3-vl-flash
