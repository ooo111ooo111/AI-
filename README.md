# AI 加密货币走势分析系统

基于 Claude AI 的加密货币图表智能分析系统，用户上传 K 线图或走势图，AI 自动识别技术指标并预测趋势。

## 项目概览

### 核心功能
- 📸 **图片上传**：支持拖拽或点击上传 K 线图（JPG/PNG/WEBP）
- 🤖 **AI 分析**：DeepSeek 图像识别和技术分析
- 📊 **趋势预测**：看涨/看跌/中性，附带置信度评分
- 📈 **技术指标**：自动识别 RSI、MACD、成交量、均线等
- 💾 **历史记录**：保存分析结果，支持查询和统计

### 技术栈

**后端**
- Node.js + Express + TypeScript
- MongoDB + Mongoose
- DeepSeek API
- Multer（文件上传）

**前端**
- React 19 + TypeScript
- Vite
- Tailwind CSS
- React Router
- Axios

## 快速开始

### 前置要求
- Node.js >= 18
- MongoDB
- DeepSeek API Key（从 https://platform.deepseek.com/ 获取）

### 1. 克隆项目

```bash
git clone <repository-url>
cd AI交易分析
```

### 2. 后端配置

```bash
cd backend
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入 DeepSeek API Key 和 MongoDB URI

# 启动后端
npm run dev
```

后端默认运行在 http://localhost:3000

### 3. 前端配置

```bash
cd frontend
npm install

# 配置环境变量（可选）
echo "VITE_API_URL=http://localhost:3000/api" > .env

# 启动前端
npm run dev
```

前端默认运行在 http://localhost:5173

### 4. 访问应用

打开浏览器访问 http://localhost:5173

## 项目结构

```
AI交易分析/
├── backend/                 # 后端服务
│   ├── src/
│   │   ├── models/          # 数据模型
│   │   ├── routes/          # API 路由
│   │   ├── controllers/     # 控制器
│   │   ├── services/        # 服务层（Claude API）
│   │   ├── middleware/      # 中间件（文件上传）
│   │   ├── config/          # 配置文件
│   │   └── server.ts        # 入口文件
│   ├── uploads/             # 上传文件存储
│   └── package.json
├── frontend/                # 前端应用
│   ├── src/
│   │   ├── components/      # React 组件
│   │   ├── pages/           # 页面
│   │   ├── services/        # API 服务
│   │   ├── types/           # TypeScript 类型
│   │   └── utils/           # 工具函数
│   └── package.json
└── README.md
```

## API 文档

### 分析接口

#### POST /api/analyses
上传图片并分析

**请求**：
- Content-Type: multipart/form-data
- Body:
  - `image`: 图片文件（必填）
  - `symbol`: 币种符号（必填，如 BTC, ETH）

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
  "analysis": "详细分析...",
  "recommendation": "操作建议...",
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

### 币种接口

#### GET /api/symbols
获取支持的币种列表

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

## 使用说明

1. **上传图片**：拖拽或点击上传 K 线图
2. **选择币种**：从网格中选择对应的加密货币
3. **开始分析**：点击"开始分析"按钮
4. **查看结果**：等待 10-30 秒，查看详细分析结果

## 功能演示

### 主页
- 拖拽上传区域
- 币种选择网格
- 实时加载状态

### 结果页
- 原图展示
- 趋势预测（看涨/看跌/中性）
- 置信度评分
- 关键价格位（支撑/阻力）
- 技术指标详情
- AI 详细分析
- 操作建议

## 开发指南

### 后端开发

```bash
cd backend
npm run dev    # 开发模式（热重载）
npm run build  # 构建
npm start      # 生产模式
```

### 前端开发

```bash
cd frontend
npm run dev      # 开发模式
npm run build    # 构建
npm run preview  # 预览构建结果
```

## 环境变量

### 后端 (.env)
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/crypto_analysis
DEEPSEEK_API_KEY=your_deepseek_api_key_here
DEEPSEEK_BASE_URL=https://api.deepseek.com
UPLOAD_DIR=uploads
NODE_ENV=development
```

### 前端 (.env)
```env
VITE_API_URL=http://localhost:3000/api
```

## 注意事项

⚠️ **免责声明**：
- 本系统提供的分析结果由 AI 生成，仅供参考，不构成投资建议
- 加密货币投资风险极高，请谨慎决策，自行承担投资风险
- AI 分析可能存在误差，请结合其他分析工具综合判断

⚙️ **技术限制**：
- 图片最大 10MB
- 分析时间通常 10-30 秒
- 需要有效的 DeepSeek API Key
- 需要 MongoDB 数据库

## 常见问题

**Q: 如何获取 DeepSeek API Key？**
A: 访问 https://platform.deepseek.com/ 注册并获取 API 密钥

**Q: 分析失败怎么办？**
A: 检查：1) API Key 是否正确 2) 图片是否清晰 3) MongoDB 是否运行 4) 网络连接

**Q: 支持哪些图片格式？**
A: JPG, PNG, WEBP，最大 10MB

**Q: 分析需要多长时间？**
A: 通常 10-30 秒，取决于图片大小和 API 响应速度

## License

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
# AI-
