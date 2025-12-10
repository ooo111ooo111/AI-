import { Link } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { inviteService } from '../services/inviteService';
import { quantService } from '../services/quantService';
import { API_BASE_URL } from '../services/api';
import type {
  GateAccountInfo,
  GatePosition,
  InvitationStatus,
  QuantStatus,
  StrategyEvent,
  StrategyInstance,
  StrategyPerformanceResponse,
  StrategyRunLog,
} from '../types';
import { formatDate } from '../utils/helpers';

const formatNumber = (value?: string | number | null) => {
  if (value === undefined || value === null || value === '') return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
};

const formatPercent = (value?: string | number | null) => {
  if (value === undefined || value === null || value === '') return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return `${(num * 100).toFixed(2)}%`;
};

const formatPercentLabel = (value?: string | number | null) => {
  if (typeof value === 'string' && value.includes('%')) {
    return value;
  }
  return formatPercent(value);
};

const parseNumeric = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const getPositionSideMeta = (sizeValue?: string | number) => {
  const size = parseNumeric(sizeValue) || 0;
  if (size > 0) {
    return { label: '多', badgeClass: 'bg-emerald-500/20 text-emerald-300', colorClass: 'text-emerald-400' };
  }
  if (size < 0) {
    return { label: '空', badgeClass: 'bg-rose-500/20 text-rose-300', colorClass: 'text-rose-400' };
  }
  return { label: '观望', badgeClass: 'bg-gray-700 text-gray-300', colorClass: 'text-gray-300' };
};

const getLeverageLabel = (position: GatePosition) => {
  const leverage = parseNumeric(position.leverage);
  if (leverage && leverage > 0) return `${leverage}x`;
  const fallback = parseNumeric(position.cross_leverage_limit ?? position.leverage_max);
  return fallback ? `${fallback}x` : null;
};

const getRoiValue = (position: GatePosition) => {
  const provided = parseNumeric(position.unrealised_pnl_rate ?? position.pnl_rate);
  if (provided !== null) return provided;
  const pnl = parseNumeric(position.unrealised_pnl ?? position.unrealised_point ?? position.pnl);
  if (pnl === null) return null;
  const base = parseNumeric(
    position.initial_margin ?? position.margin ?? position.position_margin ?? position.value
  );
  if (!base || base === 0) return null;
  return pnl / base;
};

const getPositionNotionalValue = (position: GatePosition) => {
  const candidates = [
    position.value,
    position.position_value,
    position.notional,
    position.notional_value,
  ];
  for (const raw of candidates) {
    const numeric = parseNumeric(raw);
    if (numeric && numeric !== 0) {
      return Math.abs(numeric);
    }
  }
  const mark = parseNumeric(position.mark_price) ?? parseNumeric(position.last_price);
  if (mark && Number.isFinite(mark)) {
    const size = parseNumeric(position.size);
    if (size) {
      return Math.abs(mark * size);
    }
  }
  const entry = parseNumeric(position.entry_price);
  if (entry && Number.isFinite(entry)) {
    const size = parseNumeric(position.size);
    if (size) {
      return Math.abs(entry * size);
    }
  }
  return null;
};

const formatPercentValue = (value?: number | null) => {
  if (value === undefined || value === null || value <= 0) return '未设置';
  const precise = Number(value) % 1 ? Number(value).toFixed(1) : Number(value).toFixed(0);
  return `${precise}%`;
};

const getAccountModeLabel = (account?: GateAccountInfo | null) => {
  if (!account) return null;
  if (account.margin_mode_name) {
    return account.margin_mode_name.toUpperCase();
  }
  if (typeof account.margin_mode === 'number') {
    return account.margin_mode === 1 ? '全仓' : '逐仓';
  }
  return null;
};

type StrategyEventItem = StrategyEvent & { receivedAt: string };
type StrategyRunEventItem = Extract<StrategyEvent, { type: 'strategy:run' }>;

