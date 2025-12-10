import { Link } from 'react-router-dom';
import { useEffect, useMemo, useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import BacktestPanel from '../components/BacktestPanel';
import { inviteService } from '../services/inviteService';
import { quantService } from '../services/quantService';
import type {
  GateContract,
  InvitationStatus,
  QuantStatus,
  QuantStrategyRunResponse,
} from '../types';
import { formatDate } from '../utils/helpers';

const formatNumber = (value?: string | number) => {
  if (value === undefined || value === null || value === '') return '--';
  const num = Number(value);
  if (Number.isNaN(num)) return String(value);
  return num.toLocaleString('zh-CN', { maximumFractionDigits: 4 });
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

const resolveContractPrice = (contract?: GateContract | null) => {
  if (!contract) return null;
  const priceFields = [
    contract.mark_price,
    contract.last_price,
    contract.index_price,
    contract.price,
  ];
  for (const raw of priceFields) {
    const price = Number(raw);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  }
  return null;
};

const resolveContractMultiplier = (contract?: GateContract | null) => {
  if (!contract) return 1;
  const candidates = [
    contract.quanto_multiplier,
    contract.quanto_base_margin_multiplier,
    contract.quanto_price_multiplier,
    contract.order_size_min,
  ];
  for (const raw of candidates) {
    const multiplier = Number(raw);
    if (Number.isFinite(multiplier) && multiplier > 0) {
      return multiplier;
    }
  }
  return 1;
};

const resolveContractMaxLeverage = (contract?: GateContract | null) => {
  if (!contract) return undefined;
  const candidates = [contract.leverage_max, contract.max_leverage, contract.cross_leverage_limit];
  for (const raw of candidates) {
    const leverage = Number(raw);
    if (Number.isFinite(leverage) && leverage > 0) {
      return leverage;
    }
  }
  return undefined;
};

const SESSION_BADGE_MAP: Record<string, string> = {
  PRIME: 'bg-purple-500/20 text-purple-200',
  GOOD: 'bg-green-500/20 text-green-200',
  SLOW: 'bg-yellow-500/20 text-yellow-200',
  AVOID: 'bg-red-500/20 text-red-200',
};

const getSessionBadgeClass = (quality?: string) => {
  if (!quality) return 'bg-gray-700 text-gray-200';
  return SESSION_BADGE_MAP[quality.toUpperCase()] || 'bg-gray-700 text-gray-200';
};

const STRATEGY_TEMPLATES: {
  id: string;
  label: string;
  description: string;
  highlights: string[];
  defaultThreshold: number;
  defaultLookback?: number;
}[] = [
  {
    id: 'sai-scalper',
    label: 'Sai Scalper Pro',
    description:
      '高频动量剥头皮策略, 关注 1-5 分钟的波动突破, 通过严格触发阈值与快速止盈止损锁定短期价差。',
    highlights: ['短线/快节奏', '善于捕捉动量', '默认使用 Z-Score 阈值'],
    defaultThreshold: 1.2,
  },
  {
    id: 'mean-reversion',
    label: '均值回归',
    description:
      '监控价格相对均值的偏离, 在震荡或回撤阶段寻找反转机会, 建议搭配更长的回看窗口与较高触发阈值过滤噪音。',
    highlights: ['区间震荡偏好', '更长回看窗口', '反向建仓'],
    defaultThreshold: 2,
    defaultLookback: 100,
  },
  {
    id: 'sma-trend',
    label: '单均线趋势',
    description:
      '以单条简单移动平均线作为趋势中枢, 价格上穿且均线走高时做多, 跌破并拐头向下时做空, 适合顺势交易者。',
    highlights: ['趋势跟随', '均线过滤噪音', '阈值代表与均线的%偏离'],
    defaultThreshold: 0.8,
    defaultLookback: 55,
  },
  {
    id: 'rsi-swing',
    label: 'RSI 摆动',
    description:
      '利用 RSI 超买超卖来捕捉短期反转, 默认 30/70 作为触发阈值, 适合震荡区间的回调参与。',
    highlights: ['RSI 指标', '超买超卖反转', '默认阈值 30/70'],
    defaultThreshold: 30,
    defaultLookback: 14,
  },
  {
    id: 'ut-bot',
    label: 'UT Bot Alerts',
    description:
      '基于 ATR Trailing Stop 的趋势跟随策略, 使用 Key Value × ATR 追踪止损, 趋势翻转时自动给出开平仓提示。',
    highlights: ['ATR 追踪止损', '趋势跟随', '支持 Heikin Ashi'],
    defaultThreshold: 1,
    defaultLookback: 10,
  },
  {
    id: 'test-short',
    label: '傻鸟空头测试',
    description:
      '仅用于接口自测, 每次触发都会按照设定张数直接做空, 不进行任何行情判断, 方便验证策略实例和 API 权限。',
    highlights: ['自动做空', '固定市价单', '用于排查链路'],
    defaultThreshold: 1,
    defaultLookback: 1,
  },
];

const getDefaultThresholdForStrategy = (strategyId: string) => {
  const template = STRATEGY_TEMPLATES.find((item) => item.id === strategyId);
  return template?.defaultThreshold ?? 1;
};

export default function QuantPage() {
  const [loading, setLoading] = useState(true);
  const [inviteStatus, setInviteStatus] = useState<InvitationStatus | null>(null);
  const [quantStatus, setQuantStatus] = useState<QuantStatus | null>(null);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [gateForm, setGateForm] = useState({ apiKey: '', apiSecret: '', passphrase: '', nickname: '' });
  const [gateMessage, setGateMessage] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [editingGate, setEditingGate] = useState(false);
  const defaultSaiTemplate = STRATEGY_TEMPLATES.find((item) => item.id === 'sai-scalper');
  const [strategyConfig, setStrategyConfig] = useState({
    strategyId: 'sai-scalper',
    settle: 'usdt',
    contract: '',
    interval: '5m',
    lookback: 50,
    threshold: defaultSaiTemplate?.defaultThreshold ?? 1,
    baseSize: 1,
    leverage: 1,
    autoExecute: false,
    frequencySeconds: 60,
    useHeikinAshi: false,
    takeProfitPct: undefined as number | undefined,
    stopLossPct: undefined as number | undefined,
  });
  const [strategyResult, setStrategyResult] = useState<QuantStrategyRunResponse | null>(null);
  const [strategyMessage, setStrategyMessage] = useState<string | null>(null);
  const [strategyError, setStrategyError] = useState<string | null>(null);
  const [runningStrategy, setRunningStrategy] = useState(false);
  const [creatingInstance, setCreatingInstance] = useState(false);
  const [contractCostHint, setContractCostHint] = useState<{
    price?: number;
    multiplier?: number;
    maxLeverage?: number;
  } | null>(null);
  const [contractHintLoading, setContractHintLoading] = useState(false);
  const normalizedBaseForEstimate = Math.max(1, Math.floor(Number(strategyConfig.baseSize) || 1));
  const estimatedUsdtCost =
    contractCostHint?.price && Number.isFinite(contractCostHint.price)
      ? normalizedBaseForEstimate * (contractCostHint.price || 0) * (contractCostHint.multiplier ?? 1)
      : null;

  const selectedStrategyMeta = useMemo(
    () => STRATEGY_TEMPLATES.find((item) => item.id === strategyConfig.strategyId),
    [strategyConfig.strategyId]
  );

  useEffect(() => {
    const template = STRATEGY_TEMPLATES.find((item) => item.id === strategyConfig.strategyId);
    if (!template) return;
    setStrategyConfig((prev) => {
      let next = prev;
      if (prev.threshold !== template.defaultThreshold) {
        next = { ...next, threshold: template.defaultThreshold };
      }
      if (template.defaultLookback && prev.lookback !== template.defaultLookback) {
        next = { ...next, lookback: template.defaultLookback };
      }
      const shouldUseHeikin = template.id === 'ut-bot' ? prev.useHeikinAshi : false;
      if (shouldUseHeikin !== prev.useHeikinAshi) {
        next = { ...next, useHeikinAshi: shouldUseHeikin };
      }
      return next;
    });
  }, [strategyConfig.strategyId]);


  useEffect(() => {
    loadStatuses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

const loadStatuses = async () => {
  setLoading(true);
  try {
    const [invite, quant] = await Promise.all([
      inviteService.getStatus(),
      quantService.getStatus(),
    ]);
    setInviteStatus(invite);
    setQuantStatus(quant);
  } catch (error) {
    console.error('加载邀请码或量化状态失败', error);
  } finally {
    setLoading(false);
  }
};

  useEffect(() => {
    let cancelled = false;
    if (!quantStatus?.gate?.isConnected || !strategyConfig.contract.trim()) {
      setContractCostHint(null);
      return () => {
        cancelled = true;
      };
    }
    const fetchContractHint = async () => {
      try {
        setContractHintLoading(true);
        const detail = await quantService.getContractDetail(
          strategyConfig.settle,
          strategyConfig.contract.trim()
        );
        if (cancelled) return;
        const price = resolveContractPrice(detail);
        const multiplier = resolveContractMultiplier(detail);
        const maxLeverage = resolveContractMaxLeverage(detail);
        setContractCostHint({ price: price ?? undefined, multiplier, maxLeverage });
        if (maxLeverage) {
          setStrategyConfig((prev) => {
            if (!prev.leverage || prev.leverage <= maxLeverage) {
              return prev;
            }
            return { ...prev, leverage: maxLeverage };
          });
        }
      } catch (error) {
        if (!cancelled) {
          setContractCostHint(null);
        }
      } finally {
        if (!cancelled) {
          setContractHintLoading(false);
        }
      }
    };
    fetchContractHint();
    return () => {
      cancelled = true;
    };
  }, [strategyConfig.contract, strategyConfig.settle, quantStatus?.gate?.isConnected]);

  const handleRedeem = async () => {
    if (!inviteCode.trim()) {
      setInviteError('请输入邀请码');
      return;
    }
    setInviteError(null);
    setInviteMessage(null);
    try {
      const response = await inviteService.redeem(inviteCode.trim());
      setInviteStatus(response.status);
      setQuantStatus((prev) => ({
        hasAccess: response.status.hasAccess,
        invitationCode: response.status.invitationCode,
        grantedAt: response.status.grantedAt,
        gate: prev?.gate || { isConnected: false },
      }));
      setInviteMessage(response.message);
      setInviteCode('');
    } catch (error: any) {
      console.error('邀请码验证失败', error);
      setInviteError(error?.response?.data?.message || '邀请码验证失败');
    }
  };

  const handleSaveGate = async () => {
    if (!gateForm.apiKey.trim() || !gateForm.apiSecret.trim()) {
      setGateError('请填写 API Key 和 Secret');
      return;
    }
    setGateError(null);
    setGateMessage(null);
    try {
      const response = await quantService.saveGateCredentials({
        apiKey: gateForm.apiKey.trim(),
        apiSecret: gateForm.apiSecret.trim(),
        passphrase: gateForm.passphrase.trim() || undefined,
        nickname: gateForm.nickname.trim() || undefined,
      });
      setQuantStatus((prev) => ({
        hasAccess: prev?.hasAccess ?? inviteStatus?.hasAccess ?? true,
        invitationCode: prev?.invitationCode,
        grantedAt: prev?.grantedAt,
        gate: response.gate,
      }));
      setGateMessage(response.message);
      setGateForm({ apiKey: '', apiSecret: '', passphrase: '', nickname: '' });
      setEditingGate(false);
    } catch (error: any) {
      console.error('保存 Gate 凭证失败', error);
      setGateError(error?.response?.data?.message || '保存失败');
    }
  };

  const handleRemoveGate = async () => {
    setGateError(null);
    setGateMessage(null);
    try {
      await quantService.deleteGateCredentials();
      setQuantStatus((prev) => ({
        hasAccess: prev?.hasAccess ?? inviteStatus?.hasAccess ?? false,
        invitationCode: prev?.invitationCode,
        grantedAt: prev?.grantedAt,
        gate: { isConnected: false },
      }));
      setGateMessage('已清除 Gate API 凭证');
    } catch (error: any) {
      console.error('移除 Gate 凭证失败', error);
      setGateError(error?.response?.data?.message || '移除失败');
    }
  };

  const handleRunStrategy = async () => {
    if (!strategyConfig.contract.trim()) {
      setStrategyError('请填写合约标识');
      return;
    }
    if (!quantStatus?.gate?.isConnected) {
      setStrategyError('请先连接 Gate API 凭证');
      return;
    }
    setStrategyError(null);
    setStrategyMessage(null);
    setRunningStrategy(true);
    try {
      const normalizedBaseSize = Math.max(1, Math.floor(Number(strategyConfig.baseSize) || 1));
      const normalizedTakeProfit = normalizePercentInput(strategyConfig.takeProfitPct);
      const normalizedStopLoss = normalizePercentInput(strategyConfig.stopLossPct);
      const normalizedLeverage = (() => {
        const numeric = Math.max(1, Number(strategyConfig.leverage) || 1);
        const maxLev = contractCostHint?.maxLeverage;
        if (maxLev && numeric > maxLev) {
          return maxLev;
        }
        return numeric;
      })();
      const resolvedThreshold = (() => {
        const numeric = Number(strategyConfig.threshold);
        if (Number.isFinite(numeric) && numeric > 0) {
          return numeric;
        }
        return getDefaultThresholdForStrategy(strategyConfig.strategyId);
      })();
      const payload = {
        strategyId: strategyConfig.strategyId,
        settle: strategyConfig.settle,
        contract: strategyConfig.contract.trim(),
        interval: strategyConfig.interval,
        lookback: Number(strategyConfig.lookback) || 50,
        threshold: resolvedThreshold,
        baseSize: normalizedBaseSize,
        autoExecute: strategyConfig.autoExecute,
        useHeikinAshi: strategyConfig.useHeikinAshi,
        takeProfitPct: normalizedTakeProfit,
        stopLossPct: normalizedStopLoss,
        leverage: normalizedLeverage,
      };
      const result = await quantService.runStrategy(payload);
      setStrategyResult(result);
      if (result.execution.status === 'executed') {
        setStrategyMessage('策略已运行并自动下单');
      } else if (result.execution.status === 'ready') {
        setStrategyMessage('策略已运行，生成了可执行的委托');
      } else {
        setStrategyMessage('策略分析已完成，无需下单');
      }
    } catch (error: any) {
      console.error('运行策略失败', error);
      setStrategyError(error?.response?.data?.message || '运行策略失败');
    } finally {
      setRunningStrategy(false);
    }
  };

  const handleCreateStrategyInstance = async () => {
    if (!quantStatus?.gate?.isConnected) {
      setStrategyError('请先连接 Gate API 凭证');
      return;
    }

    if (!strategyConfig.contract.trim()) {
      setStrategyError('请填写合约标识，例如 BTC_USDT');
      return;
    }

    setStrategyError(null);
    setStrategyMessage(null);
    setCreatingInstance(true);
    try {
      const frequencySeconds = Math.max(Number(strategyConfig.frequencySeconds) || 60, 15);
      const normalizedBaseSize = Math.max(1, Math.floor(Number(strategyConfig.baseSize) || 1));
      const normalizedTakeProfit = normalizePercentInput(strategyConfig.takeProfitPct);
      const normalizedStopLoss = normalizePercentInput(strategyConfig.stopLossPct);
      const normalizedLeverage = (() => {
        const numeric = Math.max(1, Number(strategyConfig.leverage) || 1);
        const maxLev = contractCostHint?.maxLeverage;
        if (maxLev && numeric > maxLev) {
          return maxLev;
        }
        return numeric;
      })();
      const resolvedThreshold = (() => {
        const numeric = Number(strategyConfig.threshold);
        if (Number.isFinite(numeric) && numeric > 0) {
          return numeric;
        }
        return getDefaultThresholdForStrategy(strategyConfig.strategyId);
      })();
      await quantService.createStrategyInstance({
        strategyId: strategyConfig.strategyId,
        settle: strategyConfig.settle,
        contract: strategyConfig.contract.trim(),
        interval: strategyConfig.interval,
        lookback: Number(strategyConfig.lookback) || 50,
        threshold: resolvedThreshold,
        baseSize: normalizedBaseSize,
        autoExecute: strategyConfig.autoExecute,
        frequencyMs: frequencySeconds * 1000,
        useHeikinAshi: strategyConfig.useHeikinAshi,
        takeProfitPct: normalizedTakeProfit,
        stopLossPct: normalizedStopLoss,
        leverage: normalizedLeverage,
      });
      setStrategyMessage('自动策略实例已创建，请前往量化监控页面查看运行情况');
    } catch (error: any) {
      console.error('创建策略实例失败', error);
      setStrategyError(error?.response?.data?.message || '创建策略实例失败');
    } finally {
      setCreatingInstance(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner message="加载量化权限与 Gate 数据..." />
      </div>
    );
  }

  return (
    <div className="min-h-screen space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            Gate 量化控制台
          </h1>
          <p className="text-gray-400">
            通过邀请码解锁量化权限,配置 Gate API 后即可实时查看资产、仓位并下发策略委托
          </p>
        </div>
        <Link
          to="/quant/monitor"
          className="px-4 py-2 rounded-xl border border-white/20 text-sm text-gray-200 hover:text-white"
        >
          打开量化监控 ↗
        </Link>
      </div>

      {/* 邀请码 */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 flex items-center justify-center text-2xl">
            🔑
          </div>
          <div>
            <h2 className="text-xl font-semibold text-white">邀请码校验</h2>
            <p className="text-sm text-gray-400">只有完成授权的账户才能访问量化交易功能</p>
          </div>
        </div>

        {inviteStatus?.hasAccess ? (
          <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-2">
            <p className="text-green-300 font-medium">
              ✅ 已获得量化权限 (邀请码 {inviteStatus.invitationCode})
            </p>
            {inviteStatus.grantedAt && (
              <p className="text-sm text-green-200">
                授权时间: {formatDate(inviteStatus.grantedAt)}
              </p>
            )}
            {inviteStatus.meta?.description && (
              <p className="text-sm text-green-200">{inviteStatus.meta.description}</p>
            )}
            {typeof inviteStatus.meta?.remaining === 'number' && (
              <p className="text-xs text-green-200">剩余可使用次数: {inviteStatus.meta.remaining}</p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex flex-col md:flex-row gap-3">
              <input
                type="text"
                value={inviteCode}
                onChange={(e) => setInviteCode(e.target.value)}
                placeholder="请输入管理员提供的邀请码"
                className="flex-1 px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
              />
              <button
                onClick={handleRedeem}
                className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-semibold rounded-xl hover:shadow-lg"
              >
                验证邀请码
              </button>
            </div>
            {inviteError && <p className="text-sm text-red-400">{inviteError}</p>}
            {inviteMessage && <p className="text-sm text-green-400">{inviteMessage}</p>}
          </div>
        )}
      </div>

      {/* Gate 凭证 */}
      <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div>
            <h2 className="text-xl font-semibold text-white">Gate API 凭证</h2>
            <p className="text-sm text-gray-400">凭证仅保存在本系统数据库中,请使用只读或子账号密钥</p>
          </div>
        </div>

        {!inviteStatus?.hasAccess && (
          <p className="text-sm text-yellow-400">请先完成邀请码验证</p>
        )}

        {quantStatus?.gate?.isConnected && !editingGate ? (
          <div className="flex flex-col md:flex-row md:items-center justify-between bg-gray-800/80 rounded-xl p-4">
            <div className="space-y-1 text-gray-300">
              <p>状态: <span className="text-green-400 font-semibold">已连接</span></p>
              {quantStatus.gate.nickname && <p>备注: {quantStatus.gate.nickname}</p>}
              {quantStatus.gate.updatedAt && (
                <p className="text-sm text-gray-400">最近更新: {formatDate(quantStatus.gate.updatedAt)}</p>
              )}
            </div>
            <div className="flex gap-3 mt-4 md:mt-0">
              <button
                onClick={() => setEditingGate(true)}
                className="px-4 py-2 border border-blue-500/40 text-blue-300 rounded-lg hover:bg-blue-500/10"
              >
                更新凭证
              </button>
              <button
                onClick={handleRemoveGate}
                className="px-4 py-2 border border-red-500/40 text-red-300 rounded-lg hover:bg-red-500/10"
              >
                断开连接
              </button>
            </div>
          </div>
        ) : inviteStatus?.hasAccess && (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <input
                type="text"
                placeholder="API Key"
                value={gateForm.apiKey}
                onChange={(e) => setGateForm({ ...gateForm, apiKey: e.target.value })}
                className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
              />
              <input
                type="password"
                placeholder="API Secret"
                value={gateForm.apiSecret}
                onChange={(e) => setGateForm({ ...gateForm, apiSecret: e.target.value })}
                className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="Passphrase (可选)"
                value={gateForm.passphrase}
                onChange={(e) => setGateForm({ ...gateForm, passphrase: e.target.value })}
                className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
              />
              <input
                type="text"
                placeholder="备注名称 (可选)"
                value={gateForm.nickname}
                onChange={(e) => setGateForm({ ...gateForm, nickname: e.target.value })}
                className="px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-purple-500"
              />
            </div>
            <button
              onClick={handleSaveGate}
              className="px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl text-white font-semibold hover:shadow-lg"
            >
              保存 Gate 凭证
            </button>
            {gateError && <p className="text-sm text-red-400">{gateError}</p>}
            {gateMessage && <p className="text-sm text-green-400">{gateMessage}</p>}
          </div>
        )}
      </div>

      {inviteStatus?.hasAccess && (
        <>
                <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5">
            <p className="text-sm text-gray-400">自动策略实例与实时事件信息请在量化监控面板查看。</p>
          </div>

          <div className="bg-gray-900/60 border border-gray-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-2xl flex items-center justify-center">📈</div>
              <div>
                <h3 className="text-lg font-semibold text-white">策略执行</h3>
                <p className="text-sm text-gray-400">选择策略参数, 可即时分析或注册后台自动运行</p>
              </div>
            </div>

            {!quantStatus?.gate?.isConnected && (
              <p className="text-sm text-yellow-400">请先连接 Gate API 凭证</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">策略模板</label>
                <select
                  value={strategyConfig.strategyId}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({ ...prev, strategyId: e.target.value }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  disabled={!quantStatus?.gate?.isConnected}
                >
                  {STRATEGY_TEMPLATES.map((template) => (
                    <option key={template.id} value={template.id}>
                      {template.label}
                    </option>
                  ))}
                </select>
                {selectedStrategyMeta && (
                  <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-3 space-y-2 text-sm">
                    <p className="text-gray-200 font-medium">
                      {selectedStrategyMeta.label} · 策略特点
                    </p>
                    <p className="text-gray-400 leading-relaxed">
                      {selectedStrategyMeta.description}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {selectedStrategyMeta.highlights.map((highlight) => (
                        <span
                          key={highlight}
                          className="px-2 py-1 rounded-full bg-gray-700/80 text-gray-100 text-xs"
                        >
                          {highlight}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">合约标识</label>
                <input
                  type="text"
                  placeholder="如 BTC_USDT"
                  value={strategyConfig.contract}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({ ...prev, contract: e.target.value.toUpperCase() }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  disabled={!quantStatus?.gate?.isConnected}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">K 线周期</label>
                <select
                  value={strategyConfig.interval}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({ ...prev, interval: e.target.value }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  disabled={!quantStatus?.gate?.isConnected}
                >
                  <option value="1m">1 分钟</option>
                  <option value="5m">5 分钟</option>
                  <option value="15m">15 分钟</option>
                  <option value="1h">1 小时</option>
                </select>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">回测窗口 (根)</label>
                <input
                  type="number"
                  min={5}
                  max={300}
                  value={strategyConfig.lookback}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({ ...prev, lookback: Number(e.target.value) }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  disabled={!quantStatus?.gate?.isConnected}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">触发阈值</label>
                {strategyConfig.strategyId === 'ut-bot' ? (
                  <div className="space-y-2">
                    <input
                      type="number"
                      min={0.1}
                      step={0.1}
                      value={strategyConfig.threshold}
                      onChange={(e) =>
                        setStrategyConfig((prev) => ({ ...prev, threshold: Number(e.target.value) || 0 }))
                      }
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                      disabled={!quantStatus?.gate?.isConnected}
                    />
                    <p className="text-xs text-gray-500">
                      Key Value (ATR 倍数). 数值越高信号越少，但更稳健。默认等同于 UT Bot 脚本中的 <code>a</code> 参数。
                    </p>
                  </div>
                ) : (
                  <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-sm text-gray-300">
                    <p>
                      系统会根据{selectedStrategyMeta ? ` ${selectedStrategyMeta.label} ` : ''}策略模板自动设定触发阈值，无需在前端调整。
                    </p>
                    <p className="text-xs text-gray-500 mt-2">
                      阈值仅用于后台计算触发信号，当前界面不再展示具体数值。
                    </p>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">张数</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={strategyConfig.baseSize}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({
                      ...prev,
                      baseSize: Math.max(1, Math.floor(Number(e.target.value) || 0))
                    }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  disabled={!quantStatus?.gate?.isConnected}
                />
                <p className="text-xs text-gray-500">
                  {quantStatus?.gate?.isConnected
                    ? contractHintLoading
                      ? 'U 成本估算加载中...'
                      : contractCostHint?.price
                      ? `当前估算 U 成本 ≈ ${formatNumber(estimatedUsdtCost ?? 0)} USDT（参考价 ${formatNumber(
                          contractCostHint.price
                        )} × 合约乘数 ${contractCostHint.multiplier ?? 1}）。`
                      : '输入有效合约后会显示估算的 U 成本。'
                    : '连接 Gate 后可看到估算的 U 成本。'}
                </p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400 flex items-center justify-between">
                  <span>杠杆</span>
                  {contractCostHint?.maxLeverage && (
                    <span className="text-xs text-gray-500">上限 {contractCostHint.maxLeverage}x</span>
                  )}
                </label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={strategyConfig.leverage}
                  onChange={(e) => {
                    const raw = Number(e.target.value);
                    const sanitized = Number.isFinite(raw) ? Math.max(1, raw) : 1;
                    const capped = contractCostHint?.maxLeverage
                      ? Math.min(sanitized, contractCostHint.maxLeverage)
                      : sanitized;
                    setStrategyConfig((prev) => ({ ...prev, leverage: capped }));
                  }}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  disabled={!quantStatus?.gate?.isConnected}
                />
                <p className="text-xs text-gray-500">策略运行前会自动调整 Gate 杠杆，不会超过交易所限制。</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">止盈 (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={strategyConfig.takeProfitPct ?? ''}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({
                      ...prev,
                      takeProfitPct:
                        e.target.value === ''
                          ? undefined
                          : Math.min(Math.max(Number(e.target.value) || 0, 0), 100),
                    }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  disabled={!quantStatus?.gate?.isConnected}
                />
                <p className="text-xs text-gray-500">达到该收益率后自动结算，留空表示不开启止盈。</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">止损 (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={0.1}
                  value={strategyConfig.stopLossPct ?? ''}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({
                      ...prev,
                      stopLossPct:
                        e.target.value === ''
                          ? undefined
                          : Math.min(Math.max(Number(e.target.value) || 0, 0), 100),
                    }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  disabled={!quantStatus?.gate?.isConnected}
                />
                <p className="text-xs text-gray-500">亏损达到该比例时自动平仓，留空表示不开启止损。</p>
              </div>
              <div className="space-y-2">
                <label className="text-sm text-gray-400">执行频率 (秒)</label>
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={strategyConfig.frequencySeconds}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({ ...prev, frequencySeconds: Number(e.target.value) }))
                  }
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-blue-500"
                  disabled={!quantStatus?.gate?.isConnected}
                />
                <p className="text-xs text-gray-500">用于自动实例，至少 15 秒。</p>
                <p className="text-xs text-gray-500">
                  杠杆以上方输入为准，如超过合约允许上限会自动按上限下单。
                </p>
              </div>
              <div className="flex items-center gap-3">
                <input
                  id="auto-execute"
                  type="checkbox"
                  className="w-4 h-4"
                  checked={strategyConfig.autoExecute}
                  onChange={(e) =>
                    setStrategyConfig((prev) => ({ ...prev, autoExecute: e.target.checked }))
                  }
                  disabled={!quantStatus?.gate?.isConnected}
                />
                <label htmlFor="auto-execute" className="text-sm text-gray-300">
                  自动执行下单
                </label>
              </div>
              {strategyConfig.strategyId === 'ut-bot' && (
                <div className="flex items-center gap-3">
                  <input
                    id="use-ha"
                    type="checkbox"
                    className="w-4 h-4"
                    checked={strategyConfig.useHeikinAshi}
                    onChange={(e) =>
                      setStrategyConfig((prev) => ({ ...prev, useHeikinAshi: e.target.checked }))
                    }
                    disabled={!quantStatus?.gate?.isConnected}
                  />
                  <label htmlFor="use-ha" className="text-sm text-gray-300">
                    使用 Heikin Ashi 价格计算信号
                  </label>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <button
                onClick={handleRunStrategy}
                disabled={!quantStatus?.gate?.isConnected || runningStrategy}
                className={`w-full py-4 rounded-xl font-semibold text-lg ${quantStatus?.gate?.isConnected ? 'bg-gradient-to-r from-green-500 to-emerald-500 hover:shadow-lg' : 'bg-gray-800 text-gray-600 cursor-not-allowed'}`}
              >
                {runningStrategy ? '策略运行中...' : '运行策略'}
              </button>
              <button
                onClick={handleCreateStrategyInstance}
                disabled={!quantStatus?.gate?.isConnected || creatingInstance}
                className={`w-full py-4 rounded-xl font-semibold text-lg ${
                  quantStatus?.gate?.isConnected && !creatingInstance
                    ? 'bg-gradient-to-r from-sky-500 to-indigo-500 hover:shadow-lg'
                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                }`}
              >
                {creatingInstance ? '启动自动策略中...' : '启动自动策略'}
              </button>
            </div>
            {strategyError && <p className="text-sm text-red-400">{strategyError}</p>}
            {strategyMessage && <p className="text-sm text-green-400">{strategyMessage}</p>}

            {strategyResult && (
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm text-gray-400">策略动作</p>
                    <p className="text-2xl font-semibold text-white">
                      {strategyResult.strategy.action === 'long'
                        ? '做多'
                        : strategyResult.strategy.action === 'short'
                        ? '做空'
                        : '保持观望'}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-gray-400">
                      {strategyResult.strategy.zScore !== undefined ? 'Z-Score' : '策略评分'}
                    </p>
                    <p className="text-xl font-semibold text-blue-300">
                      {strategyResult.strategy.zScore !== undefined || strategyResult.strategy.totalScore !== undefined
                        ? (strategyResult.strategy.zScore ?? strategyResult.strategy.totalScore ?? 0).toFixed(2)
                        : '--'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 text-xs">
                  {strategyResult.strategy.session && (
                    <span
                      className={`px-3 py-1 rounded-full ${getSessionBadgeClass(
                        strategyResult.strategy.session.quality
                      )}`}
                    >
                      {strategyResult.strategy.session.name} · {strategyResult.strategy.session.quality}
                    </span>
                  )}
                  {typeof strategyResult.strategy.entryQuality === 'number' && (
                    <span className="px-3 py-1 rounded-full bg-blue-500/20 text-blue-200">
                      入场质量 {Math.round(strategyResult.strategy.entryQuality)} / 100
                    </span>
                  )}
                  {strategyResult.strategy.isPrime && (
                    <span className="px-3 py-1 rounded-full bg-purple-500/20 text-purple-200">PRIME</span>
                  )}
                  {(strategyResult.strategy.shouldTrade || strategyResult.strategy.signalTriggered) && (
                    <span className="px-3 py-1 rounded-full bg-green-500/20 text-green-200">信号触发</span>
                  )}
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm text-gray-300">
                  <div>
                    <p className="text-gray-500">最新价格</p>
                    <p className="text-white font-medium">{formatNumber(strategyResult.market.lastPrice)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">均值 / 中枢</p>
                    <p className="text-white font-medium">
                      {formatNumber(strategyResult.market.meanPrice ?? strategyResult.market.equilibrium)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">波动率 / σ</p>
                    <p className="text-white font-medium">{formatNumber(strategyResult.market.stdDeviation)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">风险指标</p>
                    <p className="text-white font-medium">{formatNumber(strategyResult.market.valueAtRisk)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">杠杆</p>
                    <p className="text-white font-medium">
                      {(strategyResult.strategy.appliedLeverage ?? strategyConfig.leverage ?? 1).toFixed(2)}x
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm text-gray-400">
                  <div>
                    <p className="text-gray-500">止盈</p>
                    <p className="text-white font-medium">
                      {formatPercentValue(strategyResult.takeProfitPct ?? strategyConfig.takeProfitPct)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">止损</p>
                    <p className="text-white font-medium">
                      {formatPercentValue(strategyResult.stopLossPct ?? strategyConfig.stopLossPct)}
                    </p>
                  </div>
                </div>
                {strategyResult.order && (
                  <div className="bg-gray-900/60 border border-gray-700 rounded-lg p-4">
                    <p className="text-sm text-gray-400 mb-2">推荐委托</p>
                    <p className="text-white font-semibold">{strategyResult.order.contract}</p>
                    <p className="text-sm text-gray-300 mt-1">
                      张数:{' '}
                      {(() => {
                        const sizeValue = Number(strategyResult.order.size);
                        return Number.isFinite(sizeValue)
                          ? Math.abs(sizeValue).toLocaleString('zh-CN', { maximumFractionDigits: 4 })
                          : strategyResult.order.size;
                      })()}
                    </p>
                    <p className="text-sm text-gray-300">
                      U 成本:{' '}
                      {(() => {
                        const orderNotional =
                          strategyResult.strategy.appliedNotional ??
                          strategyResult.strategy.recommendedNotional ??
                          strategyResult.strategy.requestedNotional;
                        return orderNotional ? formatNumber(orderNotional) : '--';
                      })()}{' '}
                      USDT
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      状态: {strategyResult.execution.status === 'executed'
                        ? '已自动下单'
                        : strategyResult.execution.status === 'ready'
                        ? '待确认'
                        : '仅分析'}
                      {strategyResult.execution.id && ` (#${strategyResult.execution.id})`}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          <BacktestPanel />
        </>
      )}
    </div>
  );
}
