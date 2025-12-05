# 多阶段构建：构建阶段
FROM node:18-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci --only=production && npm cache clean --force

# 复制源代码
COPY . .

# 构建 TypeScript
RUN npm run build

# 生产阶段
FROM node:18-alpine

WORKDIR /app

# 复制依赖
COPY --from=builder /app/node_modules ./node_modules

# 复制构建结果
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# 创建上传目录
RUN mkdir -p uploads && chown -R node:node uploads

# 使用非 root 用户
USER node

# 暴露端口
EXPOSE 3000

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/api/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# 启动应用
CMD ["node", "dist/server.js"]
