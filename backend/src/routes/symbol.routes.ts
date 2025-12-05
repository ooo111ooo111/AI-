import { Router } from 'express';
import { SUPPORTED_SYMBOLS } from '../config/constants';

const router = Router();

// 获取支持的币种列表
router.get('/', (req, res) => {
  res.json({ symbols: SUPPORTED_SYMBOLS });
});

export default router;
