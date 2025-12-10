import { RequestHandler } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import User from '../models/User';
import { isAdminEmail } from '../utils/admin.util';

export const requireAdmin: RequestHandler = async (req, res, next) => {
  try {
    const authReq = req as AuthenticatedRequest;
    if (!authReq.user) {
      return res.status(401).json({ message: '未认证' });
    }

    const user = await User.findById(authReq.user.userId);
    if (!user || !isAdminEmail(user.email)) {
      return res.status(403).json({ message: '需要管理员权限' });
    }

    next();
  } catch (error) {
    console.error('管理员校验失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};
