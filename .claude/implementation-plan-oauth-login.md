# OAuth 第三方登录功能 - 详细实施计划

生成时间：2025-12-06
项目：AI交易分析系统
功能：支持 QQ 和 Google 第三方登录

---

## 一、方案概述

### 核心目标
为 AI 交易分析系统添加用户认证系统，支持 QQ 和 Google 第三方登录，确保用户数据安全和良好的用户体验。

### 技术选型
- **认证框架**: Passport.js
- **Google 登录**: passport-google-oauth20 (官方支持)
- **QQ 登录**: passport-qq (社区方案) 或直接使用 QQ 互联 API
- **Token 方案**: JWT (access_token) + Redis (refresh_token)
- **安全增强**: Helmet + Rate Limiting + CSRF 防护

### 架构设计

```
┌─────────────────────────────────────────────────────────────┐
│                         前端 (React)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────┐    │
│  │  登录页面   │  │  路由守卫   │  │  用户信息组件    │    │
│  └─────────────┘  └─────────────┘  └──────────────────┘    │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTP/HTTPS
┌────────────────────────┴────────────────────────────────────┐
│                    后端 (Express + MongoDB)                  │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  认证路由 (/api/auth/*)                              │   │
│  │    - GET  /google           发起 Google 登录         │   │
│  │    - GET  /google/callback  Google 回调              │   │
│  │    - GET  /qq               发起 QQ 登录             │   │
│  │    - GET  /qq/callback      QQ 回调                  │   │
│  │    - POST /refresh          刷新 Token               │   │
│  │    - POST /logout           登出                     │   │
│  │    - GET  /me               获取当前用户             │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Passport.js 策略                                     │   │
│  │    - GoogleStrategy                                   │   │
│  │    - QQStrategy (或自定义)                            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  认证中间件                                           │   │
│  │    - verifyJWT()           验证 JWT token            │   │
│  │    - requireAuth()         路由守卫                  │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  数据库模型                                           │   │
│  │    - User (用户主表)                                  │   │
│  │    - OAuthAccount (第三方账号，嵌入 User)            │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
┌────────────────────────┴────────────────────────────────────┐
│  外部服务                                                    │
│    - Google OAuth 2.0 API                                   │
│    - QQ 互联 OAuth 2.0 API                                  │
│    - Redis (存储 refresh_token)                             │
└─────────────────────────────────────────────────────────────┘
```

### OAuth 2.0 登录流程

```
用户         前端          后端           第三方OAuth       MongoDB
 │           │            │                │               │
 │ 点击登录   │            │                │               │
 ├──────────>│            │                │               │
 │           │ GET /auth/google            │               │
 │           ├───────────>│                │               │
 │           │            │ 重定向授权页    │               │
 │           │            ├───────────────>│               │
 │           │  授权页面   │                │               │
 │<──────────┴────────────┴───────────────┤               │
 │                                         │               │
 │ 用户同意授权                             │               │
 ├────────────────────────────────────────>│               │
 │                                         │               │
 │           │            │ 回调+code      │               │
 │           │            │<───────────────┤               │
 │           │            │                │               │
 │           │            │ 用code换token  │               │
 │           │            ├───────────────>│               │
 │           │            │ access_token   │               │
 │           │            │<───────────────┤               │
 │           │            │                │               │
 │           │            │ 获取用户信息    │               │
 │           │            ├───────────────>│               │
 │           │            │ user_profile   │               │
 │           │            │<───────────────┤               │
 │           │            │                │               │
 │           │            │ 查询/创建用户                  │
 │           │            ├───────────────────────────────>│
 │           │            │                │  User 记录    │
 │           │            │<───────────────────────────────┤
 │           │            │                │               │
 │           │            │ 生成 JWT                       │
 │           │            │ 存储 refresh_token (Redis)     │
 │           │            │                │               │
 │           │  重定向前端 + JWT Cookie     │               │
 │           │<───────────┤                │               │
 │  登录成功  │            │                │               │
 │<──────────┤            │                │               │
```

---

## 二、分阶段实施计划

### 🎯 阶段一：基础认证系统（核心功能）

**目标**: 搭建基础认证架构，实现 Google 登录

#### 1.1 后端 - 安装依赖

```bash
cd backend
npm install passport passport-google-oauth20 jsonwebtoken express-session helmet express-rate-limit bcrypt
npm install --save-dev @types/passport @types/jsonwebtoken @types/express-session @types/bcrypt
```

#### 1.2 后端 - 创建 User 模型

**文件**: `backend/src/models/User.ts`

