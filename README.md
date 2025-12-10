# AI 加密货币走势分析系统

基于 Qwen3-VL-Flash 的加密货币图表智能分析系统,用户上传 K 线图或走势图,AI 自动识别技术指标并预测趋势。

## 项目概览

### 核心功能
- 📸 **图片上传**: 支持拖拽或点击上传 K 线图(JPG/PNG/WEBP)
- 🤖 **AI 分析**: Qwen3-VL-Flash 图像识别和技术分析
- 📊 **趋势预测**: 看涨/看跌/中性,附带置信度评分
- 📈 **技术指标**: 自动识别 RSI、MACD、成交量、均线等
- 💾 **历史记录**: 保存分析结果,支持查询和统计
- 🎯 **策略选择**: 支持长线和短线交易策略,针对合约交易优化
- 🔐 **邀请码权限**: 登录后必须验证邀请码才能解锁量化/实盘功能
- 🤖 **Gate 量化控制台**: 调用 Gate Futures API,查看合约&仓位并下发策略委托
- 🕹️ **行情看图面板**: 独立页面选择合约并查看 TradingView K 线
- 🛠️ **管理后台**: 指定管理员邮箱可查看所有注册用户及邀请码使用情况

### ✨ 新功能: 长短线策略

本系统现已支持针对**合约交易**的长线和短线策略选择:

- **长线策略(Long-term)**: 数周到数月,趋势跟随、均值回归、基本面驱动
  - 关键指标: 50日/200日均线、MACD、ADX、布林带
  - 代表: 海龟交易法则、均值回归策略

- **短线策略(Short-term)**: 数分钟到数天,日内交易、剥头皮、摆动交易
  - 关键指标: RSI、短期均线、K线形态、支撑阻力
  - 代表: 日内交易、高频交易、摆动交易

📖 **详细策略指南**: 查看 [STRATEGY_GUIDE.md](./STRATEGY_GUIDE.md)

### Gate 量化策略库

- **Sai Scalper Pro**: 高频动量剥头皮策略, 依赖分位阈值捕捉极端波动
- **均值回归 (Mean Reversion)**: 适合震荡行情, 以 Z-Score 判断回归空间
- **单均线趋势 (SMA Trend)**: 以单条简单移动均线跟随趋势, 价格相对均线的百分比偏离即为触发条件
- **RSI 摆动 (RSI Swing)**: 依据 RSI 超买超卖区域捕捉反转, 默认 30/70 阈值, 适合震荡区间短线
- **UT Bot Alerts**: ATR 追踪止损的趋势策略, 支持 Heikin Ashi 平滑源 

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
# 编辑 .env，填入 DeepSeek API Key、MongoDB URI、默认邀请码等
# 示例：
# DEEPSEEK_API_KEY=sk-xxx
# MONGODB_URI=mongodb://localhost:27017/crypto_analysis
# DEFAULT_INVITE_CODE=VIP888
# GATE_API_BASE_URL=https://api.gateio.ws/api/v4
# FRONTEND_URL=http://localhost:5173
# GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
# GOOGLE_CLIENT_SECRET=xxx
# GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
# QQ_APP_ID=xxxxxxx
# QQ_APP_KEY=xxxxx
# QQ_CALLBACK_URL=http://localhost:3000/api/auth/qq/callback
# ADMIN_EMAILS=admin@example.com

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

> ⚠️ 量化接口需要登录 + 邀请码验证,未授权用户仅可访问分析/币种接口。

### 分析接口

#### POST /api/analyses
上传图片并分析

**请求**:
- Content-Type: multipart/form-data
- Body:
  - `image`: 图片文件(必填)
  - `symbol`: 币种符号(必填,如 BTC, ETH)
  - `strategyType`: 策略类型(可选,默认 `short-term`)
    - `long-term`: 长线策略
    - `short-term`: 短线策略

