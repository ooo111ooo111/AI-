import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import UploadZone from '../components/UploadZone';
import StrategySelector from '../components/StrategySelector';
import LoadingSpinner from '../components/LoadingSpinner';
import { analysisService } from '../services/analysisService';
import { symbolService } from '../services/symbolService';
import { generateCompressedBase64 } from '../utils/image';
import type { StrategyType, CryptoSymbol } from '../types';

const BASE64_LENGTH_LIMIT = 60000;
const COMPRESSION_PROFILES = [
  { maxDimension: 640, quality: 0.65 },
  { maxDimension: 512, quality: 0.55 },
  { maxDimension: 384, quality: 0.5 },
  { maxDimension: 320, quality: 0.45 },
  { maxDimension: 256, quality: 0.4 },
  { maxDimension: 192, quality: 0.3 },
  { maxDimension: 128, quality: 0.25 },
];

async function compressImageForAI(file: File) {
  let lastResult = '';

  for (const profile of COMPRESSION_PROFILES) {
    const base64 = await generateCompressedBase64(file, profile);
    lastResult = base64;

    if (base64.length <= BASE64_LENGTH_LIMIT) {
      return base64;
    }
  }

  return lastResult.length <= BASE64_LENGTH_LIMIT ? lastResult : null;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [selectedStrategy, setSelectedStrategy] = useState<StrategyType>('short-term');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [quota, setQuota] = useState<{ hasAccess: boolean; used: number; limit: number | null; remaining: number | null } | null>(null);
  const [quotaError, setQuotaError] = useState<string>('');
  const [symbolSuggestions, setSymbolSuggestions] = useState<CryptoSymbol[]>([]);
  const [symbolLoading, setSymbolLoading] = useState(false);
  const [symbolError, setSymbolError] = useState('');

  useEffect(() => {
    const symbolParam = searchParams.get('symbol');
    if (symbolParam) {
      setSelectedSymbol(symbolParam.toUpperCase());
    }
  }, [searchParams]);

  useEffect(() => {
    analysisService.getDailyQuota()
      .then(setQuota)
      .catch((err) => {
        console.error('获取配额失败', err);
        setQuotaError(err?.response?.data?.message || '无法获取今日配额');
      });
  }, []);

  useEffect(() => {
    setSymbolLoading(true);
    symbolService
      .getSymbols()
      .then((data) => {
        setSymbolSuggestions(data);
        setSymbolError('');
      })
      .catch((err) => {
        console.error('获取币种列表失败', err);
        setSymbolError('无法加载常用币种，可直接输入任意币种。');
      })
      .finally(() => setSymbolLoading(false));
  }, []);

  const quotaReached: boolean = Boolean(
    quota && !quota.hasAccess && quota.remaining !== null && quota.remaining <= 0
  );

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('请上传图片');
      return;
    }

    if (!selectedSymbol.trim()) {
      setError('请输入币种或交易对，例如 BTC_USDT');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const compressedBase64 = await compressImageForAI(selectedFile);

      if (!compressedBase64) {
        setError('图片过大，压缩后仍超过限制，请裁剪或降低分辨率后重试');
        return;
      }

      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('symbol', selectedSymbol.trim().toUpperCase());
      formData.append('strategyType', selectedStrategy);
      formData.append('imageBase64', compressedBase64);

      const result = await analysisService.createAnalysis(formData);

      // 跳转到结果页
      navigate(`/result/${result._id}`);
    } catch (err: any) {
      console.error('分析失败:', err);
      setError(err.response?.data?.message || '分析失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full p-8 space-y-6">
      {loading && <LoadingSpinner />}

      {/* 页面标题 */}
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">新建分析</h1>
        <p className="text-gray-400">
          上传 K 线图,选择币种和策略,让 AI 为您分析市场趋势
        </p>
      </div>

      {/* 上传区域 */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
          上传图表
        </h2>
        <UploadZone
          onFileSelect={setSelectedFile}
          selectedFile={selectedFile}
        />
      </div>

      {/* 策略选择 */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 shadow-xl">
        <h2 className="text-lg font-semibold mb-4 text-gray-200 flex items-center gap-2">
          交易策略
        </h2>
        <StrategySelector
          selectedStrategy={selectedStrategy}
          onSelect={setSelectedStrategy}
        />
      </div>

      {/* 币种输入 */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 shadow-xl space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">分析币种 / 交易对</label>
          <input
            type="text"
            value={selectedSymbol}
            onChange={(e) => setSelectedSymbol(e.target.value.toUpperCase())}
            placeholder="例如 BTC_USDT、SOL/USDT 或 ETH"
            className="w-full px-4 py-3 rounded-xl bg-gray-900/70 border border-gray-700 text-white focus:outline-none focus:border-blue-500"
          />
          <p className="text-xs text-gray-500 mt-2">
            支持任意币种或合约标识，系统会直接把您的输入传递给 AI。
          </p>
        </div>
        {symbolError && <p className="text-xs text-red-400">{symbolError}</p>}
        {!symbolError && (
          <div>
            <p className="text-xs text-gray-400 mb-2 flex items-center gap-2">
              常用币种 {symbolLoading && <span className="text-gray-500">(加载中...)</span>}
            </p>
            <div className="flex flex-wrap gap-2">
              {symbolSuggestions.slice(0, 10).map((symbol) => (
                <button
                  type="button"
                  key={symbol.symbol}
                  onClick={() => setSelectedSymbol(symbol.symbol.toUpperCase())}
                  className={`px-3 py-1 rounded-full border text-sm transition ${
                    selectedSymbol === symbol.symbol.toUpperCase()
                      ? 'border-blue-500 text-blue-300 bg-blue-500/10'
                      : 'border-gray-600 text-gray-300 hover:border-gray-400'
                  }`}
                >
                  {symbol.icon} {symbol.symbol}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <span>{error}</span>
        </div>
      )}

      {/* 分析按钮 */}
      <button
        onClick={handleAnalyze}
        disabled={!selectedFile || !selectedSymbol.trim() || loading || quotaReached}
        className={`
          w-full py-5 rounded-xl font-bold text-xl
          transition-all duration-300 transform
          ${selectedFile && selectedSymbol && !loading
            ? 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white cursor-pointer shadow-lg hover:shadow-xl hover:scale-[1.02]'
            : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }
        `}
      >
        {loading ? (
          <span className="flex items-center justify-center gap-3">
            <span className="w-6 h-6 border-3 border-white border-t-transparent rounded-full animate-spin"></span>
            AI分析中...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            开始分析
          </span>
        )}
      </button>
      {quota && !quota.hasAccess && (
        <p className="text-xs text-gray-500 text-center">
          今日剩余 {quota.remaining} / {quota.limit} 次免费分析，填写邀请码可解除限制。
        </p>
      )}
      {quotaError && (
        <p className="text-xs text-red-400 text-center">{quotaError}</p>
      )}

      {/* 说明 */}
      <div className="bg-gray-800/30 rounded-xl border border-gray-700/50 p-6 space-y-3">
        <h3 className="font-semibold text-gray-300 flex items-center gap-2">
          使用提示
        </h3>
        <ul className="space-y-2 text-sm text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-blue-400 mt-1">•</span>
            <span>请上传清晰的 K 线图或走势图以获得更准确的分析结果</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-purple-400 mt-1">•</span>
            <span>长线策略适合耐心持仓,关注大趋势;短线策略需要频繁盯盘,追求快速盈利</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-pink-400 mt-1">•</span>
            <span>分析通常需要 10-30 秒,请耐心等待</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-1">•</span>
            <span>⚠️ AI分析仅供参考,不构成投资建议,请理性交易</span>
          </li>
        </ul>
      </div>
    </div>
  );
}