```typescript
import mongoose, { Schema, Document } from 'mongoose';

// OAuth 账号子文档接口
export interface IOAuthAccount {
  provider: 'qq' | 'google';
  providerId: string;           // QQ openid / Google ID
  profile: any;                 // 第三方返回的原始 profile
  connectedAt: Date;
}

// User 文档接口
export interface IUser extends Document {
  email?: string;
  nickname: string;
  avatar?: string;
  accounts: IOAuthAccount[];
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt: Date;
}

// OAuth 账号子模式
const OAuthAccountSchema = new Schema<IOAuthAccount>({
  provider: { type: String, enum: ['qq', 'google'], required: true },
  providerId: { type: String, required: true },
  profile: { type: Schema.Types.Mixed },
  connectedAt: { type: Date, default: Date.now }
}, { _id: false });

// User 主模式
const UserSchema = new Schema<IUser>(
  {
    email: { type: String, trim: true, lowercase: true },
    nickname: { type: String, required: true, trim: true },
    avatar: { type: String },
    accounts: [OAuthAccountSchema],
    lastLoginAt: { type: Date, default: Date.now }
  },
  { timestamps: true }
);

// 索引
UserSchema.index({ email: 1 });
UserSchema.index({ 'accounts.provider': 1, 'accounts.providerId': 1 }, { unique: true });

export default mongoose.model<IUser>('User', UserSchema);
```

#### 1.3 后端 - 环境变量配置

**文件**: `backend/.env` (新增以下内容)

```bash
# JWT 配置
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_ACCESS_EXPIRE=2h
JWT_REFRESH_EXPIRE=30d

# Google OAuth
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback

# 前端地址（登录成功后重定向）
FRONTEND_URL=http://localhost:5173
```

**获取 Google OAuth 凭证的步骤**:
1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 "Google+ API"
4. 创建 OAuth 2.0 客户端 ID
5. 授权重定向 URI 设置为: `http://localhost:3000/api/auth/google/callback`
6. 复制 Client ID 和 Client Secret 到 `.env`

#### 1.4 后端 - JWT 工具函数

**文件**: `backend/src/utils/jwt.util.ts`

```typescript
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'fallback_secret_for_dev';
const ACCESS_EXPIRE = process.env.JWT_ACCESS_EXPIRE || '2h';

export interface JWTPayload {
  userId: string;
  email?: string;
  provider: 'qq' | 'google';
}

// 生成 access token
export const generateAccessToken = (payload: JWTPayload): string => {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_EXPIRE });
};

// 验证 token
export const verifyAccessToken = (token: string): JWTPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JWTPayload;
  } catch (error) {
    return null;
  }
};
```

#### 1.5 后端 - 认证中间件

**文件**: `backend/src/middleware/auth.middleware.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';

// 扩展 Express Request 类型
declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        email?: string;
        provider: 'qq' | 'google';
      };
    }
  }
}

// 验证 JWT token
export const verifyJWT = (req: Request, res: Response, next: NextFunction) => {
  // 从 Authorization header 或 Cookie 中获取 token
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : req.cookies?.access_token;

  if (!token) {
    return res.status(401).json({ message: '未提供认证令牌' });
  }

  const payload = verifyAccessToken(token);

  if (!payload) {
    return res.status(401).json({ message: '无效或过期的令牌' });
  }

  req.user = payload;
  next();
};

// 路由守卫（必须登录）
export const requireAuth = verifyJWT;
```

#### 1.6 后端 - Passport Google 策略配置

**文件**: `backend/src/config/passport.config.ts`

```typescript
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User';

// Google OAuth 策略
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL!,
      scope: ['profile', 'email']
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 查找是否已存在该 Google 账号
        let user = await User.findOne({
          'accounts.provider': 'google',
          'accounts.providerId': profile.id
        });

        if (!user) {
          // 不存在则创建新用户
          user = await User.create({
            email: profile.emails?.[0]?.value,
            nickname: profile.displayName || 'Google 用户',
            avatar: profile.photos?.[0]?.value,
            accounts: [
              {
                provider: 'google',
                providerId: profile.id,
                profile: profile._json,
                connectedAt: new Date()
              }
            ],
            lastLoginAt: new Date()
          });
        } else {
          // 存在则更新最后登录时间
          user.lastLoginAt = new Date();
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);

// Passport 序列化（可选，如果不使用 session 可以留空）
passport.serializeUser((user: any, done) => {
  done(null, user._id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
```

#### 1.7 后端 - 认证路由

**文件**: `backend/src/routes/auth.routes.ts`

```typescript
import { Router } from 'express';
import passport from '../config/passport.config';
import { generateAccessToken } from '../utils/jwt.util';
import { requireAuth } from '../middleware/auth.middleware';
import User from '../models/User';

const router = Router();

// Google 登录 - 发起授权
router.get('/google', passport.authenticate('google', { session: false }));

// Google 登录 - 回调处理
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed` }),
  (req, res) => {
    const user = req.user as any;

    // 生成 JWT token
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      provider: 'google'
    });

    // 设置 HttpOnly Cookie（安全）
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // 生产环境强制 HTTPS
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000 // 2小时
    });

    // 重定向到前端首页
    res.redirect(`${process.env.FRONTEND_URL}/?login=success`);
  }
);

