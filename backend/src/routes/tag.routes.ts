import { Router } from 'express';
import {
  getTags,
  getTagBySlug,
  createTag,
  updateTag,
  deleteTag
} from '../controllers/tag.controller';

const router = Router();

router.get('/', getTags);
router.get('/:slug', getTagBySlug);
router.post('/', createTag);
router.put('/:id', updateTag);
router.delete('/:id', deleteTag);

export default router;
