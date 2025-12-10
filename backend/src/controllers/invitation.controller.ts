import { RequestHandler } from 'express';
import InvitationCode from '../models/InvitationCode';
import User from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

const buildStatusPayload = async (userId: string) => {
  const user = await User.findById(userId);

  if (!user) {
    return null;
  }

  let invitationMeta: {
    description?: string;
    remaining?: number;
  } | undefined;

  if (user.quantAccess?.invitationCode) {
    const invitation = await InvitationCode.findOne({ code: user.quantAccess.invitationCode });
    if (invitation) {
      const remaining = typeof invitation.maxRedemptions === 'number'
        ? Math.max(invitation.maxRedemptions - invitation.usedCount, 0)
        : undefined;
      invitationMeta = {
        description: invitation.description,
        remaining,
      };
    }
  }

  return {
    hasAccess: user.quantAccess?.hasAccess ?? false,
    invitationCode: user.quantAccess?.invitationCode,
    grantedAt: user.quantAccess?.grantedAt,
    meta: invitationMeta,
  };
};

export const getInvitationStatus: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const status = await buildStatusPayload(authReq.user!.userId);
    if (!status) {
      return res.status(404).json({ message: '用户不存在' });
    }
    res.json(status);
  } catch (error) {
    console.error('获取邀请码状态失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

export const redeemInvitationCode: RequestHandler = async (req, res) => {
  try {
    const { code } = req.body as { code?: string };
    if (!code) {
      return res.status(400).json({ message: '请提供邀请码' });
    }

    const normalizedCode = code.trim().toUpperCase();
    const authReq = req as AuthenticatedRequest;
    const user = await User.findById(authReq.user!.userId);

    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    if (user.quantAccess?.hasAccess) {
      return res.status(400).json({ message: '您已拥有量化权限' });
    }

    let invitation = await InvitationCode.findOne({ code: normalizedCode });

    const defaultCode = process.env.DEFAULT_INVITE_CODE?.trim().toUpperCase();
    if (!invitation && defaultCode && defaultCode === normalizedCode) {
      invitation = await InvitationCode.findOneAndUpdate(
        { code: normalizedCode },
        {
          code: normalizedCode,
          description: '默认邀请码',
          isActive: true,
          maxRedemptions: 1
        },
        { upsert: true, new: true }
      );
    }

    if (!invitation) {
      return res.status(404).json({ message: '邀请码不存在' });
    }

    if (!invitation.isActive) {
      return res.status(400).json({ message: '该邀请码已失效' });
    }

    if (invitation.expiresAt && invitation.expiresAt.getTime() < Date.now()) {
      return res.status(400).json({ message: '该邀请码已过期' });
    }

    if (
      typeof invitation.maxRedemptions === 'number' &&
      invitation.usedCount >= invitation.maxRedemptions
    ) {
      return res.status(400).json({ message: '该邀请码已达使用上限' });
    }

    user.quantAccess = {
      hasAccess: true,
      invitationCode: invitation.code,
      grantedAt: new Date(),
    };
    await user.save();

    invitation.usedCount += 1;
    invitation.lastUsedAt = new Date();
    await invitation.save();

    const status = await buildStatusPayload(authReq.user!.userId);
    res.json({
      message: '邀请码验证成功',
      status,
    });
  } catch (error) {
    console.error('邀请码验证失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

const CODE_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const randomCode = (length: number) => {
  let result = '';
  for (let i = 0; i < length; i += 1) {
    const idx = Math.floor(Math.random() * CODE_CHARSET.length);
    result += CODE_CHARSET[idx];
  }
  return result;
};

export const generateInvitationCodes: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const { count = 1, length = 8, prefix = '', description, maxRedemptions, expiresAt } = req.body as {
      count?: number;
      length?: number;
      prefix?: string;
      description?: string;
      maxRedemptions?: number;
      expiresAt?: string;
    };

    const safeCount = Math.min(Math.max(Number(count) || 1, 1), 50);
    const safeLength = Math.min(Math.max(Number(length) || 6, 4), 16);
    const normalizedPrefix = (prefix || '').trim().toUpperCase();
    const codes: string[] = [];

    const expireDate = expiresAt ? new Date(expiresAt) : undefined;
    if (expireDate && Number.isNaN(expireDate.getTime())) {
      return res.status(400).json({ message: '过期时间格式错误' });
    }

    while (codes.length < safeCount) {
      const candidate = `${normalizedPrefix}${randomCode(safeLength)}`;
      const existing = await InvitationCode.findOne({ code: candidate });
      if (existing) {
        continue;
      }
      await InvitationCode.create({
        code: candidate,
        description,
        maxRedemptions: typeof maxRedemptions === 'number' ? maxRedemptions : 1,
        expiresAt: expireDate,
        createdBy: authReq.user?.userId,
      });
      codes.push(candidate);
    }

    res.json({
      message: `成功生成 ${codes.length} 个邀请码`,
      codes,
    });
  } catch (error) {
    console.error('生成邀请码失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

export const listInvitationCodes: RequestHandler = async (req, res) => {
  try {
    const page = Math.max(Number(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const skip = (page - 1) * limit;
    const { code, status } = req.query as { code?: string; status?: string };

    const query: Record<string, any> = {};
    if (code) {
      query.code = new RegExp(code.trim(), 'i');
    }
    if (status === 'active') {
      query.isActive = true;
    }
    if (status === 'inactive') {
      query.isActive = false;
    }

    const [items, total] = await Promise.all([
      InvitationCode.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      InvitationCode.countDocuments(query)
    ]);

    res.json({
      invitations: items,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('获取邀请码列表失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

export const deleteInvitationCode: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await InvitationCode.findByIdAndDelete(id);
    if (!result) {
      return res.status(404).json({ message: '邀请码不存在' });
    }
    res.json({ message: '邀请码已删除' });
  } catch (error) {
    console.error('删除邀请码失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

export const exportInvitationCodes: RequestHandler = async (req, res) => {
  try {
    const { code, status } = req.query as { code?: string; status?: string };
    const query: Record<string, any> = {};
    if (code) {
      query.code = new RegExp(code.trim(), 'i');
    }
    if (status === 'active') {
      query.isActive = true;
    }
    if (status === 'inactive') {
      query.isActive = false;
    }

    const items = await InvitationCode.find(query).sort({ createdAt: -1 }).lean();
    const header = ['code', 'description', 'maxRedemptions', 'usedCount', 'isActive', 'expiresAt', 'lastUsedAt', 'createdAt'];
    const rows = items.map((item) => [
      item.code,
      item.description || '',
      item.maxRedemptions ?? '',
      item.usedCount ?? 0,
      item.isActive ? '启用' : '停用',
      item.expiresAt ? item.expiresAt.toISOString() : '',
      item.lastUsedAt ? item.lastUsedAt.toISOString() : '',
      item.createdAt ? item.createdAt.toISOString() : '',
    ]);

    const csvContent = [header, ...rows]
      .map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="invitation-codes-${Date.now()}.csv"`);
    res.send(`\ufeff${csvContent}`);
  } catch (error) {
    console.error('导出邀请码失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};
