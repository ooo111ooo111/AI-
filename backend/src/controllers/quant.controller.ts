import { RequestHandler } from 'express';
import User from '../models/User';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { gateService } from '../services/gate.service';
import StrategyInstance from '../models/StrategyInstance';
import StrategyRunLog from '../models/StrategyRunLog';
import { strategyEngine } from '../services/strategyEngine';
import { runStrategyById } from '../services/strategies';
import { isAdminEmail } from '../utils/admin.util';
import { getInstancePerformance } from '../services/strategyPerformance.service';

export const normalizeBaseContracts = (value: any) => Math.max(1, Math.floor(Number(value) || 1));

export const normalizePercentValue = (value: any) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return undefined;
  }
  return Math.min(num, 100);
};

export const normalizeLeverageValue = (value: any) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return undefined;
  }
  return Math.max(1, num);
};

export const normalizeContractSymbol = (symbol: string | undefined | null, settle?: string) => {
  if (!symbol) return '';
  const trimmed = symbol.trim();
  if (!trimmed) return '';
  const settleSuffix = (settle || '').toUpperCase();
  const upper = trimmed.toUpperCase();
  if (!settleSuffix) {
    return upper;
  }
  const parts = upper.split('_');
  if (parts.length >= 2) {
    const prefix = parts.slice(0, -1).join('_') || parts[0];
    const suffix = parts[parts.length - 1];
    if (suffix === settleSuffix) {
      return `${prefix}_${suffix}`;
    }
    return `${prefix}_${settleSuffix}`;
  }
  if (upper.endsWith(`_${settleSuffix}`)) {
    return upper;
  }
  return `${upper}_${settleSuffix}`;
};

export const ensureQuantAccess = async (userId: string) => {
  const user = await User.findById(userId).select('+gateSettings.apiSecret');
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }
  if (!user.quantAccess?.hasAccess) {
    throw new Error('NO_QUANT_ACCESS');
  }
  return user;
};

const STRATEGY_THRESHOLD_DEFAULTS: Record<string, number> = {
  'sai-scalper': 1.2,
  'mean-reversion': 2,
  'sma-trend': 0.8,
  'rsi-swing': 30,
  'ut-bot': 1,
  'test-short': 1,
};

const getDefaultThreshold = (strategyId?: string) => {
  if (!strategyId) return 1;
  return STRATEGY_THRESHOLD_DEFAULTS[strategyId] ?? 1;
};

export const resolveStrategyThreshold = (strategyId: string, rawThreshold: any) => {
  const parsed = Number(rawThreshold);
  if (Number.isFinite(parsed) && parsed > 0) {
    return parsed;
  }
  return getDefaultThreshold(strategyId);
};

