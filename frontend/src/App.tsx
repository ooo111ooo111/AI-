import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import HistoryPage from './pages/HistoryPage';
import ReferralPage from './pages/ReferralPage';
import ResultPage from './pages/ResultPage';
import LoginPage from './pages/LoginPage';
import QuantPage from './pages/QuantPage';
import AdminPage from './pages/AdminPage';
import InvitationStorePage from './pages/InvitationStorePage';
import MarketPage from './pages/MarketPage';
import QuantMonitorPage from './pages/QuantMonitorPage';
import HotspotPage from './pages/HotspotPage';
import './index.css';
import { API_BASE_URL } from './services/api';

function ProtectedRoute({
  children,
  isAuthenticated,
  authChecked,
}: {
  children: React.ReactNode;
  isAuthenticated: boolean;
  authChecked: boolean;
}) {
  if (!authChecked) {
    return <div className="min-h-screen flex items-center justify-center">加载中...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const [authChecked, setAuthChecked] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const refreshAuth = useCallback(async () => {
    setAuthChecked(false);
    try {
      const token = localStorage.getItem('access_token');
      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
      const res = await fetch(`${API_BASE_URL}/auth/me`, {
        credentials: 'include',
        headers,
      });
      if (res.ok) {
        setIsAuthenticated(true);
      } else {
        // token 无效，清除并跳转到登录
        localStorage.removeItem('access_token');
        setIsAuthenticated(false);
      }
    } catch (error) {
      // 网络错误，清除 token
      localStorage.removeItem('access_token');
      setIsAuthenticated(false);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    // 检查 URL 中是否有 token 参数（登录回调时）
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');

    if (token) {
      // 保存 token 到 localStorage
      localStorage.setItem('access_token', token);
      // 清理 URL 参数
      window.history.replaceState({}, document.title, window.location.pathname);
      refreshAuth();
    }
  }, [refreshAuth]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  return (
    <Router>
      <Routes>
        {/* 登录页面（不需要认证） */}
        <Route
          path="/login"
          element={
            authChecked ? (
              isAuthenticated ? <Navigate to="/" replace /> : <LoginPage />
            ) : (
              <div className="min-h-screen flex items-center justify-center">加载中...</div>
            )
          }
        />

        {/* 带布局的页面（需要认证） */}
        <Route
          path="/"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <Layout><HomePage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/history"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <Layout><HistoryPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/referral"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <Layout><ReferralPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quant"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <Layout><QuantPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quant/market"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <Layout><MarketPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/hotspots"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <Layout><HotspotPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/quant/monitor"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <Layout><QuantMonitorPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/console/system/admin"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <Layout><AdminPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/console/system/invitations"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <Layout><InvitationStorePage /></Layout>
            </ProtectedRoute>
          }
        />

        {/* 结果页面不需要侧边栏（但需要认证） */}
        <Route
          path="/result/:id"
          element={
            <ProtectedRoute isAuthenticated={isAuthenticated} authChecked={authChecked}>
              <ResultPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  );
}