const isStrategyRunEvent = (event: StrategyEvent): event is StrategyRunEventItem =>
  event.type === 'strategy:run';

const describeEvent = (event: StrategyEvent) => {
  if (isStrategyRunEvent(event)) {
    const action = event.payload.strategy.action;
    const price = formatNumber(event.payload.market?.lastPrice);
    return `执行 ${event.payload.strategy.name} · ${action.toUpperCase()} @ ${price}`;
  }
  if (event.type === 'strategy:error') {
    return `策略异常: ${event.error}`;
  }
  return `状态变更: ${event.status}`;
};

const shouldDisplayEvent = (_event: StrategyEvent) => true;

const getNestedValue = (obj: any, path: string) => {
  const segments = path.split('.');
  let current = obj;
  for (const segment of segments) {
    if (current == null) return null;
    current = current[segment];
  }
  if (current && typeof current === 'object' && 'value' in current) {
    return current.value;
  }
  return current ?? null;
};

const pickAccountValue = (account: GateAccountInfo, paths: string[]) => {
  for (const path of paths) {
    const raw = getNestedValue(account, path);
    if (raw !== null && raw !== undefined && raw !== '') {
      return raw;
    }
  }
  return null;
};

type AccountMetric = { label: string; value: any; format?: 'percent' };