// 获取当前用户信息
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user!.userId).select('-accounts.profile');

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({
      id: user._id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
      accounts: user.accounts.map(acc => ({
        provider: acc.provider,
        connectedAt: acc.connectedAt
      })),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登出
router.post('/logout', (req, res) => {
  res.clearCookie('access_token');
  res.json({ message: '登出成功' });
});

export default router;
```

#### 1.8 后端 - 集成到主应用

**文件**: `backend/src/server.ts` (修改)

```typescript
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser'; // 需要安装: npm install cookie-parser @types/cookie-parser
import passport from './config/passport.config';
import analysisRoutes from './routes/analysis.routes';
import symbolRoutes from './routes/symbol.routes';
import authRoutes from './routes/auth.routes'; // 新增

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 安全中间件
app.use(helmet());

// CORS 配置（允许前端访问并携带 Cookie）
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:5173',
    credentials: true // 允许携带 Cookie
  })
);

// Rate Limiting (登录接口限流)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15分钟
  max: 100, // 最多100次请求
  message: '请求过于频繁，请稍后再试'
});

// 基础中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Passport 初始化
app.use(passport.initialize());

// 静态文件服务
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', uploadDir)));

// 路由
app.use('/api/auth', authLimiter, authRoutes); // 新增认证路由
app.use('/api/analyses', analysisRoutes);
app.use('/api/symbols', symbolRoutes);

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    message: 'AI交易分析服务运行正常',
    timestamp: new Date().toISOString()
  });
});

// 404 处理
app.use((req, res) => {
  res.status(404).json({ message: '接口不存在' });
});

// 错误处理
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('服务器错误:', err);
  res.status(err.status || 500).json({
    message: err.message || '服务器内部错误',
    error: process.env.NODE_ENV === 'development' ? err : {}
  });
});

// MongoDB 连接
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_analysis');
    console.log('✓ MongoDB 连接成功');
  } catch (error) {
    console.error('✗ MongoDB 连接失败:', error);
    process.exit(1);
  }
};

// 启动服务器
const startServer = async () => {
  await connectDB();

  app.listen(PORT, () => {
    console.log('=================================');
    console.log(`✓ 服务器运行在端口 ${PORT}`);
    console.log(`✓ 环境: ${process.env.NODE_ENV}`);
    console.log(`✓ API地址: http://localhost:${PORT}/api`);
    console.log('=================================');
  });
};

startServer();

export default app;
```

**补充安装**:
```bash
npm install cookie-parser
npm install --save-dev @types/cookie-parser
```

#### 1.9 前端 - 创建登录页面

**文件**: `frontend/src/pages/LoginPage.tsx`

```tsx
import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

