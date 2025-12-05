import { Request, Response } from 'express';
import Category from '../models/Category';

// 获取所有分类
export const getCategories = async (req: Request, res: Response) => {
  try {
    const categories = await Category.find().sort({ name: 1 });
    res.json(categories);
  } catch (error) {
    res.status(500).json({ message: '获取分类失败', error });
  }
};

// 获取单个分类
export const getCategoryBySlug = async (req: Request, res: Response) => {
  try {
    const category = await Category.findOne({ slug: req.params.slug });

    if (!category) {
      return res.status(404).json({ message: '分类不存在' });
    }

    res.json(category);
  } catch (error) {
    res.status(500).json({ message: '获取分类失败', error });
  }
};

// 创建分类
export const createCategory = async (req: Request, res: Response) => {
  try {
    const category = new Category(req.body);
    await category.save();
    res.status(201).json(category);
  } catch (error) {
    res.status(400).json({ message: '创建分类失败', error });
  }
};

// 更新分类
export const updateCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true
    });

    if (!category) {
      return res.status(404).json({ message: '分类不存在' });
    }

    res.json(category);
  } catch (error) {
    res.status(400).json({ message: '更新分类失败', error });
  }
};

// 删除分类
export const deleteCategory = async (req: Request, res: Response) => {
  try {
    const category = await Category.findByIdAndDelete(req.params.id);

    if (!category) {
      return res.status(404).json({ message: '分类不存在' });
    }

    res.json({ message: '分类删除成功' });
  } catch (error) {
    res.status(500).json({ message: '删除分类失败', error });
  }
};
