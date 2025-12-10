# 项目上下文摘要（OAuth 第三方登录功能）
生成时间：2025-12-06

## 1. 项目现状

### 技术栈
- **后端**: Node.js + Express + TypeScript + MongoDB
- **前端**: React 19 + TypeScript + React Router + Axios + TailwindCSS
- **现有依赖**: express, mongoose, cors, dotenv, multer, openai

### 现有架构模式
- **后端结构**:
  - 入口: `backend/src/server.ts`
  - 路由: `backend/src/routes/*.routes.ts`
  - 控制器: `backend/src/controllers/*.controller.ts`
  - 模型: `backend/src/models/*.ts` (Post, Category, Tag, Analysis)
  - 中间件: `backend/src/middleware/upload.ts`
  - 服务层: `backend/src/services/qwen.service.ts`, `deepseek.service.ts`

- **前端结构**:
  - 入口: `frontend/src/main.tsx`
  - 路由配置: `frontend/src/App.tsx`
  - 页面: `frontend/src/pages/*.tsx`
  - 组件: `frontend/src/components/*.tsx`
  - API 服务: `frontend/src/services/api.ts`

### 命名约定
- **文件命名**: kebab-case (`post.controller.ts`, `analysis.routes.ts`)
- **组件命名**: PascalCase (`UploadZone.tsx`, `LoadingSpinner.tsx`)
- **接口命名**: `I` 前缀 (`IPost`, `IAnalysis`)
- **路由前缀**: `/api/` (`/api/analyses`, `/api/symbols`)

### 现有认证状态
- ❌ 无任何用户认证系统
- ❌ 无 User 模型
- ❌ 无 auth 相关路由
- ⚠️ Post 模型的 author 字段是简单字符串，未关联用户表

## 2. OAuth 技术调研结果