export default function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  useEffect(() => {
    // 如果已登录，重定向到首页
    // 可以通过调用 /api/auth/me 检查登录状态
  }, [navigate]);

  const handleGoogleLogin = () => {
    // 跳转到后端 Google 登录接口
    window.location.href = 'http://localhost:3000/api/auth/google';
  };

  const handleQQLogin = () => {
    window.location.href = 'http://localhost:3000/api/auth/qq';
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            AI 交易分析系统
          </h1>
          <p className="text-gray-600">请选择登录方式</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">
              {error === 'google_auth_failed' && 'Google 登录失败，请重试'}
              {error === 'qq_auth_failed' && 'QQ 登录失败，请重试'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Google 登录按钮 */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium text-gray-700">使用 Google 登录</span>
          </button>

          {/* QQ 登录按钮 */}
          <button
            onClick={handleQQLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#12B7F5] text-white rounded-lg hover:bg-[#0FA8E6] transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.395 15.035a39.548 39.548 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.527 4.632 17.086 2 12 2S4.473 4.632 4.473 9.24c0 .274.013.804.014.836l-1.08 2.695a39.548 39.548 0 0 0-.802 2.264c-.265 1.025-.378 1.699-.38 1.711 0 .727.442 1.254.978 1.254.305 0 .572-.134.768-.365 2.015 1.239 4.562 1.91 7.029 1.91s5.014-.671 7.029-1.91c.196.231.463.365.768.365.536 0 .978-.527.978-1.254-.002-.012-.115-.686-.38-1.711z" />
            </svg>
            <span className="font-medium">使用 QQ 登录</span>
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>登录即表示您同意我们的</p>
          <p>
            <a href="#" className="text-blue-600 hover:underline">服务条款</a>
            {' 和 '}
            <a href="#" className="text-blue-600 hover:underline">隐私政策</a>
          </p>
        </div>
      </div>
    </div>
  );
}
```

#### 1.10 前端 - 更新路由配置

**文件**: `frontend/src/App.tsx` (修改)

```tsx
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import HomePage from './pages/HomePage';
import ResultPage from './pages/ResultPage';
import LoginPage from './pages/LoginPage';
import './index.css';

// 路由守卫组件
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // 检查登录状态
    fetch('http://localhost:3000/api/auth/me', {
      credentials: 'include' // 携带 Cookie
    })
      .then(res => {
        if (res.ok) {
          setIsAuthenticated(true);
        } else {
          setIsAuthenticated(false);
        }
      })
      .catch(() => setIsAuthenticated(false));
  }, []);

  if (isAuthenticated === null) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/result/:id"
          element={
            <ProtectedRoute>
              <ResultPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
```

#### 1.11 前端 - 添加用户信息组件

**文件**: `frontend/src/components/UserMenu.tsx`

```tsx
import { useState, useEffect } from 'react';

interface User {
  id: string;
  nickname: string;
  avatar?: string;
  email?: string;
}

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  useEffect(() => {
    // 获取用户信息
    fetch('http://localhost:3000/api/auth/me', {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(err => console.error('获取用户信息失败:', err));
  }, []);

  const handleLogout = async () => {
    try {
      await fetch('http://localhost:3000/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
      window.location.href = '/login';
    } catch (error) {
      console.error('登出失败:', error);
    }
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
      >
        {user.avatar ? (
          <img src={user.avatar} alt={user.nickname} className="w-8 h-8 rounded-full" />
        ) : (
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
            {user.nickname[0].toUpperCase()}
          </div>
        )}
        <span className="font-medium text-gray-700">{user.nickname}</span>
      </button>

      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
          <div className="px-4 py-2 border-b border-gray-200">
            <p className="text-sm font-medium text-gray-700">{user.nickname}</p>
            {user.email && <p className="text-xs text-gray-500">{user.email}</p>}
          </div>
          <button
            onClick={handleLogout}
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  );
}
```

然后在 HomePage.tsx 中引入：

```tsx
import UserMenu from '../components/UserMenu';

// 在页面头部添加
<div className="flex justify-between items-center">
  <h1>AI 交易分析</h1>
  <UserMenu />
</div>
```

---

### 🎯 阶段二：QQ 登录集成（次优先级）

**目标**: 添加 QQ 登录支持

#### 2.1 调研 passport-qq 可行性

**步骤**:
1. 安装测试 `passport-qq`:
   ```bash
   npm install passport-qq
   ```

2. 查看是否有类型定义:
   ```bash
   npm search @types/passport-qq
   ```

3. 如果没有类型定义，创建自定义类型:
   **文件**: `backend/src/types/passport-qq.d.ts`
   ```typescript
   declare module 'passport-qq' {
     import { Strategy as PassportStrategy } from 'passport';

     export interface Profile {
       id: string;
       displayName: string;
       gender?: string;
       _json: any;
     }

     export interface StrategyOptions {
       clientID: string;
       clientSecret: string;
       callbackURL: string;
       state?: boolean;
     }

     export class Strategy extends PassportStrategy {
       constructor(
         options: StrategyOptions,
         verify: (
           accessToken: string,
           refreshToken: string,
           profile: Profile,
           done: (error: any, user?: any) => void
         ) => void
       );
     }
   }
   ```

#### 2.2 申请 QQ 互联凭证

**步骤**:
1. 访问 [QQ 互联](https://connect.qq.com/)
2. 注册开发者账号
3. 创建网站应用
4. 填写网站信息和回调地址: `http://localhost:3000/api/auth/qq/callback`
5. 获取 APP ID 和 APP Key

#### 2.3 环境变量配置

**文件**: `backend/.env` (新增)

```bash
# QQ 互联 OAuth
QQ_APP_ID=your_qq_app_id
QQ_APP_KEY=your_qq_app_key
QQ_CALLBACK_URL=http://localhost:3000/api/auth/qq/callback
```

#### 2.4 Passport QQ 策略配置

**文件**: `backend/src/config/passport.config.ts` (追加)

```typescript
import { Strategy as QQStrategy } from 'passport-qq';

// QQ OAuth 策略
passport.use(
  new QQStrategy(
    {
      clientID: process.env.QQ_APP_ID!,
      clientSecret: process.env.QQ_APP_KEY!,
      callbackURL: process.env.QQ_CALLBACK_URL!,
      state: true // CSRF 防护
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // 查找是否已存在该 QQ 账号
        let user = await User.findOne({
          'accounts.provider': 'qq',
          'accounts.providerId': profile.id
        });

        if (!user) {
          // 不存在则创建新用户
          user = await User.create({
            nickname: profile.displayName || 'QQ 用户',
            accounts: [
              {
                provider: 'qq',
                providerId: profile.id,
                profile: profile._json,
                connectedAt: new Date()
              }
            ],
            lastLoginAt: new Date()
          });
        } else {
          // 存在则更新最后登录时间
          user.lastLoginAt = new Date();
          await user.save();
        }

        return done(null, user);
      } catch (error) {
        return done(error as Error, undefined);
      }
    }
  )
);
```

#### 2.5 认证路由（追加 QQ 登录）

**文件**: `backend/src/routes/auth.routes.ts` (追加)

```typescript
// QQ 登录 - 发起授权
router.get('/qq', passport.authenticate('qq', { session: false }));

// QQ 登录 - 回调处理
router.get(
  '/qq/callback',
  passport.authenticate('qq', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=qq_auth_failed` }),
  (req, res) => {
    const user = req.user as any;

    // 生成 JWT token
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      provider: 'qq'
    });

    // 设置 HttpOnly Cookie
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000
    });

    // 重定向到前端首页
    res.redirect(`${process.env.FRONTEND_URL}/?login=success`);
  }
);
```

#### 2.6 备选方案：不使用 passport-qq，直接对接 QQ 互联 API

如果 `passport-qq` 不可用或存在问题，可以直接实现 OAuth 2.0 流程。

**文件**: `backend/src/services/qq-oauth.service.ts`

```typescript
import axios from 'axios';

