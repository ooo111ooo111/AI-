import { gateService } from '../gate.service';
import {
  clampContractsByBalance,
  clampLeverageValue,
  computeContractNotional,
  ensureContractSize,
  getAvailableNotional,
  resolveContractSpecs,
} from './helpers';
import type { BaseStrategyParams } from './index';

const resolveLastPrice = (detail: any): number => {
  const fields = [
    detail?.mark_price,
    detail?.last_price,
    detail?.index_price,
    detail?.price,
  ];
  for (const raw of fields) {
    const price = Number(raw);
    if (Number.isFinite(price) && price > 0) {
      return price;
    }
  }
  return 0;
};

export const runDumbShortStrategy = async (params: BaseStrategyParams) => {
  const {
    settle,
    contract,
    baseSize,
    interval,
    lookback,
    threshold,
    autoExecute,
    gateSettings,
    useTestnet,
    leverage,
  } = params;

  const [contractDetail, account] = await Promise.all([
    gateService.getContractDetail(settle, contract, { useTestnet }),
    gateService.getAccount(settle, gateSettings, { useTestnet }).catch(() => null),
  ]);

  const { multiplier, minContracts, maxLeverage } = resolveContractSpecs(contractDetail);
  const lastPrice = resolveLastPrice(contractDetail);
  const normalizedBase = ensureContractSize(baseSize, minContracts);
  const normalizedLeverage = clampLeverageValue(leverage, maxLeverage);
  const availableNotional = getAvailableNotional(account);

  const requestedContracts = normalizedBase;
  const requestedNotional = computeContractNotional(
    requestedContracts,
    lastPrice || 0,
    multiplier
  );

  const appliedContracts = clampContractsByBalance(
    requestedContracts,
    availableNotional,
    lastPrice || 0,
    multiplier,
    { leverage: normalizedLeverage }
  );
  const finalContracts = Math.max(appliedContracts, 0);
  const appliedNotional = computeContractNotional(
    finalContracts,
    lastPrice || 0,
    multiplier
  );
  const finalShouldTrade = finalContracts > 0;
  const directionalSize = finalShouldTrade ? -Math.abs(finalContracts) : 0;

  const orderPayload = finalShouldTrade
    ? {
        settle,
        contract,
        size: directionalSize.toString(),
        price: '0',
        tif: 'ioc' as const,
      }
    : null;

  let executedOrder: any = null;
  if (autoExecute && orderPayload) {
    if (normalizedLeverage) {
      await gateService.updatePositionLeverage(settle, contract, normalizedLeverage, gateSettings, {
        useTestnet,
      }).catch((error) => {
        console.error('[TestShort] 设置杠杆失败', error);
      });
    }
    executedOrder = await gateService.createOrder(settle, orderPayload, gateSettings, { useTestnet });
  }

  const accountSummary = account
    ? {
        total: (account as any)?.total,
        available: (account as any)?.available,
      }
    : null;

  return {
    strategy: {
      name: 'dumb-short-test',
      interval,
      lookback,
      threshold,
      action: finalShouldTrade ? 'short' : 'hold',
      shouldTrade: finalShouldTrade,
      confidence: 1,
      zScore: -1,
      requestedNotional,
      recommendedSize: finalContracts,
      recommendedNotional: appliedNotional,
      autoExecuted: autoExecute,
      signalTriggered: finalShouldTrade,
      contractSize: multiplier,
      leverageLimit: maxLeverage,
      appliedLeverage: normalizedLeverage ?? 1,
    },
    market: {
      contract,
      settle,
      lastPrice,
    },
    account: accountSummary,
    order: orderPayload,
    execution: executedOrder
      ? {
          status: 'executed' as const,
          id: executedOrder?.id,
          text: executedOrder?.text,
        }
      : {
          status: orderPayload ? ('ready' as const) : ('idle' as const),
        },
    diagnostics: {
      message: '恒定做空测试策略',
      timestamp: Date.now(),
    },
  };
};
