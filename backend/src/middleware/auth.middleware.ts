import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util';

// 扩展 Express Request 类型
export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email?: string;
    provider: 'qq' | 'google';
  };
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

  (req as AuthenticatedRequest).user = payload;
  next();
};

// 路由守卫（必须登录）
export const requireAuth = verifyJWT;