const QQ_AUTHORIZE_URL = 'https://graph.qq.com/oauth2.0/authorize';
const QQ_TOKEN_URL = 'https://graph.qq.com/oauth2.0/token';
const QQ_OPENID_URL = 'https://graph.qq.com/oauth2.0/me';
const QQ_USERINFO_URL = 'https://graph.qq.com/user/get_user_info';

// 生成授权 URL
export const getQQAuthURL = (state: string): string => {
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env.QQ_APP_ID!,
    redirect_uri: process.env.QQ_CALLBACK_URL!,
    state,
    scope: 'get_user_info'
  });
  return `${QQ_AUTHORIZE_URL}?${params.toString()}`;
};

// 用 code 换取 access_token
export const getQQAccessToken = async (code: string): Promise<string> => {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    client_id: process.env.QQ_APP_ID!,
    client_secret: process.env.QQ_APP_KEY!,
    code,
    redirect_uri: process.env.QQ_CALLBACK_URL!
  });

  const response = await axios.get(`${QQ_TOKEN_URL}?${params.toString()}`);
  const data = new URLSearchParams(response.data);
  return data.get('access_token')!;
};

// 获取 OpenID
export const getQQOpenID = async (accessToken: string): Promise<string> => {
  const response = await axios.get(`${QQ_OPENID_URL}?access_token=${accessToken}`);
  const jsonp = response.data.replace('callback(', '').replace(');', '');
  const data = JSON.parse(jsonp);
  return data.openid;
};

// 获取用户信息
export const getQQUserInfo = async (accessToken: string, openid: string) => {
  const params = new URLSearchParams({
    access_token: accessToken,
    oauth_consumer_key: process.env.QQ_APP_ID!,
    openid
  });

  const response = await axios.get(`${QQ_USERINFO_URL}?${params.toString()}`);
  return response.data;
};
```

**文件**: `backend/src/routes/auth.routes.ts` (使用自定义服务)

```typescript
import crypto from 'crypto';
import { getQQAuthURL, getQQAccessToken, getQQOpenID, getQQUserInfo } from '../services/qq-oauth.service';

// QQ 登录 - 发起授权（不使用 Passport）
router.get('/qq', (req, res) => {
  // 生成随机 state（CSRF 防护）
  const state = crypto.randomBytes(16).toString('hex');

  // 存储 state 到 session 或 Redis（这里简化，实际应存储）
  req.session = req.session || {};
  req.session.qq_state = state;

  const authURL = getQQAuthURL(state);
  res.redirect(authURL);
});

// QQ 登录 - 回调处理（不使用 Passport）
router.get('/qq/callback', async (req, res) => {
  const { code, state } = req.query;

  // 验证 state（CSRF 防护）
  if (state !== req.session?.qq_state) {
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_state`);
  }

  try {
    // 1. 用 code 换 access_token
    const accessToken = await getQQAccessToken(code as string);

    // 2. 获取 OpenID
    const openid = await getQQOpenID(accessToken);

    // 3. 获取用户信息
    const userInfo = await getQQUserInfo(accessToken, openid);

    // 4. 查找或创建用户
    let user = await User.findOne({
      'accounts.provider': 'qq',
      'accounts.providerId': openid
    });

    if (!user) {
      user = await User.create({
        nickname: userInfo.nickname || 'QQ 用户',
        avatar: userInfo.figureurl_qq_2 || userInfo.figureurl_qq_1,
        accounts: [
          {
            provider: 'qq',
            providerId: openid,
            profile: userInfo,
            connectedAt: new Date()
          }
        ],
        lastLoginAt: new Date()
      });
    } else {
      user.lastLoginAt = new Date();
      await user.save();
    }

    // 5. 生成 JWT token
    const jwtToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      provider: 'qq'
    });

    // 6. 设置 Cookie
    res.cookie('access_token', jwtToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000
    });

    // 7. 重定向到前端
    res.redirect(`${process.env.FRONTEND_URL}/?login=success`);
  } catch (error) {
    console.error('QQ 登录失败:', error);
    res.redirect(`${process.env.FRONTEND_URL}/login?error=qq_auth_failed`);
  }
});
```

**注意**: 自定义实现需要安装 `express-session` 来存储 state:
```bash
npm install express-session
npm install --save-dev @types/express-session
```

在 `server.ts` 中添加:
```typescript
import session from 'express-session';

app.use(session({
  secret: process.env.SESSION_SECRET || 'your_session_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    maxAge: 10 * 60 * 1000 // 10分钟
  }
}));
```

---

### 🎯 阶段三：安全增强（重要）

**目标**: 增强系统安全性，实现 Refresh Token 机制

#### 3.1 安装 Redis

**本地开发**:
```bash
# macOS
brew install redis
brew services start redis

# Ubuntu/Debian
sudo apt-get install redis-server
sudo systemctl start redis

# 验证 Redis 是否运行
redis-cli ping  # 应返回 PONG
```

**Docker**:
```bash
docker run -d --name redis -p 6379:6379 redis:alpine
```

#### 3.2 安装 Redis 客户端

```bash
cd backend
npm install redis
npm install --save-dev @types/redis
```

#### 3.3 Redis 工具类

**文件**: `backend/src/utils/redis.util.ts`

```typescript
import { createClient } from 'redis';

const redisClient = createClient({
  url: `redis://:${process.env.REDIS_PASSWORD || ''}@${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`
});

redisClient.on('error', (err) => console.error('Redis 连接错误:', err));

// 连接 Redis
export const connectRedis = async () => {
  if (!redisClient.isOpen) {
    await redisClient.connect();
    console.log('✓ Redis 连接成功');
  }
};

// 存储 refresh token（30天）
export const setRefreshToken = async (userId: string, token: string, deviceId: string) => {
  const key = `refresh_token:${userId}:${deviceId}`;
  await redisClient.setEx(key, 30 * 24 * 60 * 60, token); // 30天
};

// 获取 refresh token
export const getRefreshToken = async (userId: string, deviceId: string): Promise<string | null> => {
  const key = `refresh_token:${userId}:${deviceId}`;
  return await redisClient.get(key);
};

// 删除 refresh token（登出）
export const deleteRefreshToken = async (userId: string, deviceId: string) => {
  const key = `refresh_token:${userId}:${deviceId}`;
  await redisClient.del(key);
};

// 删除用户所有设备的 refresh token（全局登出）
export const deleteAllRefreshTokens = async (userId: string) => {
  const pattern = `refresh_token:${userId}:*`;
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) {
    await redisClient.del(keys);
  }
};

