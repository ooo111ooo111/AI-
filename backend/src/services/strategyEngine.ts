import { EventEmitter } from 'events';
import StrategyInstance, { IStrategyInstance } from '../models/StrategyInstance';
import User from '../models/User';
import { strategyEventBus } from '../events/strategy.events';
import { runStrategyById } from './strategies';
import { isAdminEmail } from '../utils/admin.util';
import { handleStrategyPerformance } from './strategyPerformance.service';
import StrategyRunLog from '../models/StrategyRunLog';

const intervalToMs = (interval: string) => {
  if (!interval) return 60000;
  const match = /^([0-9]+)([mhd])$/i.exec(interval.trim());
  if (!match) return 60000;
  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  if (Number.isNaN(value) || value <= 0) return 60000;
  switch (unit) {
    case 'h':
      return value * 60 * 60 * 1000;
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'm':
    default:
      return value * 60 * 1000;
  }
};

class StrategyRunner extends EventEmitter {
  private timer: NodeJS.Timeout | null = null;

  constructor(private instance: IStrategyInstance) {
    super();
  }

  start() {
    this.stop();
    const frequency = this.instance.config.frequencyMs || intervalToMs(this.instance.config.interval);
    this.timer = setInterval(() => this.execute(), frequency);
    // run immediately for quick feedback
    this.execute();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async execute() {
    let logEntryId: string | null = null;
    try {
      try {
        const log = await StrategyRunLog.create({
          user: this.instance.user,
          instance: this.instance._id,
          strategyId: this.instance.strategyId,
          status: 'running',
          autoExecute: this.instance.config.autoExecute,
          startedAt: new Date(),
        });
        logEntryId = log._id.toString();
      } catch (logError) {
        console.error('[StrategyEngine] 创建策略执行日志失败', logError);
      }

      const user = await User.findById(this.instance.user).select('+gateSettings.apiSecret');
      if (!user?.gateSettings) {
        throw new Error('缺少 Gate 凭证');
      }
      const useTestnet = isAdminEmail(user?.email);
      const result = await runStrategyById({
        strategyId: this.instance.strategyId || 'sai-scalper',
        settle: this.instance.config.settle,
        contract: this.instance.config.contract,
        interval: this.instance.config.interval,
        lookback: this.instance.config.lookback,
        threshold: this.instance.config.threshold,
        baseSize: this.instance.config.baseSize,
        autoExecute: this.instance.config.autoExecute,
        gateSettings: user.gateSettings,
        useHeikinAshi: this.instance.config.useHeikinAshi,
        useTestnet,
        takeProfitPct: this.instance.config.takeProfitPct,
        stopLossPct: this.instance.config.stopLossPct,
        leverage: this.instance.config.leverage,
      });
      await handleStrategyPerformance(
        this.instance._id.toString(),
        this.instance.user.toString(),
        this.instance.strategyId,
        result as any
      );
      await StrategyInstance.findByIdAndUpdate(this.instance._id, {
        lastRunAt: new Date(),
        lastSignal: result.strategy.action,
        status: 'running',
      });

      if (logEntryId) {
        const resultStrategy: any = (result as any)?.strategy || {};
        const resultExecution: any = (result as any)?.execution || {};
        const resultDiagnostics: any = (result as any)?.diagnostics;
        const resultMarket: any = (result as any)?.market;
        const executionId = resultExecution?.id || resultExecution?.text;
        const shouldTradeValue =
          typeof resultStrategy?.shouldTrade === 'boolean'
            ? resultStrategy.shouldTrade
            : Boolean(resultStrategy?.signalTriggered);
        const recommendedSize = Number(resultStrategy?.recommendedSize ?? resultStrategy?.size ?? 0);
        const recommendedNotional = Number(resultStrategy?.recommendedNotional ?? 0);

        await StrategyRunLog.findByIdAndUpdate(logEntryId, {
          status: 'success',
          action: resultStrategy?.action,
          shouldTrade: shouldTradeValue,
          autoExecute: this.instance.config.autoExecute,
          orderSize: recommendedSize,
          orderNotional: recommendedNotional,
          orderId: executionId,
          snapshot: {
            strategy: resultStrategy,
            execution: resultExecution,
            diagnostics: resultDiagnostics,
            market: resultMarket,
          },
          finishedAt: new Date(),
        }).catch((error) => {
          console.error('[StrategyEngine] 更新执行日志失败', error);
        });
      }

      strategyEventBus.emitEvent({
        type: 'strategy:run',
        instanceId: this.instance._id.toString(),
        userId: this.instance.user.toString(),
        payload: result,
      });
    } catch (error: any) {
      if (logEntryId) {
        await StrategyRunLog.findByIdAndUpdate(logEntryId, {
          status: 'error',
          errorMessage: error?.message || '执行策略失败',
          finishedAt: new Date(),
        }).catch((logError) => {
          console.error('[StrategyEngine] 写入失败日志出错', logError);
        });
      }
      strategyEventBus.emitEvent({
        type: 'strategy:error',
        instanceId: this.instance._id.toString(),
        userId: this.instance.user.toString(),
        error: error?.message || '执行策略失败',
      });
    }
  }
}

export class StrategyEngine {
  private static _instance: StrategyEngine;
  private runners = new Map<string, StrategyRunner>();

  static get instance() {
    if (!StrategyEngine._instance) {
      StrategyEngine._instance = new StrategyEngine();
    }
    return StrategyEngine._instance;
  }

  async bootstrap() {
    const activeInstances = await StrategyInstance.find({ status: 'running' }).lean();
    activeInstances.forEach((instanceDoc) => {
      const hydrated = StrategyInstance.hydrate(instanceDoc);
      this.register(hydrated as IStrategyInstance);
    });
    console.log(`[StrategyEngine] 已加载 ${activeInstances.length} 个策略实例`);
  }

  register(instance: IStrategyInstance) {
    const runner = new StrategyRunner(instance);
    this.runners.set(instance._id.toString(), runner);
    runner.start();
    strategyEventBus.emitEvent({
      type: 'strategy:status',
      instanceId: instance._id.toString(),
      userId: instance.user.toString(),
      status: 'running',
    });
  }

  async stop(instanceId: string) {
    const runner = this.runners.get(instanceId);
    if (runner) {
      runner.stop();
      this.runners.delete(instanceId);
    }
    await StrategyInstance.findByIdAndUpdate(instanceId, { status: 'stopped' });
  }
}

export const strategyEngine = StrategyEngine.instance;
