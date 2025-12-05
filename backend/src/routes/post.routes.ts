import { Router } from 'express';
import {
  getPosts,
  getPostBySlug,
  createPost,
  updatePost,
  deletePost,
  searchPosts
} from '../controllers/post.controller';

const router = Router();

router.get('/', getPosts);
router.get('/search', searchPosts);
router.get('/:slug', getPostBySlug);
router.post('/', createPost);
router.put('/:id', updatePost);
router.delete('/:id', deletePost);

export default router;
