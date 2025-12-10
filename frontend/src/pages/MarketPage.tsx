import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { quantService } from '../services/quantService';
import type { GateContract } from '../types';

const toTradingViewSymbol = (contract: string) => `GATEIO:${contract.replace('_', '')}`;

const formatFundingRate = (value?: string) => {
  if (value === undefined || value === null) return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return value;
  return `${(num * 100).toFixed(4)}%`;
};

export default function MarketPage() {
  const [settle, setSettle] = useState<'usdt' | 'btc'>('usdt');
  const [symbolInput, setSymbolInput] = useState('BTC_USDT');
  const [contract, setContract] = useState<GateContract | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFullscreen, setShowFullscreen] = useState(false);
  const [viewportHeight, setViewportHeight] = useState(
    typeof window !== 'undefined' ? window.innerHeight : 900
  );

  useEffect(() => {
    const handleResize = () => {
      setViewportHeight(window.innerHeight);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const chartHeight = useMemo(() => {
    return Math.max(360, Math.min(720, viewportHeight * 0.55));
  }, [viewportHeight]);

  const fullscreenChartHeight = useMemo(() => {
    return Math.max(480, Math.min(960, viewportHeight - 120));
  }, [viewportHeight]);

  const chartSrc = useMemo(() => {
    const symbol = toTradingViewSymbol(contract?.name || 'BTC_USDT');
    return `https://s.tradingview.com/widgetembed/?frameElementId=tv_${symbol}&symbol=${symbol}&interval=60&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=rgba(0,0,0,0)&studies=[]&theme=dark&style=1`;
  }, [contract]);

  const handleSearch = async (override?: string) => {
    const input = override ?? symbolInput;
    if (!input.trim()) {
      setError('请输入合约名称（例如 BTC_USDT）');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let normalized = input.trim().toUpperCase();
      if (!normalized.includes('_')) {
        normalized = `${normalized}_${settle.toUpperCase()}`;
      }
      setSymbolInput(normalized);
      const result = await quantService.getContractDetail(settle, normalized);
      setContract(result);
    } catch (err: any) {
      console.error('查询合约失败', err);
      setContract(null);
      setError(err?.response?.data?.message || '查询失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleSearch('BTC_USDT');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (contract) {
      handleSearch(contract.name);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settle]);

  return (
    <div className="min-h-screen space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-white">合约行情 · K 线面板</h1>
        <p className="text-gray-400">手动输入合约标识 (如 BTC_USDT)，即可查看 Gate K 线与合约详情</p>
      </div>

      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-4">
          <div className="flex gap-3 flex-1">
            <select
              value={settle}
              onChange={(e) => setSettle(e.target.value as 'usdt' | 'btc')}
              className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white"
            >
              <option value="usdt">USDT 永续</option>
              <option value="btc">BTC 本位</option>
            </select>
            <input
              type="text"
              value={symbolInput}
              onChange={(e) => setSymbolInput(e.target.value)}
              placeholder="输入币种或合约，如 BTC 或 BTC_USDT"
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-xl text-white"
            />
          </div>
          <button
            onClick={() => handleSearch()}
            className="px-6 py-2 rounded-xl border border-white/20 text-gray-200 hover:text-white"
          >
            查询合约
          </button>
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between text-sm text-gray-400 gap-3">
            <p>当前：{contract?.name || '未查询'}</p>
            <div className="flex gap-2">
              <Link
                to={contract ? `/?symbol=${contract.name.split('_')[0]}` : '#'}
                className={`px-3 py-1 rounded-full border border-white/20 ${contract ? 'text-gray-200 hover:text-white' : 'text-gray-600 cursor-not-allowed pointer-events-none'}`}
              >
                发送至 AI 识图
              </Link>
              <button
                onClick={() => setShowFullscreen(true)}
                disabled={!contract}
                className={`px-3 py-1 rounded-full border border-white/20 ${contract ? 'text-gray-200 hover:text-white' : 'text-gray-600 cursor-not-allowed'}`}
              >
                全屏查看
              </button>
            </div>
          </div>
          <div
            className="w-full rounded-2xl border border-gray-800 bg-black flex items-center justify-center"
            style={{ height: chartHeight }}
          >
            {loading ? (
              <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
            ) : contract ? (
              <iframe
                key={chartSrc}
                title="TradingView"
                src={chartSrc}
                className="w-full h-full rounded-2xl"
                frameBorder="0"
              />
            ) : (
              <p className="text-sm text-gray-500">请先输入合约并点击查询</p>
            )}
          </div>
        </div>
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
          <h3 className="text-xl font-semibold text-white">{contract?.name || '合约详情'}</h3>
          {contract ? (
            <div className="space-y-2 text-sm text-gray-300">
              <p>结算方式：<span className="text-white">{settle.toUpperCase()}</span></p>
              <p>最新价格：<span className="text-white">{contract.last_price || '--'}</span></p>
              <p>Mark Price：<span className="text-white">{contract.mark_price || '--'}</span></p>
              <p>资金费率：<span className="text-white">{formatFundingRate(contract.funding_rate)}</span></p>
              <p>杠杆上限：<span className="text-white">{contract.leverage_max ?? '--'}x</span></p>
              <p>最小下单：<span className="text-white">{contract.order_size_min || '--'}</span></p>
              <p>Maker/Taker：<span className="text-white">{`${contract.maker_fee_rate} / ${contract.taker_fee_rate}`}</span></p>
              <p>乘数：<span className="text-white">{contract.quanto_multiplier ?? '--'}</span></p>
            </div>
          ) : (
            <p className="text-sm text-gray-500">查询后显示详细信息</p>
          )}
        </div>
      </div>

      {showFullscreen && contract && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4">
          <div className="relative w-full max-w-7xl bg-black rounded-2xl border border-gray-700 p-4 space-y-3">
            <div className="flex items-center justify-between text-gray-400">
              <p className="text-lg text-white">{contract.name}</p>
              <button
                onClick={() => setShowFullscreen(false)}
                className="px-4 py-2 border border-white/20 rounded-full"
              >
                退出全屏
              </button>
            </div>
            <iframe
              key={`full-${chartSrc}`}
              title="TradingView-Fullscreen"
              src={chartSrc}
              className="w-full rounded-xl border border-gray-800"
              style={{ height: fullscreenChartHeight }}
              frameBorder="0"
            />
          </div>
        </div>
      )}
    </div>
  );
}
