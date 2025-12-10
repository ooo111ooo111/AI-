import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import cookieParser from 'cookie-parser';
import http from 'http';
import passport from './config/passport.config';
import analysisRoutes from './routes/analysis.routes';
import symbolRoutes from './routes/symbol.routes';
import authRoutes from './routes/auth.routes';
import invitationRoutes from './routes/invitation.routes';
import quantRoutes from './routes/quant.routes';
import hotspotRoutes from './routes/hotspot.routes';
import adminRoutes from './routes/admin.routes';
import { websocketHub } from './services/websocket.service';
import { strategyEngine } from './services/strategyEngine';
import { startHotspotPolling } from './services/hotspot.service';
import { strategyEventBus } from './events/strategy.events';

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
  max: process.env.NODE_ENV === 'production' ? 100 : 100000,
  message: '请求过于频繁，请稍后再试'
});

// 基础中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Passport 初始化
app.use(passport.initialize());

// 静态文件服务（提供上传的图片访问）
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', uploadDir)));

// 路由
app.use('/api/auth', authLimiter, authRoutes); // 新增认证路由
app.use('/api/analyses', analysisRoutes);
app.use('/api/symbols', symbolRoutes);
app.use('/api/invitations', invitationRoutes);
app.use('/api/quant', quantRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/hotspots', hotspotRoutes);

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
    await mongoose.connect(
      process.env.MONGODB_URI || 'mongodb://localhost:27017/crypto_analysis'
    );
    console.log('✓ MongoDB 连接成功');
  } catch (error) {
    console.error('✗ MongoDB 连接失败:', error);
    process.exit(1);
  }
};

// 启动服务器
const startServer = async () => {
  await connectDB();

  const server = http.createServer(app);
  websocketHub.attach(server);
  strategyEventBus.onEvent((event) => {
    websocketHub.sendToUser(event.userId, event);
  });

  server.listen(PORT, async () => {
    console.log('=================================');
    console.log(`✓ 服务器运行在端口 ${PORT}`);
    console.log(`✓ 环境: ${process.env.NODE_ENV}`);
    console.log(`✓ API地址: http://localhost:${PORT}/api`);
    console.log('=================================');
    await strategyEngine.bootstrap();
    startHotspotPolling();
  });
};

startServer();

export default app;