**响应**:
```json
{
  "_id": "...",
  "symbol": "BTC",
  "imageUrl": "/uploads/xxx.png",
  "strategyType": "long-term",
  "trend": "bullish",
  "confidence": 85,
  "keyLevels": {
    "support": [40000, 38000],
    "resistance": [45000, 48000]
  },
  "indicators": {
    "rsi": 65,
    "macd": "多头排列",
    "volume": "成交量放大",
    "movingAverages": "50日均线上穿200日均线(金叉)"
  },
  "analysis": "详细分析...",
  "recommendation": "操作建议...",
  "riskLevel": "medium",
  "timeframe": "1d",
  "strategyDetails": {
    "name": "趋势跟随策略(海龟交易法则)",
    "description": "顺应市场长期趋势,不预测顶部和底部",
    "holdingPeriod": "数周到数月",
    "keyIndicators": ["50日均线", "200日均线", "MACD", "ADX", "布林带"]
  },
  "createdAt": "2025-12-06T10:00:00.000Z"
}
```

#### GET /api/analyses
获取分析历史列表

**查询参数**:
- `page`: 页码(默认 1)
- `limit`: 每页数量(默认 10)
- `symbol`: 筛选币种(可选)
- `strategyType`: 筛选策略类型(可选)
  - `long-term`: 仅返回长线策略分析
  - `short-term`: 仅返回短线策略分析

#### GET /api/analyses/:id
获取单条分析详情

#### DELETE /api/analyses/:id
删除分析记录

#### GET /api/analyses/stats
获取统计数据

#### GET /api/analyses/quota/daily
返回当前登录用户的 AI 分析额度。如果未填写邀请码则 `limit=10`，超过后接口会返回 `remaining=0`，需要先验证邀请码才能继续使用。

### 币种接口

#### GET /api/symbols
获取支持的币种列表

### 邀请码接口

#### GET /api/invitations/status
查看当前账户的邀请码使用情况,返回 `hasAccess`、`invitationCode`、`grantedAt` 以及邀请码备注/剩余次数。

#### POST /api/invitations/redeem
提交 `{ "code": "XXXX" }` 以验证邀请码。若开启 `DEFAULT_INVITE_CODE`, 没有预置数据时会自动创建该邀请码记录。

### Gate 量化接口

#### GET /api/quant/status
返回量化权限状态及 Gate 凭证是否已连接。

#### POST /api/quant/gate/credentials
保存 Gate API Key/Secret/Passphrase。建议使用只读或独立子账号。

#### DELETE /api/quant/gate/credentials
删除已保存的 Gate 凭证,立即阻断私有接口访问。

#### GET /api/quant/gate/contracts?settle=usdt&contract=BTC_USDT
根据结算货币和合约标识查询单个 Gate 合约详情(标记价、资金费率、乘数等)。行情看图页面和下单前的校验都依赖此接口。

#### GET /api/quant/gate/account?settle=usdt
返回账户权益、维持保证金率、持仓保证金等核心资产字段(需 Gate 凭证)。

#### GET /api/quant/gate/positions?settle=usdt
返回当前全部仓位,包含合约、数量、杠杆、标记价、盈亏等信息。

#### POST /api/quant/gate/orders
向 Gate Futures 发起委托。请求体示例:

```json
{
  "settle": "usdt",
  "contract": "BTC_USDT",
  "size": "1",
  "price": 65000,
  "tif": "gtc",
  "reduceOnly": false,
  "close": false,
  "stpAct": "cn"
}
```

> ⚠️ Gate API Key 必须已开启期货读写权限。强烈建议为本系统创建独立子账号,并启用 IP 白名单。

### 管理接口

#### GET /api/admin/users
需要管理员身份(通过 `ADMIN_EMAILS` 设置)。返回所有注册用户及其邮箱、登录方式、邀请码激活状态、创建/最近登录时间。

#### GET /api/admin/invitations
支持分页查询邀请码列表,可使用 `code`(模糊匹配) 和 `status=active|inactive` 过滤。

#### DELETE /api/admin/invitations/:id
删除单个邀请码。

#### GET /api/admin/invitations/export
根据当前筛选条件导出 CSV/Excel 文件。

#### POST /api/admin/invitations/generate
管理员批量生成邀请码。请求体支持 `prefix`、`count`(1-50)、`length`(4-16)、`maxRedemptions`、`expiresAt`、`description` 等字段，响应返回新生成的邀请码数组。

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
# AI-