export const getQuantStatus: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await User.findById(authReq.user!.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    res.json({
      hasAccess: user.quantAccess?.hasAccess ?? false,
      invitationCode: user.quantAccess?.invitationCode,
      grantedAt: user.quantAccess?.grantedAt,
      gate: {
        isConnected: Boolean(user.gateSettings?.apiKey && user.gateSettings?.isEnabled),
        nickname: user.gateSettings?.nickname,
        updatedAt: user.gateSettings?.updatedAt,
      },
    });
  } catch (error) {
    console.error('获取量化状态失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

export const saveGateCredentials: RequestHandler = async (req, res) => {
  try {
    const { apiKey, apiSecret, passphrase, nickname } = req.body as {
      apiKey?: string;
      apiSecret?: string;
      passphrase?: string;
      nickname?: string;
    };

    if (!apiKey || !apiSecret) {
      return res.status(400).json({ message: '请提供 API Key 与 Secret' });
    }

    const authReq = req as AuthenticatedRequest;
    const user = await ensureQuantAccess(authReq.user!.userId);

    user.gateSettings = {
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      passphrase: passphrase?.trim(),
      nickname: nickname?.trim(),
      updatedAt: new Date(),
      isEnabled: true,
    };

    await user.save();

    res.json({
      message: 'Gate API 凭证已更新',
      gate: {
        isConnected: true,
        nickname: user.gateSettings?.nickname,
        updatedAt: user.gateSettings?.updatedAt,
      },
    });
  } catch (error: any) {
    if (error.message === 'NO_QUANT_ACCESS') {
      return res.status(403).json({ message: '请先完成邀请码验证' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: '用户不存在' });
    }
    console.error('保存 Gate 凭证失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

export const deleteGateCredentials: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await ensureQuantAccess(authReq.user!.userId);
    user.gateSettings = undefined;
    await user.save();

    res.json({ message: '已清除 Gate 凭证' });
  } catch (error: any) {
    if (error.message === 'NO_QUANT_ACCESS') {
      return res.status(403).json({ message: '请先完成邀请码验证' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: '用户不存在' });
    }
    console.error('删除 Gate 凭证失败:', error);
    res.status(500).json({ message: '服务器错误' });
  }
};

export const fetchGateContracts: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await ensureQuantAccess(authReq.user!.userId);
    if (!user) {
      return res.status(404).json({ message: '用户不存在' });
    }

    const settle = (req.query.settle as string) || 'usdt';
    const contractId = req.query.contract as string | undefined;

    if (!contractId) {
      return res.status(400).json({ message: '请提供合约标识 (contract)' });
    }

    const useTestnet = isAdminEmail(user.email);
    const normalizedContract = normalizeContractSymbol(contractId, settle);
    const detail = await gateService.getContractDetail(settle, normalizedContract, { useTestnet });
    res.json(detail);
  } catch (error: any) {
    if (error.message === 'NO_QUANT_ACCESS') {
      return res.status(403).json({ message: '请先完成邀请码验证' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: '用户不存在' });
    }
    console.error('获取 Gate 合约信息失败:', error);
    res.status(500).json({ message: error?.message || '获取 Gate 合约信息失败' });
  }
};

export const fetchGateAccount: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    console.log('[Quant] fetchGateAccount invoked', {
      userId,
      settle: req.query.settle || 'usdt',
    });
    const user = await ensureQuantAccess(userId);
    if (!user.gateSettings) {
      return res.status(400).json({ message: '请先配置 Gate API 凭证' });
    }

    const settle = (req.query.settle as string) || 'usdt';
    console.log('[Quant] fetching Gate account', {
      userId,
      settle,
      hasApiKey: Boolean(user.gateSettings.apiKey),
      hasSecret: Boolean(user.gateSettings.apiSecret),
    });
    const useTestnet = isAdminEmail(user.email);
    const account = await gateService.getAccount(settle, user.gateSettings, { useTestnet });
    console.log('[Quant] gate account fetched', { userId, settle });
    res.json(account);
  } catch (error: any) {
    if (error.message === 'NO_QUANT_ACCESS') {
      return res.status(403).json({ message: '请先完成邀请码验证' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: '用户不存在' });
    }
    console.error('获取 Gate 账户信息失败:', error);
    res.status(500).json({ message: error?.message || '获取 Gate 账户信息失败' });
  }
};

export const fetchGatePositions: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const userId = authReq.user!.userId;
    console.log('[Quant] fetchGatePositions invoked', {
      userId,
      settle: req.query.settle || 'usdt',
    });
    const user = await ensureQuantAccess(userId);
    if (!user.gateSettings) {
      return res.status(400).json({ message: '请先配置 Gate API 凭证' });
    }

    const settle = (req.query.settle as string) || 'usdt';
    console.log('[Quant] fetching Gate positions', {
      userId,
      settle,
      hasApiKey: Boolean(user.gateSettings.apiKey),
      hasSecret: Boolean(user.gateSettings.apiSecret),
    });
    const useTestnet = isAdminEmail(user.email);
    const positions = await gateService.getPositions(settle, user.gateSettings, { useTestnet });
    const positionsCount = Array.isArray(positions) ? positions.length : 0;
    console.log('[Quant] gate positions fetched', { userId, settle, positionsCount });
    res.json(positions);
  } catch (error: any) {
    if (error.message === 'NO_QUANT_ACCESS') {
      return res.status(403).json({ message: '请先完成邀请码验证' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: '用户不存在' });
    }
    console.error('获取 Gate 仓位失败:', error);
    res.status(500).json({ message: error?.message || '获取 Gate 仓位失败' });
  }
};

