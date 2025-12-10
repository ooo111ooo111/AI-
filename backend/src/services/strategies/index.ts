import type { IGateSettings } from '../../models/User';
import { runMeanReversionStrategy, backtestMeanReversion } from './meanReversion.strategy';
import { runSaiScalperStrategy, backtestSaiScalper } from './saiScalper.strategy';
import { runUtBotStrategy, backtestUtBot } from './utBot.strategy';
import { runSmaTrendStrategy, backtestSmaTrend } from './smaTrend.strategy';
import { runRsiStrategy, backtestRsiStrategy } from './rsi.strategy';
import { runDumbShortStrategy } from './dumbShort.strategy';

export type BaseStrategyParams = {
  strategyId: string;
  settle: string;
  contract: string;
  interval: string;
  lookback: number;
  threshold: number;
  baseSize: number;
  autoExecute: boolean;
  gateSettings: IGateSettings;
  useTestnet?: boolean;
  useHeikinAshi?: boolean;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
};

export const runStrategyById = (params: BaseStrategyParams) => {
  const { strategyId } = params;
  switch (strategyId) {
    case 'sai-scalper':
      return runSaiScalperStrategy(params);
    case 'ut-bot':
      return runUtBotStrategy(params);
    case 'sma-trend':
      return runSmaTrendStrategy(params);
    case 'rsi-swing':
      return runRsiStrategy(params);
    case 'test-short':
      return runDumbShortStrategy(params);
    case 'mean-reversion':
    default:
      return runMeanReversionStrategy(params);
  }
};

export interface BacktestParams {
  strategyId: string;
  bars: any[];
  interval: string;
  lookback: number;
  threshold: number;
  baseSize: number;
  useHeikinAshi?: boolean;
  initialCapital: number;
  takeProfitPct?: number;
  stopLossPct?: number;
  leverage?: number;
  contractSize?: number;
}

export const runBacktestByStrategy = (params: BacktestParams) => {
  const { strategyId } = params;
  switch (strategyId) {
    case 'sai-scalper':
      return backtestSaiScalper(params);
    case 'ut-bot':
      return backtestUtBot(params);
    case 'sma-trend':
      return backtestSmaTrend(params);
    case 'rsi-swing':
      return backtestRsiStrategy(params);
    case 'mean-reversion':
    default:
      return backtestMeanReversion(params);
  }
};
