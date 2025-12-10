export const getAvailableNotional = (account: any) => {
  if (!account) return null;
  const fields = [
    account.available,
    account.cross_available,
    account.margin_balance,
    account.balance,
    account.total?.value ?? account.total,
  ];
  for (const value of fields) {
    const num = Number(value);
    if (Number.isFinite(num) && num > 0) {
      return num;
    }
  }
  return null;
};

const parsePositiveNumber = (value: any, fallback: number) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : fallback;
};

export const resolveContractSpecs = (contractDetail?: any) => {
  const multiplierCandidates = [
    contractDetail?.quanto_multiplier,
    contractDetail?.quanto_base_margin_multiplier,
    contractDetail?.quanto_price_multiplier,
  ];
  let multiplier = 1;
  for (const candidate of multiplierCandidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      multiplier = value;
      break;
    }
  }
  const minContractsRaw = Number(contractDetail?.order_size_min);
  const minContracts = Number.isFinite(minContractsRaw) && minContractsRaw > 0
    ? Math.ceil(minContractsRaw)
    : 1;
  const leverageCandidates = [
    contractDetail?.leverage_max,
    contractDetail?.max_leverage,
    contractDetail?.cross_leverage_limit,
  ];
  let maxLeverage: number | undefined;
  for (const candidate of leverageCandidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) {
      maxLeverage = value;
      break;
    }
  }
  return {
    multiplier,
    minContracts: Math.max(minContracts, 1),
    maxLeverage,
  };
};

export const ensureContractSize = (value: number, minContracts: number) => {
  const numeric = Math.floor(Number(value));
  if (!Number.isFinite(numeric)) {
    return minContracts;
  }
  return Math.max(numeric, minContracts);
};

export const computeContractNotional = (contracts: number, price: number, multiplier: number) => {
  const sanitizedContracts = Math.max(Number(contracts) || 0, 0);
  if (!sanitizedContracts) return 0;
  const sanitizedPrice = parsePositiveNumber(price, 0);
  const sanitizedMultiplier = parsePositiveNumber(multiplier, 1);
  if (!sanitizedPrice || !sanitizedMultiplier) {
    return 0;
  }
  return sanitizedContracts * sanitizedPrice * sanitizedMultiplier;
};

export const clampContractsByBalance = (
  contracts: number,
  availableNotional: number | null,
  price: number,
  multiplier: number,
  options?: { leverage?: number }
) => {
  if (!availableNotional || availableNotional <= 0) {
    return contracts;
  }
  const perContractNotional = computeContractNotional(1, price, multiplier);
  if (!perContractNotional) {
    return contracts;
  }
  const leverage = options?.leverage && Number.isFinite(options.leverage) && options.leverage > 0
    ? options.leverage
    : 1;
  const effectiveNotional = availableNotional * leverage;
  const maxContracts = Math.floor(effectiveNotional / perContractNotional);
  if (maxContracts <= 0) {
    return 0;
  }
  return Math.min(contracts, maxContracts);
};

export const clampLeverageValue = (value: any, maxLeverage?: number) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return undefined;
  }
  const sanitized = Math.max(1, numeric);
  if (maxLeverage && Number.isFinite(maxLeverage) && maxLeverage > 0) {
    return Math.min(sanitized, maxLeverage);
  }
  return sanitized;
};

const toRiskRatio = (value?: number | null) => {
  const num = Number(value);
  if (!Number.isFinite(num) || num <= 0) {
    return null;
  }
  return num / 100;
};

export interface RiskConfig {
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
}

export interface RiskExitDecision {
  reason: 'take-profit' | 'stop-loss';
  exitPrice: number;
}

export const evaluateRiskFromPrice = (
  direction: 'long' | 'short',
  entryPrice: number,
  price: number,
  risk?: RiskConfig
): RiskExitDecision | null => {
  if (!risk) return null;
  const takeProfitRatio = toRiskRatio(risk.takeProfitPct);
  const stopLossRatio = toRiskRatio(risk.stopLossPct);
  if (!takeProfitRatio && !stopLossRatio) return null;
  if (!entryPrice || !price) return null;
  const leverageValue = risk.leverage && risk.leverage > 0 ? risk.leverage : 1;
  const move = (price - entryPrice) / entryPrice;
  const roi = direction === 'long' ? move * leverageValue : -move * leverageValue;
  if (takeProfitRatio && roi >= takeProfitRatio) {
    return { reason: 'take-profit', exitPrice: price };
  }
  if (stopLossRatio && roi <= -stopLossRatio) {
    return { reason: 'stop-loss', exitPrice: price };
  }
  return null;
};

