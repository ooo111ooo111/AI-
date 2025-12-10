import { useState } from 'react';
import type { FormEvent } from 'react';
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import { quantService } from '../services/quantService';
import type { BacktestResponse } from '../types';

const STRATEGY_THRESHOLD_DEFAULTS: Record<string, number> = {
  'sai-scalper': 1.2,
  'mean-reversion': 2,
  'sma-trend': 0.8,
  'rsi-swing': 30,
  'ut-bot': 1,
};

const getDefaultThreshold = (strategyId: string) => STRATEGY_THRESHOLD_DEFAULTS[strategyId] ?? 1;

const STRATEGIES = [
  { id: 'sai-scalper', label: 'Sai Scalper Pro' },
  { id: 'mean-reversion', label: '均值回归' },
  { id: 'sma-trend', label: '单均线趋势' },
  { id: 'rsi-swing', label: 'RSI 摆动' },
  { id: 'ut-bot', label: 'UT Bot Alerts' },
];

const formatDateInput = (value: number) => {
  const date = new Date(value);
  const pad = (num: number) => String(num).padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mi = pad(date.getMinutes());
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
};

const normalizePercentInput = (value?: number | null) => {
  if (value === undefined || value === null) return undefined;
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) return undefined;
  return Math.min(num, 100);
};

const formatPercentValue = (value?: number | null) => {
  if (value === undefined || value === null || value <= 0) return '未设置';
  const precise = Number(value) % 1 ? Number(value).toFixed(1) : Number(value).toFixed(0);
  return `${precise}%`;
};

const EquityCurveChart = ({
  curve,
  initialCapital,
}: {
  curve?: { time: number; value: number }[];
  initialCapital?: number;
}) => {
  if (!curve || curve.length === 0) {
    return (
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
        <h3 className="text-lg font-semibold text-white mb-3">策略收益</h3>
        <p className="text-sm text-gray-400">暂无权益曲线数据。</p>
      </div>
    );
  }

  const data = curve.map((point) => ({ timestamp: point.time, value: Number(point.value) }));
  const formatAxisLabel = (value: number) =>
    new Date(value).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });

  return (
    <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">策略收益</h3>
        <p className="text-sm text-gray-400">
          {initialCapital !== undefined ? `初始资金 ${initialCapital.toFixed(2)} → ` : ''}
          终值 {data[data.length - 1].value.toFixed(2)}
        </p>
      </div>
      <div className="h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="equityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity={0.05} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1f2937" strokeDasharray="3 3" />
            <XAxis
              dataKey="timestamp"
              tickFormatter={formatAxisLabel}
              minTickGap={30}
              tick={{ fill: '#9ca3af', fontSize: 12 }}
            />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 12 }} width={70} domain={['auto', 'auto']} />
            <Tooltip
              labelFormatter={(value) => formatAxisLabel(Number(value))}
              formatter={(value: number) => [`${value.toFixed(2)} USDT`, '策略收益']}
              contentStyle={{ backgroundColor: '#111827', border: 'none', borderRadius: '0.75rem' }}
            />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0, fill: '#2563eb' }}
              fill="url(#equityGradient)"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-between text-xs text-gray-500">
        <span>{formatAxisLabel(data[0].timestamp)}</span>
        <span>{formatAxisLabel(data[data.length - 1].timestamp)}</span>
      </div>
    </div>
  );
};

