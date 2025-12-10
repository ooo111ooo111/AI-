import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  createGateOrder,
  createStrategyInstance,
  deleteStrategyInstance,
  deleteGateCredentials,
  fetchGateAccount,
  fetchGateContracts,
  fetchGatePositions,
  getQuantStatus,
  getStrategyInstancePerformance,
  getStrategyRunLogs,
  listStrategyInstances,
  runQuantStrategy,
  saveGateCredentials,
  startStrategyInstance,
  stopStrategyInstance,
} from '../controllers/quant.controller';
import { runStrategyBacktest } from '../controllers/backtest.controller';

const router = Router();

router.use(requireAuth);

router.get('/status', getQuantStatus);
router.post('/gate/credentials', saveGateCredentials);
router.delete('/gate/credentials', deleteGateCredentials);
router.get('/gate/contracts', fetchGateContracts);
router.get('/gate/account', fetchGateAccount);
router.get('/gate/positions', fetchGatePositions);
router.post('/gate/strategy/run', runQuantStrategy);
router.post('/backtest', runStrategyBacktest);
router.get('/strategies/instances', listStrategyInstances);
router.post('/strategies/instances', createStrategyInstance);
router.post('/strategies/instances/:id/start', startStrategyInstance);
router.post('/strategies/instances/:id/stop', stopStrategyInstance);
router.delete('/strategies/instances/:id', deleteStrategyInstance);
router.get('/strategies/instances/:id/performance', getStrategyInstancePerformance);
router.get('/strategies/instances/:id/runs', getStrategyRunLogs);
router.post('/gate/orders', createGateOrder);

export default router;
