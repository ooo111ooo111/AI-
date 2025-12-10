import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import LoadingSpinner from '../components/LoadingSpinner';
import type { AdminUserSummary } from '../types';
import { formatDate } from '../utils/helpers';

export default function AdminPage() {
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviteForm, setInviteForm] = useState<{
    prefix: string;
    count: number;
    length: number;
    maxRedemptions?: number;
    expiresAt: string;
    description: string;
  }>({
    prefix: 'VIP',
    count: 5,
    length: 6,
    maxRedemptions: 1,
    expiresAt: '',
    description: '',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [generatedCodes, setGeneratedCodes] = useState<string[]>([]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await adminService.getUsers();
      setUsers(data.users);
    } catch (err: any) {
      console.error('获取用户列表失败', err);
      setError(err?.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvites = async () => {
    if (inviteLoading) return;
    setInviteLoading(true);
    setInviteError(null);
    setInviteMessage(null);
    try {
      const payload = {
        prefix: inviteForm.prefix.trim() || undefined,
        count: Number(inviteForm.count) || 1,
        length: Number(inviteForm.length) || 6,
        maxRedemptions: inviteForm.maxRedemptions ? Number(inviteForm.maxRedemptions) : undefined,
        expiresAt: inviteForm.expiresAt || undefined,
        description: inviteForm.description.trim() || undefined,
      };
      const result = await adminService.generateInvites(payload);
      setGeneratedCodes(result.codes);
      setInviteMessage(result.message);
    } catch (err: any) {
      console.error('生成邀请码失败', err);
      setInviteError(err?.response?.data?.message || '生成失败');
    } finally {
      setInviteLoading(false);
      loadUsers();
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner message="加载用户列表中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <span>🛠️</span>
          管理后台
        </h1>
        <p className="text-gray-400">查看已注册的账号、邮箱以及邀请码激活状态</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl">
          {error}
        </div>
      )}

      <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-xl">🔐</div>
          <div>
            <h2 className="text-xl font-semibold text-white">批量生成邀请码</h2>
            <p className="text-sm text-gray-400">最多一次生成 50 个，只能管理员操作</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-1">
            <label className="text-xs text-gray-400">邀请码前缀 (选填)</label>
            <input
              type="text"
              value={inviteForm.prefix}
              onChange={(e) => setInviteForm({ ...inviteForm, prefix: e.target.value })}
              placeholder="如 VIP"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
            <p className="text-[11px] text-gray-500">用于区分渠道，限定字母数字</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">生成数量 (1-50)</label>
            <input
              type="number"
              min={1}
              max={50}
              value={inviteForm.count}
              onChange={(e) => setInviteForm({ ...inviteForm, count: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
            <p className="text-[11px] text-gray-500">每个邀请码仅能使用一次</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">随机码长度 (4-16)</label>
            <input
              type="number"
              min={4}
              max={16}
              value={inviteForm.length}
              onChange={(e) => setInviteForm({ ...inviteForm, length: Number(e.target.value) })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
            <p className="text-[11px] text-gray-500">越长越安全，推荐 6 位以上</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">可使用次数</label>
            <input
              type="number"
              min={1}
              value={inviteForm.maxRedemptions ?? ''}
              onChange={(e) => setInviteForm({ ...inviteForm, maxRedemptions: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="默认为 1"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
            <p className="text-[11px] text-gray-500">不填写则默认为一次性邀请码</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">过期时间</label>
            <input
              type="date"
              value={inviteForm.expiresAt}
              onChange={(e) => setInviteForm({ ...inviteForm, expiresAt: e.target.value })}
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
            <p className="text-[11px] text-gray-500">留空表示永久有效</p>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-gray-400">备注说明</label>
            <input
              type="text"
              value={inviteForm.description}
              onChange={(e) => setInviteForm({ ...inviteForm, description: e.target.value })}
              placeholder="例如渠道或用途"
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
            />
            <p className="text-[11px] text-gray-500">生成后会记录，方便追溯来源</p>
          </div>
        </div>

        <button
          onClick={handleGenerateInvites}
          className={`px-6 py-3 rounded-xl font-semibold ${inviteLoading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:shadow-lg'}`}
        >
          {inviteLoading ? '生成中...' : '生成邀请码'}
        </button>
        {inviteError && <p className="text-sm text-red-400">{inviteError}</p>}
        {inviteMessage && <p className="text-sm text-green-400">{inviteMessage}</p>}

        {generatedCodes.length > 0 && (
          <div className="bg-gray-800/70 border border-gray-700 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-3">已生成邀请码（点击即可复制）：</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
              {generatedCodes.map((code) => (
                <button
                  key={code}
                  onClick={() => navigator.clipboard.writeText(code)}
                  className="px-3 py-2 bg-gray-900/70 border border-gray-700 rounded-lg text-white hover:border-blue-500"
                >
                  {code}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="bg-gray-900/70 border border-gray-800 rounded-2xl overflow-hidden">
        <div className="grid grid-cols-6 text-xs uppercase tracking-wider text-gray-400 border-b border-gray-800 px-4 py-3">
          <span>用户</span>
          <span>邮箱</span>
          <span>登录方式</span>
          <span>邀请码状态</span>
          <span>注册时间</span>
          <span>最近登录</span>
        </div>
        {users.length ? (
          <div className="divide-y divide-gray-800">
            {users.map((user) => (
              <div key={user.id} className="grid grid-cols-6 px-4 py-4 text-sm text-gray-200">
                <div>
                  <p className="font-semibold text-white">{user.nickname}</p>
                  <p className="text-xs text-gray-500 truncate">ID: {user.id}</p>
                </div>
                <div className="text-gray-300">
                  {user.email || <span className="text-gray-500">—</span>}
                </div>
                <div className="text-gray-300">
                  {user.providers?.length ? user.providers.join(', ').toUpperCase() : '—'}
                </div>
                <div>
                  {user.quantAccess?.hasAccess ? (
                    <div className="text-emerald-400 text-xs space-y-1">
                      <p>已激活</p>
                      <p>{user.quantAccess.invitationCode || '—'}</p>
                    </div>
                  ) : (
                    <span className="text-yellow-400 text-xs">未验证</span>
                  )}
                </div>
                <div className="text-gray-300 text-xs">
                  {user.createdAt ? formatDate(user.createdAt) : '—'}
                </div>
                <div className="text-gray-300 text-xs">
                  {user.lastLoginAt ? formatDate(user.lastLoginAt) : '—'}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-6 text-center text-gray-500">暂无用户</div>
        )}
      </div>
    </div>
  );
}