export default redisClient;
```

#### 3.4 Refresh Token 生成和验证

**文件**: `backend/src/utils/jwt.util.ts` (追加)

```typescript
import crypto from 'crypto';

// 生成 refresh token（随机字符串）
export const generateRefreshToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

// Refresh Token Payload
export interface RefreshTokenPayload {
  userId: string;
  deviceId: string;
  token: string;
}
```

#### 3.5 更新认证路由（支持 Refresh Token）

**文件**: `backend/src/routes/auth.routes.ts` (修改回调和新增刷新接口)

```typescript
import { setRefreshToken, getRefreshToken, deleteRefreshToken } from '../utils/redis.util';
import { generateRefreshToken, RefreshTokenPayload } from '../utils/jwt.util';
import crypto from 'crypto';

// 修改 Google/QQ 回调，同时生成 refresh token
// 在回调处理中添加（以 Google 为例）:
router.get(
  '/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.FRONTEND_URL}/login?error=google_auth_failed` }),
  async (req, res) => {
    const user = req.user as any;

    // 生成 device ID（可以从 User-Agent 生成）
    const deviceId = crypto.createHash('md5').update(req.headers['user-agent'] || 'unknown').digest('hex');

    // 生成 access token
    const accessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      provider: 'google'
    });

    // 生成 refresh token
    const refreshToken = generateRefreshToken();
    await setRefreshToken(user._id.toString(), refreshToken, deviceId);

    // 设置两个 Cookie
    res.cookie('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000 // 2小时
    });

    res.cookie('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30天
    });

    res.cookie('device_id', deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });

    res.redirect(`${process.env.FRONTEND_URL}/?login=success`);
  }
);

