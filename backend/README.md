# AI加密货币走势分析系统 - 后端

基于 Claude AI 的加密货币图表分析系统后端服务。

## 功能特性

- 📸 图片上传（支持 JPG, PNG, WEBP）
- 🤖 AI 图像识别与技术分析（DeepSeek）
- 📊 趋势预测（看涨/看跌/中性）
- 📈 技术指标识别（RSI, MACD, 成交量等）
- 💾 分析历史记录
- 📱 RESTful API

## 技术栈

- Node.js + TypeScript
- Express
- MongoDB + Mongoose
- DeepSeek API
- Multer (文件上传)

## 快速开始

### 安装依赖

```bash
npm install
```

### 环境配置

复制 `.env.example` 为 `.env` 并配置：

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/crypto_analysis
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
UPLOAD_DIR=uploads
NODE_ENV=development
```

**获取 DeepSeek API Key：**
访问 https://platform.deepseek.com/ 注册并获取 API 密钥

### 运行

开发模式：
```bash
npm run dev
```

构建：
```bash
npm run build
```

生产模式：
```bash
npm start
```

## API 文档

### 分析相关

#### POST /api/analyses
上传图片并分析

**请求**：
- Content-Type: multipart/form-data
- Body:
  - `image`: 图片文件（必填）
  - `symbol`: 币种符号，如 BTC, ETH（必填）

**响应**：
```json
{
  "_id": "...",
  "symbol": "BTC",
  "imageUrl": "/uploads/xxx.png",
  "trend": "bullish",
  "confidence": 85,
  "keyLevels": {
    "support": [40000, 38000],
    "resistance": [45000, 48000]
  },
  "indicators": {
    "rsi": 65,
    "macd": "多头排列",
    "volume": "成交量放大"
  },
  "analysis": "详细分析文字...",
  "recommendation": "建议在回调至40000附近分批买入",
  "riskLevel": "medium",
  "createdAt": "2025-12-05T10:00:00.000Z"
}
```

#### GET /api/analyses
获取分析历史列表

**查询参数**：
- `page`: 页码（默认 1）
- `limit`: 每页数量（默认 10）
- `symbol`: 筛选币种（可选）

#### GET /api/analyses/:id
获取单条分析详情

#### DELETE /api/analyses/:id
删除分析记录

#### GET /api/analyses/stats
获取统计数据

### 币种相关

#### GET /api/symbols
获取支持的币种列表

**响应**：
```json
{
  "symbols": [
    { "symbol": "BTC", "name": "Bitcoin", "icon": "₿" },
    { "symbol": "ETH", "name": "Ethereum", "icon": "Ξ" }
  ]
}
```

### 健康检查

#### GET /api/health
服务健康检查

## 项目结构

```
backend/
├── src/
│   ├── models/          # 数据模型
│   │   └── Analysis.ts
│   ├── routes/          # 路由
│   │   ├── analysis.routes.ts
│   │   └── symbol.routes.ts
│   ├── controllers/     # 控制器
│   │   └── analysis.controller.ts
│   ├── services/        # 服务层
│   │   └── deepseek.service.ts
│   ├── middleware/      # 中间件
│   │   └── upload.ts
│   ├── config/          # 配置
│   │   └── constants.ts
│   └── server.ts        # 入口文件
├── uploads/             # 上传文件目录
├── package.json
├── tsconfig.json
└── .env
```

## 支持的币种

- BTC (Bitcoin)
- ETH (Ethereum)
- BNB (Binance Coin)
- SOL (Solana)
- XRP (Ripple)
- ADA (Cardano)
- DOGE (Dogecoin)
- MATIC (Polygon)
- DOT (Polkadot)
- AVAX (Avalanche)

## 注意事项

⚠️ **免责声明**：
- 本系统提供的分析结果仅供参考，不构成投资建议
- 加密货币投资风险极高，请谨慎决策
- AI 分析可能存在误差，请结合其他分析工具综合判断

## License

MIT
