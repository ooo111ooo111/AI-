import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { API_BASE_URL } from '../services/api';

const navigation = [
  { name: '新建分析', path: '/', description: '上传图表' },
  { name: '历史记录', path: '/history', description: '回顾结果' },
  { name: '推荐注册', path: '/referral', description: '社群与注册链接' },
  { name: '热点信息', path: '/hotspots', description: '名人推文快讯' },
  { name: '量化控制台', path: '/quant', description: 'Gate 实盘工具 / 回测' },
  { name: '行情看图', path: '/quant/market', description: '币种选择 + K线' },
  { name: '管理端', path: '/console/system/admin', description: '用户与权限', adminOnly: true },
  { name: '邀请码商城', path: '/console/system/invitations', description: '邀请码库存', adminOnly: true },
];

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE_URL}/auth/me`, { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.isAdmin) setIsAdmin(true);
      })
      .catch(() => {});
  }, []);

  return (
    <aside
      className={`transition-all duration-300 ease-in-out border-r border-gray-800 backdrop-blur-xl bg-gradient-to-b from-black/85 via-black/75 to-black/65 flex flex-col ${collapsed ? 'w-24' : 'w-72'}`}
    >
      <div className="p-6 border-b border-gray-800">
        <div className="flex items-center justify-between">
          {!collapsed && (
            <div className="space-y-1">
              <p className="text-[11px] tracking-[0.4em] text-gray-500 uppercase">AI Quant</p>
              <p className="text-2xl font-semibold text-white">交易工作台</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="h-10 w-10 flex items-center justify-center rounded-2xl border border-gray-800 text-gray-400 hover:text-white hover:border-gray-600"
          >
            {collapsed ? '→' : '←'}
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-3">
        {navigation
          .filter((item) => !item.adminOnly || isAdmin)
          .map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/'}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 border ${
                  isActive
                    ? 'bg-[#111] text-white border-white/20'
                    : 'text-gray-400 border-transparent hover:text-white hover:border-white/10 hover:bg-white/5'
                }`
              }
            >
              {collapsed ? (
                <span className="text-xs tracking-[0.3em] uppercase">
                  {item.name.slice(0, 2)}
                </span>
              ) : (
                <div>
                  <p className="text-base font-medium">{item.name}</p>
                  <p className="text-xs text-gray-500">{item.description}</p>
                </div>
              )}
            </NavLink>
          ))}
      </nav>

    </aside>
  );
}
