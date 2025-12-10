import { useEffect, useState } from 'react';
import { adminService } from '../services/adminService';
import type { InvitationCodeSummary, InvitationListResponse } from '../types';
import { formatDate } from '../utils/helpers';
import LoadingSpinner from '../components/LoadingSpinner';

const getStatusLabel = (invitation: InvitationCodeSummary) => {
  if (!invitation.isActive) return { label: '已停用', color: 'text-gray-400', bg: 'bg-gray-800/60' };
  if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
    return { label: '已过期', color: 'text-red-400', bg: 'bg-red-500/10' };
  }
  if (typeof invitation.maxRedemptions === 'number' && invitation.usedCount >= invitation.maxRedemptions) {
    return { label: '已用完', color: 'text-yellow-400', bg: 'bg-yellow-500/10' };
  }
  return { label: '可用', color: 'text-emerald-400', bg: 'bg-emerald-500/10' };
};

export default function InvitationStorePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<InvitationCodeSummary[]>([]);
  const [pagination, setPagination] = useState<InvitationListResponse['pagination']>({ page: 1, limit: 20, total: 0, pages: 0 });
  const [searchCode, setSearchCode] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const loadInvitations = async (page = 1) => {
    setLoading(true);
    setError(null);
    setActionMessage(null);
    try {
      const data = await adminService.getInvitationList({
        page,
        code: searchCode || undefined,
        status: statusFilter === 'all' ? undefined : statusFilter,
      });
      setInvitations(data.invitations);
      setPagination(data.pagination);
    } catch (err: any) {
      console.error('加载邀请码失败', err);
      setError(err?.response?.data?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInvitations(1);
  }, []);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner message="加载邀请码中..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-8 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
          <span>🛒</span>
          邀请码商城
        </h1>
        <p className="text-gray-400">展示当前生成的所有邀请码及其剩余可用次数，方便分发或追踪使用情况</p>
      </div>

      {error && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-300 p-4 rounded-xl">
          {error}
        </div>
      )}
      {actionMessage && (
        <div className="bg-green-500/10 border border-green-500/30 text-green-300 p-3 rounded-xl">
          {actionMessage}
        </div>
      )}

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1 flex gap-3">
            <input
              type="text"
              value={searchCode}
              onChange={(e) => setSearchCode(e.target.value)}
              placeholder="输入邀请码关键字"
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white"
            >
              <option value="all">全部状态</option>
              <option value="active">启用</option>
              <option value="inactive">停用</option>
            </select>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => loadInvitations(1)}
              className="px-4 py-2 rounded-xl border border-white/20 text-gray-200 hover:text-white"
            >
              查询
            </button>
            <button
              onClick={async () => {
                try {
                  const blob = await adminService.exportInvitations({
                    code: searchCode || undefined,
                    status: statusFilter === 'all' ? undefined : statusFilter,
                  });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `invite-codes-${Date.now()}.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                } catch (err: any) {
                  console.error('导出失败', err);
                  setError(err?.response?.data?.message || '导出失败');
                }
              }}
              className="px-4 py-2 rounded-xl border border-white/20 text-gray-200 hover:text-white"
            >
              导出 Excel
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {invitations.map((invite) => {
          const status = getStatusLabel(invite);
          const remaining = typeof invite.maxRedemptions === 'number'
            ? Math.max(invite.maxRedemptions - invite.usedCount, 0)
            : '∞';

          return (
            <div key={invite._id} className="bg-gray-900/70 border border-gray-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500">邀请码</p>
                  <button
                    onClick={() => navigator.clipboard.writeText(invite.code)}
                    className="text-2xl font-mono text-white hover:text-blue-400"
                  >
                    {invite.code}
                  </button>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${status.bg} ${status.color}`}>
                  {status.label}
                </span>
              </div>
              <button
                onClick={async () => {
                  if (!confirm(`确定删除邀请码 ${invite.code} 吗？`)) return;
                  try {
                    await adminService.deleteInvitation(invite._id);
                    setActionMessage(`邀请码 ${invite.code} 已删除`);
                    loadInvitations(pagination.page);
                  } catch (err: any) {
                    console.error('删除失败', err);
                    setError(err?.response?.data?.message || '删除失败');
                  }
                }}
                className="text-xs text-red-400 border border-red-400/40 px-2 py-1 rounded-lg hover:bg-red-500/10"
              >
                删除
              </button>

              {invite.description && (
                <p className="text-sm text-gray-400">{invite.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                <div>
                  <p className="text-gray-500 text-xs">剩余次数</p>
                  <p className="text-lg font-semibold text-white">{remaining}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">已使用</p>
                  <p className="text-lg font-semibold text-white">{invite.usedCount}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">创建时间</p>
                  <p>{formatDate(invite.createdAt)}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">最近使用</p>
                  <p>{invite.lastUsedAt ? formatDate(invite.lastUsedAt) : '—'}</p>
                </div>
              </div>

              <div className="text-xs text-gray-500 space-y-1">
                <p>最大可用: {invite.maxRedemptions ?? '不限'}</p>
                <p>过期时间: {invite.expiresAt ? formatDate(invite.expiresAt) : '永久有效'}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-sm text-gray-400">
        <p>
          第 {pagination.page}/{pagination.pages || 1} 页 · 共 {pagination.total} 条
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => loadInvitations(Math.max(pagination.page - 1, 1))}
            disabled={pagination.page <= 1}
            className={`px-3 py-1 rounded-lg border ${pagination.page <= 1 ? 'border-gray-800 text-gray-600 cursor-not-allowed' : 'border-gray-700 text-gray-200 hover:border-gray-500'}`}
          >
            上一页
          </button>
          <button
            onClick={() => loadInvitations(Math.min(pagination.page + 1, pagination.pages || pagination.page + 1))}
            disabled={pagination.page >= (pagination.pages || 1)}
            className={`px-3 py-1 rounded-lg border ${(pagination.page >= (pagination.pages || 1)) ? 'border-gray-800 text-gray-600 cursor-not-allowed' : 'border-gray-700 text-gray-200 hover:border-gray-500'}`}
          >
            下一页
          </button>
        </div>
      </div>
    </div>
  );
}
