import { Request, Response } from 'express';
import Post from '../models/Post';

// 获取文章列表
export const getPosts = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const posts = await Post.find({ published: true })
      .populate('category', 'name slug')
      .populate('tags', 'name slug')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Post.countDocuments({ published: true });

    res.json({
      posts,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ message: '获取文章列表失败', error });
  }
};

// 获取单篇文章
export const getPostBySlug = async (req: Request, res: Response) => {
  try {
    const post = await Post.findOne({ slug: req.params.slug, published: true })
      .populate('category', 'name slug')
      .populate('tags', 'name slug');

    if (!post) {
      return res.status(404).json({ message: '文章不存在' });
    }

    // 增加浏览次数
    post.viewCount += 1;
    await post.save();

    res.json(post);
  } catch (error) {
    res.status(500).json({ message: '获取文章失败', error });
  }
};

// 创建文章
export const createPost = async (req: Request, res: Response) => {
  try {
    const post = new Post(req.body);
    await post.save();
    res.status(201).json(post);
  } catch (error) {
    res.status(400).json({ message: '创建文章失败', error });
  }
};

// 更新文章
export const updatePost = async (req: Request, res: Response) => {
  try {
    const post = await Post.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!post) {
      return res.status(404).json({ message: '文章不存在' });
    }

    res.json(post);
  } catch (error) {
    res.status(400).json({ message: '更新文章失败', error });
  }
};

// 删除文章
export const deletePost = async (req: Request, res: Response) => {
  try {
    const post = await Post.findByIdAndDelete(req.params.id);

    if (!post) {
      return res.status(404).json({ message: '文章不存在' });
    }

    res.json({ message: '文章删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除文章失败', error });
  }
};

// 搜索文章
export const searchPosts = async (req: Request, res: Response) => {
  try {
    const keyword = req.query.q as string;

    if (!keyword) {
      return res.status(400).json({ message: '搜索关键词不能为空' });
    }

    const posts = await Post.find({
      $text: { $search: keyword },
      published: true
    })
      .populate('category', 'name slug')
      .populate('tags', 'name slug')
      .sort({ score: { $meta: 'textScore' } })
      .limit(20);

    res.json({ posts, count: posts.length });
  } catch (error) {
    res.status(500).json({ message: '搜索失败', error });
  }
};