export const createGateOrder: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await ensureQuantAccess(authReq.user!.userId);
    if (!user.gateSettings) {
      return res.status(400).json({ message: '请先配置 Gate API 凭证' });
    }

    const { settle = 'usdt', contract, size, price, tif = 'gtc', reduceOnly, close, stpAct } = req.body as {
      settle?: string;
      contract?: string;
      size?: string | number;
      price?: string | number;
      tif?: string;
      reduceOnly?: boolean;
      close?: boolean;
      stpAct?: 'cn' | 'co' | 'cb';
    };

    if (!contract || !size) {
      return res.status(400).json({ message: '请提供合约与委托数量' });
    }

    const payload = {
      contract,
      size,
      price,
      tif,
      reduce_only: reduceOnly,
      close,
      stp_act: stpAct,
    };
    console.log("哈吉米"+payload);
    const useTestnet = isAdminEmail(user.email);
    const order = await gateService.createOrder(settle, payload, user.gateSettings, { useTestnet });
    res.json(order);
  } catch (error: any) {
    if (error.message === 'NO_QUANT_ACCESS') {
      return res.status(403).json({ message: '请先完成邀请码验证' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: '用户不存在' });
    }
    console.error('创建 Gate 委托失败:', error);
    res.status(500).json({ message: error?.message || '创建 Gate 委托失败' });
  }
};

export const runQuantStrategy: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await ensureQuantAccess(authReq.user!.userId);
    if (!user.gateSettings) {
      return res.status(400).json({ message: '请先配置 Gate API 凭证' });
    }

    const {
      strategyId = 'sai-scalper',
      settle = 'usdt',
      contract,
      interval = '5m',
      lookback = 50,
      threshold = 1.0,
      baseSize = 1,
      autoExecute = false,
      useHeikinAshi = false,
      takeProfitPct,
      stopLossPct,
      leverage,
    } = req.body as {
      strategyId?: string;
      settle?: string;
      contract?: string;
      interval?: string;
      lookback?: number;
      threshold?: number;
      baseSize?: number;
      autoExecute?: boolean;
      useHeikinAshi?: boolean;
      takeProfitPct?: number;
      stopLossPct?: number;
      leverage?: number;
    };

    if (!contract) {
      return res.status(400).json({ message: '请提供合约标识 (contract)' });
    }
    const normalizedBaseSize = normalizeBaseContracts(baseSize);
    const useTestnet = isAdminEmail(user.email);
    const normalizedTakeProfit = normalizePercentValue(takeProfitPct);
    const normalizedStopLoss = normalizePercentValue(stopLossPct);
    const normalizedLeverage = normalizeLeverageValue(leverage);

    const normalizedContract = normalizeContractSymbol(contract, settle);

    const result = await runStrategyById({
      strategyId,
      settle,
      contract: normalizedContract,
      interval,
      lookback,
      threshold: resolveStrategyThreshold(strategyId, threshold),
      baseSize: normalizedBaseSize,
      autoExecute,
      useHeikinAshi,
      gateSettings: user.gateSettings,
      useTestnet,
      takeProfitPct: normalizedTakeProfit,
      stopLossPct: normalizedStopLoss,
      leverage: normalizedLeverage,
    });

    res.json({
      strategyId,
      takeProfitPct: normalizedTakeProfit,
      stopLossPct: normalizedStopLoss,
      leverage: normalizedLeverage,
      ...result,
    });
  } catch (error: any) {
    if (error.message === 'NO_QUANT_ACCESS') {
      return res.status(403).json({ message: '请先完成邀请码验证' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: '用户不存在' });
    }
    console.error('运行量化策略失败:', error);
    res.status(500).json({ message: error?.message || '运行策略失败' });
  }
};

export const listStrategyInstances: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const instances = await StrategyInstance.find({ user: authReq.user!.userId })
      .sort({ createdAt: -1 })
      .lean();
    res.json(instances);
  } catch (error) {
    console.error('列出策略实例失败:', error);
    res.status(500).json({ message: '获取策略实例失败' });
  }
};

const resolveFrequencyMs = (interval: string, override?: number) => {
  if (override && Number.isFinite(override) && override > 0) {
    return override;
  }
  const match = /^([0-9]+)([mhd])$/i.exec(interval || '1m');
  if (!match) return 60_000;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (Number.isNaN(value) || value <= 0) return 60_000;
  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    default:
      return value * 60 * 1000;
  }
};

