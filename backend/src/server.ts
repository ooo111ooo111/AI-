import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import analysisRoutes from './routes/analysis.routes';
import symbolRoutes from './routes/symbol.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 静态文件服务（提供上传的图片访问）
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
app.use('/uploads', express.static(path.join(__dirname, '..', uploadDir)));

// 路由
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