// 刷新 access token
router.post('/refresh', async (req, res) => {
  const refreshToken = req.cookies?.refresh_token;
  const deviceId = req.cookies?.device_id;

  if (!refreshToken || !deviceId) {
    return res.status(401).json({ message: '缺少刷新令牌' });
  }

  try {
    // 从 Redis 查找 refresh token
    const userId = req.user?.userId; // 需要先通过 JWT 获取 userId（即使 expired）

    // 如果 access_token 过期，需要特殊处理解码
    const expiredToken = req.cookies?.access_token;
    let userIdFromToken: string | null = null;

    if (expiredToken) {
      try {
        const decoded = jwt.decode(expiredToken) as JWTPayload;
        userIdFromToken = decoded.userId;
      } catch {
        // 忽略
      }
    }

    if (!userIdFromToken) {
      return res.status(401).json({ message: '无效的会话' });
    }

    const storedToken = await getRefreshToken(userIdFromToken, deviceId);

    if (!storedToken || storedToken !== refreshToken) {
      return res.status(401).json({ message: '刷新令牌无效或已过期' });
    }

    // 查询用户
    const user = await User.findById(userIdFromToken);

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    // 生成新的 access token
    const newAccessToken = generateAccessToken({
      userId: user._id.toString(),
      email: user.email,
      provider: user.accounts[0].provider
    });

    // 更新 Cookie
    res.cookie('access_token', newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 2 * 60 * 60 * 1000
    });

    res.json({ message: '令牌刷新成功' });
  } catch (error) {
    console.error('刷新令牌失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 更新登出接口（删除 Redis 中的 refresh token）
router.post('/logout', async (req, res) => {
  const deviceId = req.cookies?.device_id;

  if (req.user && deviceId) {
    await deleteRefreshToken(req.user.userId, deviceId);
  }

  res.clearCookie('access_token');
  res.clearCookie('refresh_token');
  res.clearCookie('device_id');
  res.json({ message: '登出成功' });
});
```

#### 3.6 更新 server.ts（启动时连接 Redis）

**文件**: `backend/src/server.ts` (修改 startServer)

```typescript
import { connectRedis } from './utils/redis.util';

const startServer = async () => {
  await connectDB();
  await connectRedis(); // 连接 Redis

  app.listen(PORT, () => {
    console.log('=================================');
    console.log(`✓ 服务器运行在端口 ${PORT}`);
    console.log(`✓ 环境: ${process.env.NODE_ENV}`);
    console.log(`✓ API地址: http://localhost:${PORT}/api`);
    console.log('=================================');
  });
};
```

#### 3.7 前端 - 自动刷新 Token

**文件**: `frontend/src/utils/auth.ts`

```typescript
// 自动刷新 token（当 API 返回 401 时）
export const refreshAccessToken = async (): Promise<boolean> => {
  try {
    const response = await fetch('http://localhost:3000/api/auth/refresh', {
      method: 'POST',
      credentials: 'include'
    });

    return response.ok;
  } catch {
    return false;
  }
};
```

**文件**: `frontend/src/services/api.ts` (添加拦截器)

```typescript
import axios from 'axios';
import { refreshAccessToken } from '../utils/auth';

const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  withCredentials: true // 携带 Cookie
});

// 响应拦截器
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 如果是 401 错误且未重试过，尝试刷新 token
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshed = await refreshAccessToken();

      if (refreshed) {
        // 刷新成功，重新发起原请求
        return api(originalRequest);
      } else {
        // 刷新失败，跳转到登录页
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
```

---

### 🎯 阶段四：用户体验优化（可选）

#### 4.1 记住登录状态（已通过 Cookie 实现）

#### 4.2 用户头像上传（未来功能）

#### 4.3 多账号绑定（未来功能）

---

## 三、测试计划

### 本地测试

#### 1. 后端测试

```bash
cd backend

# 启动 MongoDB
mongod --dbpath /path/to/your/db

# 启动 Redis
redis-server

# 启动后端
npm run dev
```

#### 2. 前端测试

```bash
cd frontend
npm run dev
```

#### 3. 测试流程

1. 访问 http://localhost:5173/
2. 应自动跳转到 /login
3. 点击 "使用 Google 登录"
4. 完成 Google 授权
5. 应重定向回首页，显示用户信息
6. 测试登出功能
7. 测试 QQ 登录（阶段二完成后）
8. 测试 Token 刷新（等待 access_token 过期或手动清除）

#### 4. API 测试

使用 Postman 或 curl 测试 API:

```bash
# 获取当前用户信息（需要先登录获取 Cookie）
curl -X GET http://localhost:3000/api/auth/me \
  -H "Cookie: access_token=YOUR_TOKEN" \
  --cookie-jar cookies.txt

# 刷新 Token
curl -X POST http://localhost:3000/api/auth/refresh \
  --cookie cookies.txt

# 登出
curl -X POST http://localhost:3000/api/auth/logout \
  --cookie cookies.txt
```

---

## 四、部署注意事项

### 环境变量（生产环境）

```bash
# .env.production

NODE_ENV=production

# JWT 配置（使用强密钥）
JWT_SECRET=<生成 64 位随机字符串>
JWT_ACCESS_EXPIRE=2h
JWT_REFRESH_EXPIRE=30d

# Google OAuth（生产环境回调地址）
GOOGLE_CLIENT_ID=<生产环境 Client ID>
GOOGLE_CLIENT_SECRET=<生产环境 Client Secret>
GOOGLE_CALLBACK_URL=https://yourdomain.com/api/auth/google/callback

# QQ 互联（生产环境回调地址）
QQ_APP_ID=<生产环境 APP ID>
QQ_APP_KEY=<生产环境 APP Key>
QQ_CALLBACK_URL=https://yourdomain.com/api/auth/qq/callback

# Redis（生产环境）
REDIS_HOST=your_redis_host
REDIS_PORT=6379
REDIS_PASSWORD=your_redis_password

# 前端地址
FRONTEND_URL=https://yourdomain.com

# MongoDB（生产环境）
MONGODB_URI=mongodb://username:password@host:port/crypto_analysis
```

### HTTPS 要求

生产环境必须使用 HTTPS，否则 Cookie 的 `secure` 标志会阻止传输。

### CORS 配置

确保 `backend/src/server.ts` 中的 CORS 配置允许生产环境的前端域名:

```typescript
app.use(
  cors({
    origin: process.env.FRONTEND_URL,
    credentials: true
  })
);
```

### Google/QQ 回调地址

在 Google Cloud Console 和 QQ 互联后台，将回调地址改为生产环境 URL:
- Google: `https://yourdomain.com/api/auth/google/callback`
- QQ: `https://yourdomain.com/api/auth/qq/callback`

---

## 五、风险评估和缓解措施

### 风险点

| 风险 | 可能性 | 影响 | 缓解措施 |
|------|--------|------|----------|
| QQ 登录 passport-qq 不可用 | 中 | 中 | 使用备选方案：直接对接 QQ 互联 API |
| QQ 用户不提供邮箱 | 高 | 低 | User 模型的 email 字段设为可选 |
| Token 泄露 | 低 | 高 | 短期 access_token + HttpOnly Cookie + HTTPS |
| CSRF 攻击 | 中 | 高 | OAuth state 参数 + SameSite Cookie |
| 多设备登录冲突 | 低 | 低 | refresh_token 绑定 deviceId |
| Redis 单点故障 | 低 | 高 | 使用 Redis 集群或哨兵模式（生产环境） |

---

## 六、后续优化方向

1. **多账号绑定**: 允许用户绑定多个第三方账号（Google + QQ）
2. **邮箱登录**: 支持传统邮箱+密码登录
3. **手机号登录**: 支持手机号+验证码登录
4. **用户资料编辑**: 允许用户修改昵称、头像
5. **登录日志**: 记录用户登录历史（IP、设备、时间）
6. **安全审计**: 异常登录提醒（新设备、新地点）
7. **第三方账号解绑**: 允许用户解除第三方账号绑定
8. **Redis 持久化**: 配置 Redis RDB/AOF 持久化策略

---

## 七、参考资料

### 官方文档
- [Passport.js](https://www.passportjs.org/)
- [passport-google-oauth20](https://www.passportjs.org/packages/passport-google-oauth20/)
- [QQ 互联 OAuth2.0 开发文档](https://wiki.connect.qq.com/OAuth2.0开发文档)
- [Google OAuth 2.0](https://developers.google.com/identity/protocols/oauth2)
- [JWT 官网](https://jwt.io/)
- [Redis 官网](https://redis.io/)

### 开源实现
- [qdsang/passport-qq](https://github.com/qdsang/passport-qq)
- [AndyShang/passport-qq](https://github.com/AndyShang/passport-qq)

### 最佳实践文章
- [Corbado: Node.js Express JWT Authentication with MongoDB & Roles](https://www.corbado.com/blog/nodejs-express-mongodb-jwt-authentication-roles)
- [CodeVoweb: Node.js + TypeScript + MongoDB: JWT Authentication 2025](https://codevoweb.com/node-typescript-mongodb-jwt-authentication/)
- [Permify: OAuth 2.0 implementation in Node.js](https://permify.co/post/oauth-20-implementation-nodejs-expressjs/)
- [LoginRadius: Google OAuth2 Authentication with Passport.js](https://www.loginradius.com/blog/engineering/google-authentication-with-nodejs-and-passportjs)
- [Express Security Best Practices 2025](https://hub.corgea.com/articles/express-security-best-practices-2025)

---

## 八、验收标准

### 阶段一（基础认证）

- [ ] 用户可以通过 Google 登录
- [ ] 登录成功后显示用户昵称和头像
- [ ] 未登录用户访问首页自动跳转到登录页
- [ ] 用户可以正常登出
- [ ] JWT token 在 2 小时后过期
- [ ] 所有 API 调用携带正确的认证信息

### 阶段二（QQ 登录）

- [ ] 用户可以通过 QQ 登录
- [ ] QQ 登录流程与 Google 一致
- [ ] QQ 用户信息正确显示
- [ ] QQ 和 Google 登录可以正常切换

### 阶段三（安全增强）

- [ ] Refresh Token 机制正常工作
- [ ] access_token 过期后自动刷新
- [ ] 登出时 Redis 中的 refresh_token 被删除
- [ ] Rate Limiting 生效（登录接口限流）
- [ ] Helmet 安全头正确设置
- [ ] CSRF 防护生效（OAuth state 参数验证）

### 阶段四（用户体验）

- [ ] 用户关闭浏览器后重新打开仍保持登录状态
- [ ] 登录页面 UI 美观友好
- [ ] 登录失败有明确的错误提示
- [ ] 用户菜单交互流畅

---

## 九、时间估算

| 阶段 | 任务 | 预计时间 |
|------|------|----------|
| 阶段一 | 基础认证系统 + Google 登录 | 1 天 |
| 阶段二 | QQ 登录集成 | 0.5 天 |
| 阶段三 | 安全增强（Refresh Token + Redis） | 0.5 天 |
| 阶段四 | 用户体验优化 | 0.5 天 |
| 测试 | 全面测试和 Bug 修复 | 0.5 天 |
| **总计** | | **3 天** |

---

## 十、开发检查清单

### 开始前

- [ ] 确认 Node.js、MongoDB、Redis 已安装
- [ ] 申请 Google OAuth 凭证
- [ ] 申请 QQ 互联凭证（阶段二）
- [ ] 创建 `.env` 文件并配置环境变量

### 开发中

- [ ] 遵循现有代码风格和命名约定
- [ ] 每完成一个功能点提交一次 Git
- [ ] 编写清晰的代码注释（中文）
- [ ] 错误处理完善（try-catch + 日志）

### 完成后

- [ ] 本地全面测试所有功能
- [ ] 检查控制台无错误和警告
- [ ] 更新 README.md（添加登录功能说明）
- [ ] 更新 API 文档
- [ ] 代码审查（自查或同行评审）
- [ ] 准备部署文档

---

**生成时间**: 2025-12-06
**文档版本**: v1.0
**作者**: Claude Code
**项目**: AI 交易分析系统 - OAuth 第三方登录功能