export const createStrategyInstance: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await ensureQuantAccess(authReq.user!.userId);
    if (!user.gateSettings) {
      return res.status(400).json({ message: '请先配置 Gate API 凭证' });
    }

    const {
      strategyId = 'sai-scalper',
      settle = 'usdt',
      contract,
      interval = '5m',
      lookback = 50,
      threshold = 1,
      baseSize = 1,
      autoExecute = false,
      frequencyMs,
      useHeikinAshi = false,
      takeProfitPct,
      stopLossPct,
      leverage,
    } = req.body as Record<string, any>;

    if (!contract) {
      return res.status(400).json({ message: '请提供合约标识 (contract)' });
    }

    const normalizedContract = normalizeContractSymbol(contract, settle);

    const config = {
      settle,
      contract: normalizedContract,
      interval,
      lookback: Number(lookback) || 50,
      threshold: resolveStrategyThreshold(strategyId, threshold),
      baseSize: normalizeBaseContracts(baseSize),
      autoExecute: Boolean(autoExecute),
      frequencyMs: resolveFrequencyMs(interval, Number(frequencyMs)),
      useHeikinAshi: Boolean(useHeikinAshi),
      takeProfitPct: normalizePercentValue(takeProfitPct),
      stopLossPct: normalizePercentValue(stopLossPct),
      leverage: normalizeLeverageValue(leverage),
    };

    const instance = await StrategyInstance.create({
      user: user._id,
      strategyId,
      status: 'running',
      config,
    });

    strategyEngine.register(instance);

    res.json(instance);
  } catch (error: any) {
    if (error.message === 'NO_QUANT_ACCESS') {
      return res.status(403).json({ message: '请先完成邀请码验证' });
    }
    if (error.message === 'USER_NOT_FOUND') {
      return res.status(404).json({ message: '用户不存在' });
    }
    console.error('创建策略实例失败:', error);
    res.status(500).json({ message: error?.message || '创建策略失败' });
  }
};

export const stopStrategyInstance: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const instance = await StrategyInstance.findOne({
      _id: req.params.id,
      user: authReq.user!.userId,
    });
    if (!instance) {
      return res.status(404).json({ message: '策略实例不存在' });
    }
    await strategyEngine.stop(instance._id.toString());
    res.json({ message: '策略实例已停止' });
  } catch (error) {
    console.error('停止策略实例失败:', error);
    res.status(500).json({ message: '停止策略失败' });
  }
};

export const startStrategyInstance: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const instance = await StrategyInstance.findOne({
      _id: req.params.id,
      user: authReq.user!.userId,
    });
    if (!instance) {
      return res.status(404).json({ message: '策略实例不存在' });
    }
    if (instance.status === 'running') {
      return res.json({ message: '策略实例已在运行中' });
    }
    instance.status = 'running';
    await instance.save();
    strategyEngine.register(instance);
    res.json({ message: '策略实例已启动' });
  } catch (error) {
    console.error('启动策略实例失败:', error);
    res.status(500).json({ message: '启动策略失败' });
  }
};

export const deleteStrategyInstance: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const instance = await StrategyInstance.findOne({
      _id: req.params.id,
      user: authReq.user!.userId,
    });
    if (!instance) {
      return res.status(404).json({ message: '策略实例不存在' });
    }
    await strategyEngine.stop(instance._id.toString());
    await StrategyInstance.deleteOne({ _id: instance._id });
    res.json({ message: '策略实例已删除' });
  } catch (error) {
    console.error('删除策略实例失败:', error);
    res.status(500).json({ message: '删除策略失败' });
  }
};

export const getStrategyInstancePerformance: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const instance = await StrategyInstance.findOne({
      _id: req.params.id,
      user: authReq.user!.userId,
    });
    if (!instance) {
      return res.status(404).json({ message: '策略实例不存在' });
    }
    const performance = await getInstancePerformance(instance._id.toString());
    res.json(performance);
  } catch (error) {
    console.error('获取策略实例收益失败:', error);
    res.status(500).json({ message: '获取收益数据失败' });
  }
};

export const getStrategyRunLogs: RequestHandler = async (req, res) => {
  try {
    const authReq = req as AuthenticatedRequest;
    const user = await ensureQuantAccess(authReq.user!.userId);
    const instance = await StrategyInstance.findOne({
      _id: req.params.id,
      user: user._id,
    });
    if (!instance) {
      return res.status(404).json({ message: '策略实例不存在' });
    }

    const limitParam = Number(req.query.limit) || 50;
    const limit = Math.min(Math.max(limitParam, 1), 100);

    const logs = await StrategyRunLog.find({ instance: instance._id })
      .sort({ startedAt: -1 })
      .limit(limit)
      .lean();

    res.json(logs);
  } catch (error) {
    console.error('获取策略执行记录失败:', error);
    res.status(500).json({ message: '获取策略执行记录失败' });
  }
};