export default function QuantMonitorPage() {
  const [loading, setLoading] = useState(true);
  const [inviteStatus, setInviteStatus] = useState<InvitationStatus | null>(null);
  const [quantStatus, setQuantStatus] = useState<QuantStatus | null>(null);
  const [accountInfo, setAccountInfo] = useState<GateAccountInfo | null>(null);
  const [positions, setPositions] = useState<GatePosition[]>([]);
  const [strategyInstances, setStrategyInstances] = useState<StrategyInstance[]>([]);
  const [strategyEvents, setStrategyEvents] = useState<StrategyEventItem[]>([]);
  const [settle, setSettle] = useState('usdt');
  const [accountError, setAccountError] = useState<string | null>(null);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [instanceError, setInstanceError] = useState<string | null>(null);
  const [deletingInstanceId, setDeletingInstanceId] = useState<string | null>(null);
  const [startingInstanceId, setStartingInstanceId] = useState<string | null>(null);
  const [stoppingInstanceId, setStoppingInstanceId] = useState<string | null>(null);
  const [performanceData, setPerformanceData] = useState<Record<string, StrategyPerformanceResponse>>({});
  const [performanceLoading, setPerformanceLoading] = useState<string | null>(null);
  const [performanceError, setPerformanceError] = useState<string | null>(null);
  const [runLogs, setRunLogs] = useState<StrategyRunLog[]>([]);
  const [runLogsLoading, setRunLogsLoading] = useState(false);
  const [runLogsError, setRunLogsError] = useState<string | null>(null);
  const [runLogModalInstance, setRunLogModalInstance] = useState<StrategyInstance | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [instancesLoading, setInstancesLoading] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const wsUrl = useMemo(() => {
    try {
      const base = API_BASE_URL || window.location.origin;
      const normalizedBase = base.startsWith('http') ? base : `${window.location.origin}${base}`;
      const trimmed = normalizedBase.replace(/\/$/, '').replace(/\/api$/, '');
      const protocol = trimmed.startsWith('https') ? 'wss' : 'ws';
      if (trimmed.startsWith('http')) {
        return `${trimmed.replace(/^https?/, protocol)}/ws/quant`;
      }
      const fallbackProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      return `${fallbackProtocol}://${window.location.host}/ws/quant`;
    } catch (error) {
      console.error('构建 WebSocket 地址失败', error);
      const fallbackProtocol = typeof window !== 'undefined' && window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = typeof window !== 'undefined' ? window.location.host : 'localhost:3000';
      return `${fallbackProtocol}://${host}/ws/quant`;
    }
  }, []);

  useEffect(() => {
    loadStatuses();
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!inviteStatus?.hasAccess) {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      setWsConnected(false);
      setStrategyEvents([]);
      return;
    }

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => setWsConnected(true);
    ws.onclose = () => setWsConnected(false);
    ws.onerror = () => setWsConnected(false);
    ws.onmessage = (event) => {
      try {
        const data: StrategyEvent = JSON.parse(event.data);
        if (!shouldDisplayEvent(data)) {
          return;
        }
        const item: StrategyEventItem = { ...data, receivedAt: new Date().toISOString() };
        setStrategyEvents((prev) => [item, ...prev].slice(0, 50));
      } catch (error) {
        console.error('解析策略事件失败', error);
      }
    };

    return () => {
      ws.close();
      setWsConnected(false);
    };
  }, [inviteStatus?.hasAccess, wsUrl]);

  useEffect(() => {
    if (!quantStatus?.gate?.isConnected) return undefined;
    const timer = window.setInterval(() => {
      refreshGateData(settle, true);
    }, 180000);
    return () => window.clearInterval(timer);
  }, [quantStatus?.gate?.isConnected, settle]);

  useEffect(() => {
    if (!quantStatus?.gate?.isConnected) return undefined;
    const timer = window.setInterval(() => {
      fetchPositions(settle);
    }, 60000);
    return () => window.clearInterval(timer);
  }, [quantStatus?.gate?.isConnected, settle]);

  const loadStatuses = async () => {
    setLoading(true);
    try {
      const [invite, quant] = await Promise.all([
        inviteService.getStatus(),
        quantService.getStatus(),
      ]);
      setInviteStatus(invite);
      setQuantStatus(quant);

      if (quant.hasAccess && quant.gate?.isConnected) {
        await refreshGateData(settle, true, quant.hasAccess);
      } else {
        setAccountInfo(null);
        setPositions([]);
      }
      await loadStrategyInstances(invite.hasAccess);
    } catch (error) {
      console.error('加载量化数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  const refreshGateData = async (
    settleValue: string,
    includePrivate: boolean,
    hasAccessOverride?: boolean
  ) => {
    const canQuery = hasAccessOverride ?? inviteStatus?.hasAccess ?? quantStatus?.hasAccess;
    if (!canQuery || !quantStatus?.gate?.isConnected) {
      return;
    }

    if (includePrivate) {
      await Promise.all([fetchAccount(settleValue), fetchPositions(settleValue)]);
    }
  };

  const fetchAccount = async (settleValue: string) => {
    setAccountError(null);
    try {
      const account = await quantService.getAccount(settleValue);
      setAccountInfo(account);
    } catch (error: any) {
      console.error('获取账户信息失败', error);
      setAccountError(error?.response?.data?.message || '获取账户信息失败');
    }
  };

  const fetchPositions = async (settleValue: string) => {
    setPositionsError(null);
    try {
      const data = await quantService.getPositions(settleValue);
      setPositions(data);
    } catch (error: any) {
      console.error('获取仓位失败', error);
      setPositionsError(error?.response?.data?.message || '获取持仓失败');
    }
  };

  const loadStrategyInstances = async (hasAccessOverride?: boolean) => {
    const canLoad = hasAccessOverride ?? inviteStatus?.hasAccess;
    if (!canLoad) {
      setStrategyInstances([]);
      return;
    }
    setInstancesLoading(true);
    setInstanceError(null);
    try {
      const data = await quantService.getStrategyInstances();
      setStrategyInstances(data);
    } catch (error: any) {
      console.error('获取策略实例失败', error);
      setInstanceError(error?.response?.data?.message || '获取策略实例失败');
    } finally {
      setInstancesLoading(false);
    }
  };

  const handleDeleteInstance = async (instanceId: string) => {
    if (deletingInstanceId) return;
    const confirmDelete = window.confirm('确认删除该策略实例吗? 删除后将不再自动运行。');
    if (!confirmDelete) return;
    setInstanceError(null);
    setDeletingInstanceId(instanceId);
    try {
      await quantService.deleteStrategyInstance(instanceId);
      setStrategyInstances((prev) => prev.filter((item) => item._id !== instanceId));
    } catch (error: any) {
      console.error('删除策略实例失败', error);
      setInstanceError(error?.response?.data?.message || '删除策略实例失败');
    } finally {
      setDeletingInstanceId(null);
    }
  };

  const handleStartInstance = async (instanceId: string) => {
    if (startingInstanceId) return;
    setInstanceError(null);
    setStartingInstanceId(instanceId);
    try {
      await quantService.startStrategyInstance(instanceId);
      await loadStrategyInstances();
    } catch (error: any) {
      console.error('启动策略实例失败', error);
      setInstanceError(error?.response?.data?.message || '运行策略实例失败');
    } finally {
      setStartingInstanceId(null);
    }
  };

  const handleStopInstance = async (instanceId: string) => {
    if (stoppingInstanceId) return;
    setInstanceError(null);
    setStoppingInstanceId(instanceId);
    try {
      await quantService.stopStrategyInstance(instanceId);
      setStrategyInstances((prev) =>
        prev.map((item) => (item._id === instanceId ? { ...item, status: 'stopped' } : item))
      );
    } catch (error: any) {
      console.error('停止策略实例失败', error);
      setInstanceError(error?.response?.data?.message || '停止策略实例失败');
    } finally {
      setStoppingInstanceId(null);
    }
  };

  const loadPerformance = async (instanceId: string) => {
    try {
      setPerformanceError(null);
      setPerformanceLoading(instanceId);
      const data = await quantService.getStrategyPerformance(instanceId);
      setPerformanceData((prev) => ({ ...prev, [instanceId]: data }));
    } catch (error: any) {
      console.error('加载收益数据失败', error);
      setPerformanceError(error?.response?.data?.message || '加载收益数据失败');
    } finally {
      setPerformanceLoading(null);
    }
  };

  const openRunLogModal = async (instance: StrategyInstance) => {
    setRunLogModalInstance(instance);
    setRunLogs([]);
    setRunLogsError(null);
    setRunLogsLoading(true);
    try {
      const logs = await quantService.getStrategyRunLogs(instance._id, 100);
      setRunLogs(logs);
    } catch (error: any) {
      console.error('加载执行记录失败', error);
      setRunLogsError(error?.response?.data?.message || '加载执行记录失败');
    } finally {
      setRunLogsLoading(false);
    }
  };

  const closeRunLogModal = () => {
    setRunLogModalInstance(null);
    setRunLogsError(null);
    setRunLogs([]);
  };

  const accountMetrics = useMemo(() => {
    if (!accountInfo) return [] as AccountMetric[];
    const metrics: AccountMetric[] = [
      {
        label: '总余额',
        value: pickAccountValue(accountInfo, ['total.value', 'total', 'margin_balance', 'cross_margin_balance']),
      },
      {
        label: '可用余额',
        value: pickAccountValue(accountInfo, ['available', 'cross_available']),
      },
      {
        label: '仓位初始保证金',
        value: pickAccountValue(accountInfo, ['initial_margin', 'cross_initial_margin']),
      },
    ];
    return metrics.filter((metric) => metric.value !== null && metric.value !== undefined);
  }, [accountInfo]);

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner message="加载量化监控数据..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold text-white">量化监控面板</h1>
          <p className="text-gray-400 text-sm">
            集中查看账户权益、持仓与策略执行历史。如需调参请返回主控制台。
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/quant"
            className="px-4 py-2 rounded-lg border border-white/20 text-sm text-gray-200 hover:text-white"
          >
            返回量化控制台
          </Link>
          <button
            onClick={() => refreshGateData(settle, true)}
            disabled={!quantStatus?.gate?.isConnected}
            className={`px-4 py-2 rounded-lg border ${
              quantStatus?.gate?.isConnected
                ? 'border-gray-700 text-gray-200 hover:border-gray-500'
                : 'border-gray-800 text-gray-500 cursor-not-allowed'
            }`}
          >
            手动刷新
          </button>
        </div>
      </div>

      {!inviteStatus?.hasAccess && (
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded-2xl p-4 text-sm text-yellow-300">
          请返回量化控制台完成邀请码验证后再查看监控信息。
        </div>
      )}

      {!quantStatus?.gate?.isConnected && inviteStatus?.hasAccess && (
        <div className="bg-blue-500/10 border border-blue-500/40 rounded-2xl p-4 text-sm text-blue-200">
          尚未绑定 Gate API 凭证，无法展示账户和仓位数据。
        </div>
      )}

      {quantStatus?.gate?.isConnected && (
        <div className="space-y-4">
          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-white">账户概览</h2>
                <p className="text-sm text-gray-400">结算方式决定查询永续合约的钱包</p>
                <div className="flex flex-wrap gap-2 mt-2 text-xs text-gray-400">
                  {getAccountModeLabel(accountInfo) && (
                    <span className="px-2 py-1 rounded-full bg-gray-800 border border-gray-700">
                      模式 {getAccountModeLabel(accountInfo)}
                    </span>
                  )}
                  {accountInfo?.currency && (
                    <span className="px-2 py-1 rounded-full bg-gray-800 border border-gray-700">
                      计价 {String(accountInfo.currency).toUpperCase()}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                <select
                  value={settle}
                  onChange={(e) => {
                    const next = e.target.value;
                    setSettle(next);
                    refreshGateData(next, true);
                  }}
                  className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white"
                >
                  <option value="usdt">USDT 永续</option>
                  <option value="btc">BTC 本位</option>
                </select>
              </div>
            </div>

            {accountError && <p className="text-sm text-red-400">{accountError}</p>}

            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              {accountMetrics.map((metric) => (
                <div key={metric.label} className="bg-gray-800/60 border border-gray-700 rounded-xl p-3">
                  <p className="text-xs text-gray-400">{metric.label}</p>
                  <p className="text-lg font-semibold text-white mt-1">
                    {metric.format === 'percent'
                      ? formatPercentLabel(metric.value)
                      : formatNumber(metric.value)}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-white">当前持仓</h2>
              <p className="text-xs text-gray-500">每 1 分钟自动刷新 · {positions.length} 条</p>
            </div>
            {positionsError && <p className="text-sm text-red-400">{positionsError}</p>}
            {positions.length ? (
              <div className="space-y-4">
                {positions.map((position, index) => {
                  const key = position.id || position.position_id || `${position.contract}-${index}`;
                  const sideMeta = getPositionSideMeta(position.size);
                  const pnlValue = parseNumeric(
                    position.unrealised_pnl ?? position.unrealised_point ?? position.pnl
                  );
                  const roiValue = getRoiValue(position);
                  const notionalValue = getPositionNotionalValue(position);
                  const pnlColor = pnlValue === null
                    ? 'text-white'
                    : pnlValue > 0
                    ? 'text-emerald-400'
                    : pnlValue < 0
                    ? 'text-rose-400'
                    : 'text-white';
                  const roiColor = roiValue === null
                    ? 'text-white'
                    : roiValue > 0
                    ? 'text-emerald-400'
                    : roiValue < 0
                    ? 'text-rose-400'
                    : 'text-white';
                  const mmrValue = position.mmr ?? position.maintenance_rate;
                  const leverageLabel = getLeverageLabel(position);
                  return (
                    <div key={key} className="bg-gray-800/70 border border-gray-700 rounded-2xl p-4 space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <p className="text-lg font-semibold text-white">{position.contract}</p>
                          <div className="flex flex-wrap gap-2 mt-3 text-xs">
                            <span className={`px-2 py-1 rounded-full font-medium ${sideMeta.badgeClass}`}>
                              {sideMeta.label}
                            </span>
                            {leverageLabel && (
                              <span className="px-2 py-1 rounded-full bg-gray-700 text-gray-300">{leverageLabel}</span>
                            )}
                            <span className="px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                              张数 {formatNumber(Math.abs(parseNumeric(position.size) || 0))}
                            </span>
                            {notionalValue && (
                              <span className="px-2 py-1 rounded-full bg-gray-700 text-gray-300">
                                U 成本 {formatNumber(notionalValue)}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right space-y-2">
                          <div>
                            <p className="text-sm text-gray-400">收益率</p>
                            <p className={`text-2xl font-semibold ${roiColor}`}>
                              {formatPercentLabel(roiValue)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm text-gray-400">未实现盈亏 (USDT)</p>
                            <p className={`text-xl font-semibold ${pnlColor}`}>{formatNumber(pnlValue)}</p>
                          </div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm text-gray-300">
                        <div>
                          <p className="text-xs text-gray-500">保证金 (USDT)</p>
                          <p className="text-base font-semibold text-white">{formatNumber(position.initial_margin)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">开仓均价</p>
                          <p className="text-base font-semibold text-white">{formatNumber(position.entry_price)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">标记价格</p>
                          <p className="text-base font-semibold text-white">{formatNumber(position.mark_price)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">MMR</p>
                          <p className="text-base font-semibold text-white">{formatPercentLabel(mmrValue)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">预估强平价</p>
                          <p className="text-base font-semibold text-white">{formatNumber(position.liq_price)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">持仓方向</p>
                          <p className={`text-base font-semibold ${sideMeta.colorClass}`}>
                            {sideMeta.label === '观望' ? '—' : sideMeta.label === '多' ? '做多' : '做空'}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-gray-400">暂无持仓</p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold text-white">策略实例</h2>
              <p className="text-sm text-gray-400">运行中的自动策略与最近状态</p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs ${wsConnected ? 'bg-green-500/20 text-green-200' : 'bg-gray-800 text-gray-400'}`}>
                {wsConnected ? '事件已连接' : '等待事件'}
              </span>
              <button
                onClick={() => loadStrategyInstances()}
                className="px-3 py-1 border border-gray-600 rounded-lg text-sm text-gray-200 hover:border-gray-400"
              >
                刷新
              </button>
            </div>
          </div>
          {instanceError && <p className="text-sm text-red-400">{instanceError}</p>}
          {performanceError && <p className="text-sm text-red-400">{performanceError}</p>}
          {instancesLoading ? (
            <p className="text-sm text-gray-400">实例加载中...</p>
          ) : strategyInstances.length ? (
            <div className="space-y-3 max-h-[420px] overflow-y-auto pr-2">
              {strategyInstances.map((instance) => (
                <div key={instance._id} className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-white font-semibold">
                        {instance.strategyId} · {instance.config.contract} · {instance.config.interval}
                      </p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs ${
                        instance.status === 'running'
                          ? 'bg-emerald-500/20 text-emerald-200'
                          : 'bg-gray-700 text-gray-300'
                      }`}
                    >
                      {instance.status === 'running' ? '运行中' : '已停止'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm text-gray-300">
                    <p>最后信号: {instance.lastSignal || '--'}</p>
                    <p>上次运行: {instance.lastRunAt ? formatDate(instance.lastRunAt) : '--'}</p>
                    <p>张数: {instance.config.baseSize}</p>
                    <p>杠杆: {instance.config.leverage ? `${instance.config.leverage}x` : '--'}</p>
                    <p>频率: {Math.round((instance.config.frequencyMs || 60000) / 1000)} 秒</p>
                    <p>
                      自动下单:
                      <span className={instance.config.autoExecute ? 'text-emerald-400 ml-1' : 'text-gray-400 ml-1'}>
                        {instance.config.autoExecute ? '已开启' : '未开启'}
                      </span>
                    </p>
                    <p>
                      止盈/止损:
                      <span className="ml-1 text-gray-200">
                        {formatPercentValue(instance.config.takeProfitPct)} / {formatPercentValue(instance.config.stopLossPct)}
                      </span>
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        onClick={() => loadPerformance(instance._id)}
                        disabled={performanceLoading === instance._id}
                        className={`px-3 py-1 text-sm rounded-lg border ${
                          performanceLoading === instance._id
                            ? 'border-blue-500/40 text-blue-200 cursor-not-allowed'
                            : 'border-blue-500/40 text-blue-300 hover:bg-blue-500/10'
                        }`}
                      >
                        {performanceLoading === instance._id ? '加载收益...' : '查看收益'}
                      </button>
                      <button
                        onClick={() => openRunLogModal(instance)}
                        className="px-3 py-1 text-sm rounded-lg border border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                      >
                        执行记录
                      </button>
                      <button
                        onClick={() => handleStartInstance(instance._id)}
                        disabled={
                          instance.status === 'running' ||
                          startingInstanceId === instance._id ||
                          deletingInstanceId === instance._id ||
                          stoppingInstanceId === instance._id
                        }
                        className={`px-3 py-1 text-sm rounded-lg border ${
                          instance.status === 'running' || startingInstanceId === instance._id
                            ? 'border-emerald-500/40 text-emerald-200 cursor-not-allowed'
                            : 'border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10'
                        }`}
                      >
                        {startingInstanceId === instance._id
                          ? '启动中...'
                          : instance.status === 'running'
                          ? '运行中'
                          : '运行实例'}
                      </button>
                      <button
                        onClick={() => handleStopInstance(instance._id)}
                        disabled={
                          instance.status !== 'running' ||
                          stoppingInstanceId === instance._id ||
                          deletingInstanceId === instance._id
                        }
                        className={`px-3 py-1 text-sm rounded-lg border ${
                          instance.status !== 'running' || stoppingInstanceId === instance._id
                            ? 'border-yellow-500/40 text-yellow-200 cursor-not-allowed'
                            : 'border-yellow-500/40 text-yellow-300 hover:bg-yellow-500/10'
                        }`}
                      >
                        {stoppingInstanceId === instance._id ? '停止中...' : '停止实例'}
                      </button>
                      <button
                        onClick={() => handleDeleteInstance(instance._id)}
                        disabled={
                          deletingInstanceId === instance._id ||
                          startingInstanceId === instance._id ||
                          stoppingInstanceId === instance._id
                        }
                        className={`px-3 py-1 text-sm rounded-lg border ${
                          deletingInstanceId === instance._id
                            ? 'border-red-500/40 text-red-200 cursor-not-allowed'
                            : 'border-red-500/40 text-red-300 hover:bg-red-500/10'
                        }`}
                      >
                        {deletingInstanceId === instance._id ? '删除中...' : '删除实例'}
                      </button>
                    </div>
                    {performanceData[instance._id] && (
                      <div className="mt-3 text-left bg-gray-900/50 border border-gray-800 rounded-lg p-3 space-y-2 text-sm text-gray-300">
                        <div className="flex flex-wrap gap-4">
                          <span>
                            累计收益:
                            <span
                              className={`ml-1 ${
                                performanceData[instance._id].stats.totalPnL >= 0
                                  ? 'text-emerald-300'
                                  : 'text-rose-300'
                              }`}
                            >
                              {performanceData[instance._id].stats.totalPnL.toFixed(2)}
                            </span>
                          </span>
                          <span>
                            累计收益率: {(performanceData[instance._id].stats.totalReturn * 100).toFixed(2)}%
                          </span>
                          <span>胜率: {performanceData[instance._id].stats.winRate}%</span>
                          <span>交易数: {performanceData[instance._id].stats.tradeCount}</span>
                        </div>
                        {performanceData[instance._id].trades.length > 0 && (
                          <div className="space-y-1 text-xs text-gray-400">
                            <p>最近交易</p>
                            {performanceData[instance._id].trades.slice(0, 3).map((trade) => {
                              const tradeNotional = (trade.notional ?? trade.size * trade.entryPrice) || 0 ;
                              const coinQty = trade.entryPrice ? Math.abs(tradeNotional / trade.entryPrice) : Math.abs(trade.size);
                              return (
                                <div key={trade._id} className="flex items-center justify-between">
                                  <span>
                                    {trade.direction === 'long' ? '做多' : '做空'} · 张数 {coinQty.toFixed(4)} · U 成本 {tradeNotional.toFixed(2)} USDT · @ {trade.entryPrice.toFixed(2)} → {trade.exitPrice.toFixed(2)}
                                  </span>
                                  <span className={trade.pnl >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
                                    {trade.pnl.toFixed(2)} / {(trade.returnPct * 100).toFixed(2)}%
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">暂无自动策略实例</p>
          )}

          {strategyEvents.length ? (
            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-2">
              {strategyEvents.map((event) => (
                <div key={`${event.instanceId}-${event.receivedAt}`} className="bg-gray-800/60 border border-gray-700 rounded-lg p-3">
                  <div className="flex items-center justify-between text-xs text-gray-600">
                    <span>{isStrategyRunEvent(event) ? event.payload.strategy.name : '实例事件'}</span>
                    <span>{formatDate(event.receivedAt)}</span>
                  </div>
                  <p className="text-sm text-white mt-1">{describeEvent(event)}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">暂无事件</p>
          )}
        </div>
      </div>
      {runLogModalInstance && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
              <div>
                <h3 className="text-xl text-white font-semibold">执行记录 · {runLogModalInstance.strategyId}</h3>
                <p className="text-sm text-gray-400">
                  {runLogModalInstance.config.contract} · {runLogModalInstance.config.interval}
                </p>
              </div>
              <button
                onClick={closeRunLogModal}
                className="text-gray-400 hover:text-white text-2xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
              {runLogsLoading ? (
                <p className="text-sm text-gray-400">执行记录加载中...</p>
              ) : runLogsError ? (
                <p className="text-sm text-red-400">{runLogsError}</p>
              ) : runLogs.length ? (
                runLogs.map((log) => (
                  <div key={log._id} className="border border-gray-800 rounded-lg p-3 bg-gray-800/60">
                    <div className="flex items-center justify-between text-xs text-gray-400">
                      <span>{formatDate(log.startedAt)}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] uppercase ${
                          log.status === 'success'
                            ? 'bg-emerald-500/20 text-emerald-200'
                            : log.status === 'error'
                            ? 'bg-rose-500/20 text-rose-200'
                            : 'bg-gray-700 text-gray-200'
                        }`}
                      >
                        {log.status === 'success'
                          ? '完成'
                          : log.status === 'error'
                          ? '失败'
                          : '运行中'}
                      </span>
                    </div>
                    <p className="text-gray-100 mt-1">
                      动作: {log.action ?? '--'} · {log.shouldTrade ? '触发' : '观望'} ·{' '}
                      {log.autoExecute ? '自动执行' : '仅提示'}
                    </p>
                    {log.orderId && (
                      <p className="text-xs text-gray-400">订单号: {log.orderId}</p>
                    )}
                    {log.errorMessage && (
                      <p className="text-xs text-red-400">错误: {log.errorMessage}</p>
                    )}
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-400">暂无执行记录</p>
              )}
            </div>
            <div className="px-6 py-4 border-t border-gray-800 text-right">
              <button
                onClick={closeRunLogModal}
                className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-200"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
