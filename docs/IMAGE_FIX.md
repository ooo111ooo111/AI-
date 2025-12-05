# 图片加载问题修复指南

## 问题描述
分析结果页面的"走势图"区域显示空白，无法加载图片。

## 根本原因
前端图片 URL 拼接错误：
- ❌ 错误: `http://localhost:3000/api/uploads/xxx.png`
- ✅ 正确: `http://localhost:3000/uploads/xxx.png`

**原因**: `VITE_API_URL` 设置为 `http://localhost:3000/api`，但静态文件服务在 `/uploads`（不在 `/api/uploads`）

## ✅ 已修复

### 修改的文件
**frontend/src/components/AnalysisResult.tsx** (L15-21, L37-45)

**修复内容**:
```typescript
// 修复前
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';
const imageUrl = `${apiBaseUrl}${imageUrl}`; // 错误: 拼接出 /api/uploads

// 修复后
const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const baseUrl = apiUrl.replace(/\/api$/, ''); // 移除 /api 后缀
const fullImageUrl = `${baseUrl}${imageUrl}`; // 正确: http://localhost:3000/uploads/xxx.png
```

**额外改进**:
- 添加图片加载错误处理 (`onError`)
- 失败时显示占位符 SVG
- 在控制台输出错误信息方便调试

---

## 🧪 验证修复

### 方法 1: 重启前端服务
```bash
cd frontend
npm run dev
```

刷新浏览器，图片应该能正常加载。

### 方法 2: 运行诊断脚本
```bash
cd backend
npm run diagnose:image
```

检查输出确认：
- ✅ uploads 目录存在
- ✅ 有上传的图片文件
- ✅ 图片 URL 可访问 (HTTP 200)

### 方法 3: 手动测试图片 URL

1. 查看数据库中的 `imageUrl`:
```bash
# 假设 imageUrl = "/uploads/xxx.png"
```

2. 在浏览器中直接访问:
```
http://localhost:3000/uploads/xxx.png
```

应该能看到图片。

---

## 📋 完整的图片加载流程

### 1. 后端上传和保存
```
POST /api/analyses + FormData(image)
  ↓
multer 保存到 backend/uploads/
  ↓
返回 { imageUrl: "/uploads/xxx.png" }
  ↓
保存到 MongoDB
```

### 2. 后端静态文件服务
```typescript
// server.ts:21
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
```

访问: `http://localhost:3000/uploads/xxx.png` → 返回图片文件

### 3. 前端显示
```typescript
// 从数据库获取
const analysis = { imageUrl: "/uploads/xxx.png", ... }

// 拼接完整 URL（修复后）
const baseUrl = "http://localhost:3000" // 移除了 /api
const fullImageUrl = baseUrl + imageUrl // http://localhost:3000/uploads/xxx.png

// 渲染
<img src={fullImageUrl} />
```

---

## 🔍 调试技巧

### 打开浏览器开发者工具

**1. 检查网络请求**
- 打开 Network 标签
- 刷新页面
- 找到图片请求
- 查看状态码：
  - 200: 成功 ✅
  - 404: 未找到 ❌
  - CORS: 跨域错误 ⚠️

**2. 检查控制台错误**
修复后的代码会输出:
```
图片加载失败: http://localhost:3000/uploads/xxx.png
```

**3. 检查元素**
- 右键图片区域 → 检查
- 查看 `<img>` 标签的 `src` 属性
- 确认 URL 格式正确

---

## ⚠️ 常见问题

### Q1: 修复后仍然无法加载
**可能原因**:
1. 前端缓存未清除
2. 后端服务未重启
3. MongoDB 中的 imageUrl 格式错误

**解决方案**:
```bash
# 1. 清除浏览器缓存 (Cmd+Shift+R)
# 2. 重启后端
cd backend && npm run dev

# 3. 检查数据库记录
# 使用 MongoDB Compass 或命令行检查 analyses 集合
```

### Q2: CORS 错误
**症状**: 控制台显示 "blocked by CORS policy"

**解决方案**:
后端已配置 CORS，但如果仍有问题：
```typescript
// server.ts
app.use(cors({
  origin: 'http://localhost:5173', // Vite 默认端口
  credentials: true
}));
```

### Q3: 图片路径不一致
**症状**: 有些图片能加载，有些不能

**原因**: 旧记录使用旧的路径格式

**解决方案**:
```bash
# 清空旧记录重新上传
# 或手动修复数据库中的 imageUrl 字段
```

---

## 📚 相关文件

### 前端
- `frontend/src/components/AnalysisResult.tsx` - 图片显示组件（已修复）
- `frontend/.env` - API 地址配置

### 后端
- `backend/src/server.ts:21` - 静态文件服务配置
- `backend/src/middleware/upload.ts` - 文件上传配置
- `backend/uploads/` - 图片存储目录

### 诊断工具
- `backend/diagnose-image.ts` - 图片加载诊断脚本
- 运行: `npm run diagnose:image`

---

## ✅ 修复确认清单

- [x] 前端代码已修复（移除 /api 后缀）
- [x] 添加图片加载错误处理
- [x] 后端静态文件服务配置正确
- [x] uploads 目录存在且有文件
- [x] 创建诊断脚本
- [ ] 前端服务已重启
- [ ] 图片能正常显示

---

**修复完成时间**: 2025-12-05
**影响范围**: 前端图片显示
**测试状态**: 待用户验证
