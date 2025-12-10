import { EventEmitter } from 'events';

export type StrategyRunEvent = {
  type: 'strategy:run';
  instanceId: string;
  userId: string;
  payload: any;
};

export type StrategyErrorEvent = {
  type: 'strategy:error';
  instanceId: string;
  userId: string;
  error: string;
};

export type StrategyStatusEvent = {
  type: 'strategy:status';
  instanceId: string;
  userId: string;
  status: string;
};

export type StrategyEvent = StrategyRunEvent | StrategyErrorEvent | StrategyStatusEvent;

class StrategyEventBus extends EventEmitter {
  emitEvent(event: StrategyEvent) {
    this.emit('event', event);
  }

  onEvent(listener: (event: StrategyEvent) => void) {
    this.on('event', listener);
  }
}

export const strategyEventBus = new StrategyEventBus();