### Passport.js 生态
- **核心库**: `passport` - Express 认证中间件框架
- **Google 登录**: `passport-google-oauth20` (官方推荐，2025 最新)
- **QQ 登录**: `passport-qq` (社区维护，非官方)
  - 主要实现: [qdsang/passport-qq](https://github.com/qdsang/passport-qq), [AndyShang/passport-qq](https://github.com/AndyShang/passport-qq)
  - 备选方案: [passport-qq-token](https://github.com/sunnycmf/passport-qq-token)

### OAuth 2.0 标准流程
1. **用户点击登录按钮** → 重定向到第三方授权页面
2. **用户授权** → 第三方重定向回应用（带 code）
3. **应用后端用 code 换取 access_token**
4. **用 access_token 获取用户信息**
5. **创建/更新本地用户记录**
6. **生成 JWT token 并返回前端**

### QQ 互联 OAuth 关键信息
- **申请地址**: https://connect.qq.com/
- **文档**: https://wiki.connect.qq.com/OAuth2.0开发文档
- **授权端点**: `https://graph.qq.com/oauth2.0/authorize`
- **Token 端点**: `https://graph.qq.com/oauth2.0/token`
- **OpenID 端点**: `https://graph.qq.com/oauth2.0/me`
- **用户信息端点**: `https://graph.qq.com/user/get_user_info`
- **必需参数**: appid, appkey, callback URL
- **用户标识**: openid (QQ 用户唯一标识，不同应用的 openid 不同)

### Google OAuth 关键信息
- **申请地址**: https://console.cloud.google.com/
- **文档**: Google Cloud Console OAuth 配置
- **必需参数**: Client ID, Client Secret, Callback URL
- **Scope**: `profile`, `email`
- **用户标识**: Google ID (唯一标识)

## 3. 认证策略设计

### JWT vs Session 选择
**推荐方案：JWT + Redis Session 混合模式**（2025 最佳实践）

#### 理由
1. **JWT 优势**: 无状态、适合前后端分离、移动端友好
2. **Session 优势**: 可主动失效（用户登出、设备丢失）、更好的安全控制
3. **混合模式**: 短期 access_token (JWT) + 长期 refresh_token (Redis)

#### Token 设计
```javascript
// Access Token (JWT, 2小时有效)
{
  userId: string,
  email: string,
  provider: 'qq' | 'google',
  exp: timestamp
}

// Refresh Token (Redis, 30天有效)
{
  userId: string,
  deviceId: string,
  exp: timestamp
}
```

### 安全措施（必须实现）
1. **CSRF 防护**: OAuth state 参数（随机字符串）
2. **Cookie 安全标志**:
   - `httpOnly: true` (防止 XSS)
   - `secure: true` (仅 HTTPS)
   - `sameSite: 'lax'` (防止 CSRF)
3. **Rate Limiting**: 登录接口限流（100 次/15分钟/IP）
4. **Token 刷新**: access_token 过期后用 refresh_token 换取新 token
5. **Helmet**: 设置安全 HTTP 头

## 4. 数据库模型设计

### User 模型
```typescript
interface IUser {
  _id: ObjectId;
  email?: string;               // 可选，某些 QQ 用户不提供邮箱
  nickname: string;             // 显示名称
  avatar?: string;              // 头像 URL
  accounts: IOAuthAccount[];    // 关联的第三方账号（一个用户可绑定多个）
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

interface IOAuthAccount {
  provider: 'qq' | 'google';    // 登录提供商
  providerId: string;           // 第三方平台的用户 ID (QQ openid / Google ID)
  accessToken?: string;         // 访问令牌（可选存储，用于调用第三方 API）
  refreshToken?: string;        // 刷新令牌（可选）
  profile: any;                 // 第三方返回的原始 profile
  connectedAt: Date;            // 绑定时间
}
```

### 索引设计
```typescript
UserSchema.index({ email: 1 });
UserSchema.index({ 'accounts.provider': 1, 'accounts.providerId': 1 }, { unique: true });
```

### Post 模型迁移
```typescript
// 旧: author: string
// 新: author: ObjectId  (ref: 'User')
```

## 5. API 端点设计

### 认证相关路由
```
GET  /api/auth/google          - 发起 Google 登录
GET  /api/auth/google/callback - Google 回调
GET  /api/auth/qq              - 发起 QQ 登录
GET  /api/auth/qq/callback     - QQ 回调
POST /api/auth/refresh         - 刷新 access_token
POST /api/auth/logout          - 登出（清除 refresh_token）
GET  /api/auth/me              - 获取当前用户信息
```

### 前端路由
```
/login           - 登录页面
/auth/callback   - OAuth 回调页面（处理 token，跳转到首页）
/                - 首页（需要登录）
/result/:id      - 分析结果页（需要登录）
```

## 6. 技术选型和依赖

### 新增后端依赖
```json
{
  "passport": "^0.7.0",
  "passport-google-oauth20": "^2.0.0",
  "passport-qq": "^0.1.0",
  "jsonwebtoken": "^9.0.2",
  "express-session": "^1.18.0",
  "express-rate-limit": "^7.1.5",
  "helmet": "^7.1.0",
  "bcrypt": "^5.1.1",
  "redis": "^4.6.12",
  "connect-redis": "^7.1.0"
}
```

### 新增前端依赖
```json
{
  "无需新增依赖": "已有 axios 和 react-router-dom 足够"
}
```

## 7. 可复用组件清单

### 后端可复用
- **中间件模式**: `backend/src/middleware/upload.ts` - 参考此模式创建认证中间件
- **路由模式**: `backend/src/routes/*.routes.ts` - 参考此模式创建 auth 路由
- **控制器模式**: `backend/src/controllers/*.controller.ts` - 参考此模式创建 auth 控制器
- **服务层模式**: `backend/src/services/qwen.service.ts` - 参考此模式创建 auth.service.ts

### 前端可复用
- **API 调用**: `frontend/src/services/api.ts` - 参考此模式添加认证相关 API
- **组件模式**: `frontend/src/components/LoadingSpinner.tsx` - 可复用于登录加载

## 8. 关键风险点

### 技术风险
1. **QQ 登录**: `passport-qq` 是社区维护，非官方支持，可能存在兼容性问题
   - **缓解措施**: 优先实现 Google 登录，QQ 登录作为备选方案
   - **备选方案**: 如果 passport-qq 不可用，考虑直接使用 QQ 互联 API（不依赖 Passport）

2. **QQ 用户可能不提供邮箱**: QQ 互联的用户信息中 email 是可选的
   - **缓解措施**: User 模型的 email 字段设为可选，使用 nickname + providerId 作为唯一标识

3. **并发登录**: 多设备同时登录可能导致 token 冲突
   - **缓解措施**: refresh_token 绑定 deviceId，允许多设备登录

### 安全风险
1. **CSRF 攻击**: OAuth 回调可能被劫持
   - **缓解措施**: 使用 state 参数验证

2. **Token 泄露**: JWT token 可能被窃取
   - **缓解措施**: 短期 access_token + HttpOnly Cookie + HTTPS

3. **重放攻击**: access_token 被窃取后重复使用
   - **缓解措施**: 短期有效期 + refresh_token 机制

### 业务风险
1. **账号绑定**: 同一用户通过不同平台登录时的账号合并问题
   - **解决方案**: 初期不支持账号合并，后期可通过邮箱匹配合并

2. **用户数据迁移**: 现有 Post 的 author 字段需要迁移
   - **解决方案**: 编写数据迁移脚本，将字符串 author 转换为 User 引用

## 9. 实施优先级

### 阶段一：基础认证系统（核心，必须实现）
1. User 模型和数据库迁移
2. JWT 认证中间件
3. Google OAuth 登录（官方支持，优先级高）
4. 前端登录页面和路由守卫

### 阶段二：QQ 登录（次优先级）
1. 调研 passport-qq 可行性
2. 实现 QQ OAuth 登录
3. 测试和兼容性处理

### 阶段三：安全增强（重要）
1. Refresh Token 机制（Redis）
2. Rate Limiting
3. Helmet 安全头
4. CSRF 防护

### 阶段四：用户体验优化（可选）
1. 多账号绑定
2. 记住登录状态
3. 第三方账号解绑

## 10. 环境变量配置

### 需要在 `.env` 中新增
```bash
# JWT 配置
JWT_SECRET=<随机生成的强密钥>
JWT_ACCESS_EXPIRE=2h
JWT_REFRESH_EXPIRE=30d

# Google OAuth
GOOGLE_CLIENT_ID=<从 Google Cloud Console 获取>
GOOGLE_CLIENT_SECRET=<从 Google Cloud Console 获取>
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# QQ 互联
QQ_APP_ID=<从 QQ 互联申请>
QQ_APP_KEY=<从 QQ 互联申请>
QQ_CALLBACK_URL=http://localhost:3000/api/auth/qq/callback

# Redis (用于 Refresh Token 存储)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Session (备用方案，如果不用 Redis)
SESSION_SECRET=<随机生成的强密钥>

# 前端地址（用于登录成功后重定向）
FRONTEND_URL=http://localhost:5173
```

## 11. 参考资料

### 官方文档
- [Passport.js 官网](https://www.passportjs.org/packages/passport-google-oauth20/)
- [QQ 互联 OAuth2.0 开发文档](https://wiki.connect.qq.com/OAuth2.0开发文档)
- [Google OAuth 2.0](https://cloud.google.com/nodejs/docs/reference/google-auth-library/latest)

### 开源实现
- [qdsang/passport-qq](https://github.com/qdsang/passport-qq)
- [AndyShang/passport-qq](https://github.com/AndyShang/passport-qq)
- [passport-qq-token](https://github.com/sunnycmf/passport-qq-token)

### 最佳实践文章
- [Corbado: Node.js Express JWT Authentication with MongoDB & Roles](https://www.corbado.com/blog/nodejs-express-mongodb-jwt-authentication-roles)
- [CodeVoweb: Node.js + TypeScript + MongoDB: JWT Authentication 2025](https://codevoweb.com/node-typescript-mongodb-jwt-authentication/)
- [Permify: OAuth 2.0 implementation in Node.js](https://permify.co/post/oauth-20-implementation-nodejs-expressjs/)
- [LoginRadius: Google OAuth2 Authentication with Passport.js](https://www.loginradius.com/blog/engineering/google-authentication-with-nodejs-and-passportjs)