export default function BacktestPanel() {
  const [form, setForm] = useState({
    strategyId: 'sai-scalper',
    contract: 'BTC_USDT',
    settle: 'usdt',
    interval: '5m',
    lookback: 50,
    threshold: getDefaultThreshold('sai-scalper'),
    baseSize: 1,
    leverage: 1,
    useHeikinAshi: false,
    initialCapital: 1000,
    startTime: formatDateInput(Date.now() - 24 * 60 * 60 * 1000),
    endTime: formatDateInput(Date.now()),
    takeProfitPct: undefined as number | undefined,
    stopLossPct: undefined as number | undefined,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BacktestResponse | null>(null);

  const resolveCoinQuantity = (trade: BacktestResponse['trades'][number]) => {
    if (!trade) return 0;
    const perContract = trade.contractSize ?? 1;
    return Math.abs((trade.size ?? 0) * perContract);
  };

  const handleInput = (key: string, value: any) => {
    setForm((prev) => {
      if (key === 'strategyId') {
        return { ...prev, strategyId: value, threshold: getDefaultThreshold(value) };
      }
      return { ...prev, [key]: value };
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setResult(null);
    try {
      const normalizedBase = Math.max(1, Math.floor(Number(form.baseSize) || 1));
      const normalizedLeverage = Math.max(1, Number(form.leverage) || 1);
      const normalizedTakeProfit = normalizePercentInput(form.takeProfitPct);
      const normalizedStopLoss = normalizePercentInput(form.stopLossPct);
      const resolvedThreshold = (() => {
        const numeric = Number(form.threshold);
        if (Number.isFinite(numeric) && numeric > 0) {
          return numeric;
        }
        return getDefaultThreshold(form.strategyId);
      })();
      const payload = {
        strategyId: form.strategyId,
        settle: form.settle,
        contract: form.contract.trim(),
        interval: form.interval,
        startTime: new Date(form.startTime).getTime(),
        endTime: new Date(form.endTime).getTime(),
        lookback: Number(form.lookback) || 50,
        threshold: resolvedThreshold,
        baseSize: normalizedBase,
        leverage: normalizedLeverage,
        useHeikinAshi: form.useHeikinAshi,
        initialCapital: Number(form.initialCapital) || 0,
        takeProfitPct: normalizedTakeProfit,
        stopLossPct: normalizedStopLoss,
      };
      const data = await quantService.runBacktest(payload);
      setResult(data);
    } catch (err: any) {
      console.error('回测失败', err);
      setError(err?.response?.data?.message || '回测失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-white">策略回测</h2>
          <p className="text-sm text-gray-400">选择策略与时间区间，模拟历史表现</p>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-sm text-gray-400">策略</label>
            <select
              value={form.strategyId}
              onChange={(e) => handleInput('strategyId', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            >
              {STRATEGIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">合约标识</label>
            <input
              type="text"
              value={form.contract}
              onChange={(e) => handleInput('contract', e.target.value.toUpperCase())}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">K 线周期</label>
            <select
              value={form.interval}
              onChange={(e) => handleInput('interval', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            >
              <option value="1m">1 分钟</option>
              <option value="5m">5 分钟</option>
              <option value="15m">15 分钟</option>
              <option value="1h">1 小时</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">张数</label>
            <input
              type="number"
              min={1}
              step={1}
              value={form.baseSize}
              onChange={(e) =>
                handleInput('baseSize', Math.max(1, Math.floor(Number(e.target.value) || 0)))
              }
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">杠杆</label>
            <input
              type="number"
              min={1}
              step={1}
              value={form.leverage}
              onChange={(e) => handleInput('leverage', Math.max(1, Number(e.target.value) || 1))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">止盈 (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.takeProfitPct ?? ''}
              onChange={(e) =>
                handleInput(
                  'takeProfitPct',
                  e.target.value === ''
                    ? undefined
                    : Math.min(Math.max(Number(e.target.value) || 0, 0), 100)
                )
              }
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">止损 (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={form.stopLossPct ?? ''}
              onChange={(e) =>
                handleInput(
                  'stopLossPct',
                  e.target.value === ''
                    ? undefined
                    : Math.min(Math.max(Number(e.target.value) || 0, 0), 100)
                )
              }
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">回看窗口</label>
            <input
              type="number"
              min={5}
              value={form.lookback}
              onChange={(e) => handleInput('lookback', Number(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">阈值 / Key Value</label>
            <input
              type="number"
              min={0.1}
              step={0.1}
              value={form.threshold}
              onChange={(e) => handleInput('threshold', Number(e.target.value))}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">开始时间</label>
            <input
              type="datetime-local"
              value={form.startTime}
              onChange={(e) => handleInput('startTime', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm text-gray-400">结束时间</label>
            <input
              type="datetime-local"
              value={form.endTime}
              onChange={(e) => handleInput('endTime', e.target.value)}
              className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
            />
          </div>
        </div>
        {form.strategyId === 'ut-bot' && (
          <div className="flex items-center gap-3">
            <input
              id="backtest-ha"
              type="checkbox"
              className="w-4 h-4"
              checked={form.useHeikinAshi}
              onChange={(e) => handleInput('useHeikinAshi', e.target.checked)}
            />
            <label htmlFor="backtest-ha" className="text-sm text-gray-300">
              使用 Heikin Ashi 价格
            </label>
          </div>
        )}
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-3 rounded-xl font-semibold text-lg ${
            loading ? 'bg-gray-800 text-gray-500 cursor-not-allowed' : 'bg-gradient-to-r from-blue-500 to-purple-500 text-white'
          }`}
        >
          {loading ? '回测中...' : '开始回测'}
        </button>
      </form>

      {result && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
              <p className="text-sm text-gray-400">累计收益</p>
              <p className={`text-2xl font-bold ${result.stats.totalPnL >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {result.stats.totalPnL.toFixed(2)}
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
              <p className="text-sm text-gray-400">累计收益率</p>
              <p className="text-2xl font-bold text-white">{(result.stats.totalReturn * 100).toFixed(2)}%</p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
              <p className="text-sm text-gray-400">胜率</p>
              <p className="text-2xl font-bold text-white">
                {result.stats.tradeCount ? ((result.stats.winTrades / result.stats.tradeCount) * 100).toFixed(2) : '0'}%
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
              <p className="text-sm text-gray-400">交易次数</p>
              <p className="text-2xl font-bold text-white">{result.stats.tradeCount}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
              <p className="text-sm text-gray-400">止盈参数</p>
              <p className="text-2xl font-bold text-white">
                {formatPercentValue(result.takeProfitPct ?? form.takeProfitPct)}
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
              <p className="text-sm text-gray-400">止损参数</p>
              <p className="text-2xl font-bold text-white">
                {formatPercentValue(result.stopLossPct ?? form.stopLossPct)}
              </p>
            </div>
            <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
              <p className="text-sm text-gray-400">杠杆</p>
              <p className="text-2xl font-bold text-white">{(result.leverage ?? form.leverage).toFixed(2)}x</p>
            </div>
          </div>

          <EquityCurveChart curve={result.equityCurve} initialCapital={result.initialCapital} />

          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-4">
            <h3 className="text-lg font-semibold text-white mb-3">最近交易</h3>
            {result.trades.length === 0 ? (
              <p className="text-sm text-gray-400">该区间内没有有效交易。</p>
            ) : (
              <div className="space-y-2">
                {result.trades.map((trade) => {
                  const coinQuantity = resolveCoinQuantity(trade);
                  const priceForCost = trade.entryPrice || 0;
                  const leverageValue = Math.max(1, result.leverage ?? form.leverage ?? 1);
                  const marginCost = leverageValue > 0 ? (coinQuantity * priceForCost) / leverageValue : 0;
                  return (
                    <div key={trade._id} className="flex flex-col md:flex-row md:items-center md:justify-between text-sm text-gray-300 gap-2">
                      <div>
                        <span className="font-medium">{trade.direction === 'long' ? '做多' : '做空'}</span>
                        <span className="ml-2 text-gray-400">
                          {new Date(trade.entryTime).toLocaleString()} → {new Date(trade.exitTime).toLocaleString()}
                          {' · '}张数 {coinQuantity.toFixed(4)}
                          {' · '}U 成本 {marginCost.toFixed(2)} USDT
                          {' · '}@ {trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}
                        </span>
                      </div>
                      <div className={trade.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                        {trade.pnl.toFixed(2)} / {(trade.returnPct * 100).toFixed(2)}%
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
