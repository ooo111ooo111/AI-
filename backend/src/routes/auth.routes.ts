import { Router, Request, Response } from 'express';
import passport from '../config/passport.config';
import { generateAccessToken } from '../utils/jwt.util';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.middleware';
import User from '../models/User';
import { isAdminEmail } from '../utils/admin.util';

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const buildRedirectUrl = (token: string) => (
  process.env.NODE_ENV === 'production'
    ? `${FRONTEND_URL}/?login=success`
    : `${FRONTEND_URL}/?login=success&token=${token}`
);

const oauthSuccessHandler = (provider: 'google' | 'qq') => (req: Request, res: Response) => {
  const user = req.user as any;

  const accessToken = generateAccessToken({
    userId: user._id.toString(),
    email: user.email,
    provider
  });

  res.cookie('access_token', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax',
    maxAge: 2 * 60 * 60 * 1000
  });

  res.redirect(buildRedirectUrl(accessToken));
};

// Google 登录 - 发起授权
router.get('/google', passport.authenticate('google', { session: false }));

// Google 登录 - 回调处理
router.get(
  '/google/callback',
  passport.authenticate('google', {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=google_auth_failed`
  }),
  oauthSuccessHandler('google')
);

// QQ 登录 - 发起授权
router.get('/qq', passport.authenticate('qq', { session: false }));

// QQ 登录 - 回调处理
router.get(
  '/qq/callback',
  passport.authenticate('qq', {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=qq_auth_failed`
  }),
  oauthSuccessHandler('qq')
);

// 获取当前用户信息
router.get('/me', requireAuth, async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await User.findById(authReq.user!.userId).select('-accounts.profile');

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({
      id: (user as any)._id,
      email: user.email,
      nickname: user.nickname,
      avatar: user.avatar,
      accounts: user.accounts.map(acc => ({
        provider: acc.provider,
        connectedAt: acc.connectedAt
      })),
      lastLoginAt: user.lastLoginAt,
      createdAt: (user as any).createdAt,
      quantAccess: {
        hasAccess: user.quantAccess?.hasAccess ?? false,
        invitationCode: user.quantAccess?.invitationCode,
        grantedAt: user.quantAccess?.grantedAt
      },
      gate: {
        isConnected: Boolean(user.gateSettings?.apiKey && user.gateSettings?.isEnabled),
        nickname: user.gateSettings?.nickname,
        updatedAt: user.gateSettings?.updatedAt
      },
      isAdmin: isAdminEmail(user.email)
    });
  } catch (error) {
    console.error('获取用户信息失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
});

// 登出
router.post('/logout', (_req, res) => {
  res.clearCookie('access_token');
  res.json({ message: '登出成功' });
});

export default router;
