import { RequestHandler } from 'express';
import User from '../models/User';

export const listUsers: RequestHandler = async (_req, res) => {
  try {
    const users = await User.find()
      .sort({ createdAt: -1 })
      .select('email nickname createdAt lastLoginAt quantAccess accounts');

    const payload = users.map((user) => ({
      id: (user as any)._id,
      email: user.email,
      nickname: user.nickname,
      createdAt: (user as any).createdAt,
      lastLoginAt: user.lastLoginAt,
      quantAccess: user.quantAccess,
      providers: user.accounts?.map(acc => acc.provider) || [],
    }));

    res.json({ users: payload });
  } catch (error) {
    console.error('获取用户列表失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};
