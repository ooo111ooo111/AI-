import { Request, Response } from 'express';
import Tag from '../models/Tag';

// 获取所有标签
export const getTags = async (req: Request, res: Response) => {
  try {
    const tags = await Tag.find().sort({ name: 1 });
    res.json(tags);
  } catch (error) {
    res.status(500).json({ message: '获取标签失败', error });
  }
};

// 获取单个标签
export const getTagBySlug = async (req: Request, res: Response) => {
  try {
    const tag = await Tag.findOne({ slug: req.params.slug });

    if (!tag) {
      return res.status(404).json({ message: '标签不存在' });
    }

    res.json(tag);
  } catch (error) {
    res.status(500).json({ message: '获取标签失败', error });
  }
};

// 创建标签
export const createTag = async (req: Request, res: Response) => {
  try {
    const tag = new Tag(req.body);
    await tag.save();
    res.status(201).json(tag);
  } catch (error) {
    res.status(400).json({ message: '创建标签失败', error });
  }
};

// 更新标签
export const updateTag = async (req: Request, res: Response) => {
  try {
    const tag = await Tag.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!tag) {
      return res.status(404).json({ message: '标签不存在' });
    }

    res.json(tag);
  } catch (error) {
    res.status(400).json({ message: '更新标签失败', error });
  }
};

// 删除标签
export const deleteTag = async (req: Request, res: Response) => {
  try {
    const tag = await Tag.findByIdAndDelete(req.params.id);

    if (!tag) {
      return res.status(404).json({ message: '标签不存在' });
    }

    res.json({ message: '标签删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除标签失败', error });
  }
};
