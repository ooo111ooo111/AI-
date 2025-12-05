import { Router } from 'express';
import {
  createAnalysis,
  getAnalyses,
  getAnalysisById,
  deleteAnalysis,
  getStats
} from '../controllers/analysis.controller';
import { upload } from '../middleware/upload';

const router = Router();

// 创建分析（上传图片）
router.post('/', upload.single('image'), createAnalysis);

// 获取分析列表
router.get('/', getAnalyses);

// 获取统计数据
router.get('/stats', getStats);

// 获取单个分析
router.get('/:id', getAnalysisById);

// 删除分析
router.delete('/:id', deleteAnalysis);

export default router;
