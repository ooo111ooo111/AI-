import { useEffect, useState, useRef } from 'react';
import { API_BASE_URL } from '../services/api';
import { inviteService } from '../services/inviteService';
import { formatDate } from '../utils/helpers';

interface User {
  id: string;
  nickname: string;
  avatar?: string;
  email?: string;
  quantAccess?: {
    hasAccess: boolean;
    invitationCode?: string;
    grantedAt?: string;
  };
}

export default function UserMenu() {
  const [user, setUser] = useState<User | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [redeemLoading, setRedeemLoading] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/me`, {
      credentials: 'include'
    })
      .then(res => res.json())
      .then(data => setUser(data))
      .catch(err => console.error('获取用户信息失败:', err));
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    setIsOpen(false);
    try {
      // 清除 localStorage 中的 token
      localStorage.removeItem('access_token');

      // 调用后端登出接口（清除 Cookie）
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });

      // 重定向到登录页
      window.location.href = '/login';
    } catch (error) {
      console.error('登出失败:', error);
      // 即使登出失败，也清除本地 token 并跳转
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
  };

  const handleRedeem = async () => {
    if (!inviteCode.trim()) {
      setRedeemError('请输入邀请码');
      return;
    }

    setRedeemLoading(true);
    setRedeemError(null);
    setRedeemMessage(null);
    try {
      const response = await inviteService.redeem(inviteCode.trim());
      setRedeemMessage(response.message);
      setInviteCode('');
      setUser((prev) => prev ? {
        ...prev,
        quantAccess: {
          hasAccess: response.status.hasAccess,
          invitationCode: response.status.invitationCode,
          grantedAt: response.status.grantedAt,
        }
      } : prev);
    } catch (error: any) {
      console.error('邀请码验证失败:', error);
      setRedeemError(error?.response?.data?.message || '邀请码验证失败');
    } finally {
      setRedeemLoading(false);
    }
  };

  if (!user) return null;

  const initial = user.nickname?.[0]?.toUpperCase() || 'A';

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-12 h-12 rounded-full border border-white/20 hover:border-white/60 transition flex items-center justify-center overflow-hidden bg-white/5"
      >
        {user.avatar ? (
          <img src={user.avatar} alt={user.nickname} className="w-full h-full object-cover" />
        ) : (
          <span className="text-lg font-semibold text-white">{initial}</span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-3 w-80 z-50">
          <div className="bg-gray-900/90 border border-gray-700 rounded-2xl p-4 space-y-4 shadow-2xl backdrop-blur-xl">
            <div className="flex items-center gap-3">
              {user.avatar ? (
                <img src={user.avatar} alt={user.nickname} className="w-12 h-12 rounded-full object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-pink-500 flex items-center justify-center text-white font-semibold text-xl">
                  {initial}
                </div>
              )}
              <div className="min-w-0">
                <p className="text-white font-semibold truncate">{user.nickname}</p>
                {user.email && <p className="text-sm text-gray-400 truncate">{user.email}</p>}
              </div>
              <button
                onClick={handleLogout}
                className="ml-auto px-3 py-1 text-xs border border-gray-600 rounded-lg text-gray-300 hover:text-white hover:border-gray-400"
              >
                退出
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="w-2 h-2 bg-emerald-400 rounded-full" />
                <span>邀请码权限</span>
              </div>
              {user.quantAccess?.hasAccess ? (
                <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-sm text-emerald-200 space-y-1">
                  <p>邀请码: {user.quantAccess.invitationCode || '—'}</p>
                  {user.quantAccess.grantedAt && (
                    <p>激活时间: {formatDate(user.quantAccess.grantedAt)}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-col gap-2">
                    <input
                      type="text"
                      value={inviteCode}
                      onChange={(e) => setInviteCode(e.target.value)}
                      placeholder="输入邀请码"
                      className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                    />
                    <button
                      onClick={handleRedeem}
                      disabled={redeemLoading}
                      className={`px-3 py-2 rounded-lg text-sm font-medium ${redeemLoading ? 'bg-gray-700 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-600 to-purple-600 text-white hover:shadow-lg'}`}
                    >
                      {redeemLoading ? '验证中...' : '验证邀请码'}
                    </button>
                  </div>
                  {redeemError && <p className="text-xs text-red-400">{redeemError}</p>}
                  {redeemMessage && <p className="text-xs text-green-400">{redeemMessage}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
