import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL } from '../services/api';

export default function LoginPage() {
  const [searchParams] = useSearchParams();
  const error = searchParams.get('error');

  const handleGoogleLogin = () => {
    // 跳转到后端 Google 登录接口
    window.location.href = `${API_BASE_URL}/auth/google`;
  };

  const handleQQLogin = () => {
    window.location.href = `${API_BASE_URL}/auth/qq`;
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">
            AI 交易分析系统
          </h1>
          <p className="text-gray-600">请选择登录方式</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-600 text-sm">
              {error === 'google_auth_failed' && 'Google 登录失败，请重试'}
              {error === 'qq_auth_failed' && 'QQ 登录失败，请重试'}
            </p>
          </div>
        )}

        <div className="space-y-4">
          {/* Google 登录按钮 */}
          <button
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            <span className="font-medium text-gray-700">使用 Google 登录</span>
          </button>

          {/* QQ 登录按钮 */}
          <button
            onClick={handleQQLogin}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-[#12B7F5] text-white rounded-lg hover:bg-[#0FA8E6] transition-colors"
          >
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
              <path d="M21.395 15.035a39.548 39.548 0 0 0-.803-2.264l-1.079-2.695c.001-.032.014-.562.014-.836C19.527 4.632 17.086 2 12 2S4.473 4.632 4.473 9.24c0 .274.013.804.014.836l-1.08 2.695a39.548 39.548 0 0 0-.802 2.264c-.265 1.025-.378 1.699-.38 1.711 0 .727.442 1.254.978 1.254.305 0 .572-.134.768-.365 2.015 1.239 4.562 1.91 7.029 1.91s5.014-.671 7.029-1.91c.196.231.463.365.768.365.536 0 .978-.527.978-1.254-.002-.012-.115-.686-.38-1.711z" />
            </svg>
            <span className="font-medium">使用 QQ 登录</span>
          </button>
        </div>

        <div className="mt-8 text-center text-sm text-gray-500">
          <p>登录即表示您同意我们的</p>
          <p>
            <a href="#" className="text-blue-600 hover:underline">服务条款</a>
            {' 和 '}
            <a href="#" className="text-blue-600 hover:underline">隐私政策</a>
          </p>
        </div>
      </div>
    </div>
  );
}