export const evaluateRiskFromCandle = (
  direction: 'long' | 'short',
  entryPrice: number,
  candle: { high: number; low: number },
  risk?: RiskConfig
): RiskExitDecision | null => {
  if (!risk) return null;
  const takeProfitRatio = toRiskRatio(risk.takeProfitPct);
  const stopLossRatio = toRiskRatio(risk.stopLossPct);
  if (!takeProfitRatio && !stopLossRatio) return null;
  const { high, low } = candle || {};
  if (!Number.isFinite(entryPrice)) return null;
  const leverageValue = risk.leverage && risk.leverage > 0 ? risk.leverage : 1;
  if (direction === 'long') {
    const targetPrice = takeProfitRatio ? entryPrice * (1 + takeProfitRatio / leverageValue) : null;
    const stopPrice = stopLossRatio ? entryPrice * (1 - stopLossRatio / leverageValue) : null;
    const hitTarget = targetPrice ? Number(high) >= targetPrice : false;
    const hitStop = stopPrice ? Number(low) <= stopPrice : false;
    if (!hitTarget && !hitStop) return null;
    if (hitTarget && hitStop) {
      const targetMove = targetPrice ? targetPrice - entryPrice : Infinity;
      const stopMove = stopPrice ? entryPrice - stopPrice : Infinity;
      if (targetMove <= stopMove) {
        return { reason: 'take-profit', exitPrice: targetPrice! };
      }
      return { reason: 'stop-loss', exitPrice: stopPrice! };
    }
    if (hitTarget) {
      return { reason: 'take-profit', exitPrice: targetPrice! };
    }
    return { reason: 'stop-loss', exitPrice: stopPrice! };
  }
  const targetPrice = takeProfitRatio ? entryPrice * (1 - takeProfitRatio / leverageValue) : null;
  const stopPrice = stopLossRatio ? entryPrice * (1 + stopLossRatio / leverageValue) : null;
  const hitTarget = targetPrice ? Number(low) <= targetPrice : false;
  const hitStop = stopPrice ? Number(high) >= stopPrice : false;
  if (!hitTarget && !hitStop) return null;
  if (hitTarget && hitStop) {
    const targetMove = targetPrice ? entryPrice - targetPrice : Infinity;
    const stopMove = stopPrice ? stopPrice - entryPrice : Infinity;
    if (targetMove <= stopMove) {
      return { reason: 'take-profit', exitPrice: targetPrice! };
    }
    return { reason: 'stop-loss', exitPrice: stopPrice! };
  }
  if (hitTarget) {
    return { reason: 'take-profit', exitPrice: targetPrice! };
  }
  return { reason: 'stop-loss', exitPrice: stopPrice! };
};

const resolveContractSize = (value?: number) => {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0 ? numeric : 1;
};

export const calculatePositionMetrics = (
  direction: 'long' | 'short',
  entryPrice: number,
  exitPrice: number,
  qty: number,
  contractSize?: number,
  leverageValue?: number
) => {
  const multiplier = resolveContractSize(contractSize);
  const sanitizedQty = Math.max(Number(qty) || 0, 0);
  const priceDiff = direction === 'long' ? exitPrice - entryPrice : entryPrice - exitPrice;
  const pnl = priceDiff * sanitizedQty * multiplier;
  const notional = computeContractNotional(sanitizedQty, entryPrice, multiplier);
  const marginBasis = leverageValue && leverageValue > 0 ? notional / leverageValue : notional;
  const returnPct = marginBasis ? pnl / Math.max(marginBasis, 1e-6) : 0;
  return {
    multiplier,
    pnl,
    notional,
    returnPct,
  };
};

export interface BacktestOrderLog {
  direction: 'long' | 'short';
  size: number;
  entryPrice: number;
  exitPrice: number;
  entryTime: Date | number | string;
  exitTime: Date | number | string;
  pnl: number;
  returnPct?: number;
  notional?: number;
  contractSize?: number;
}

export const logBacktestTrade = (strategyId: string, trade: BacktestOrderLog) => {
  try {
    const payload = {
      strategyId,
      direction: trade.direction,
      size: trade.size,
      entryPrice: trade.entryPrice,
      exitPrice: trade.exitPrice,
      entryTime:
        trade.entryTime instanceof Date
          ? trade.entryTime.toISOString()
          : trade.entryTime,
      exitTime:
        trade.exitTime instanceof Date ? trade.exitTime.toISOString() : trade.exitTime,
      pnl: trade.pnl,
      returnPct: trade.returnPct,
      notional: trade.notional,
      contractSize: trade.contractSize,
    };
    console.log('[Backtest] 下单回放', payload);
  } catch (error) {
    console.error('[Backtest] 打印下单日志失败', error);
  }
};
