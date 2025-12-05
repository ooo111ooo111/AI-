# AI 交易分析系统 - 完整部署指南

本文档提供三种部署方案：**本地部署**、**服务器部署（PM2 + Nginx）**、**Docker 部署**。

---

## 📋 目录

- [方案一：本地部署](#方案一本地部署)
- [方案二：服务器部署（PM2 + Nginx）](#方案二服务器部署pm2--nginx)
- [方案三：Docker 部署（推荐）](#方案三docker-部署推荐)
- [常见问题](#常见问题)

---

## 方案一：本地部署

适合：开发测试、快速体验

### 1. 环境准备

**系统要求**：
- Node.js >= 18
- MongoDB >= 5.0
- 阿里云 DashScope API Key

**安装 MongoDB**：

**macOS**：
```bash
brew tap mongodb/brew
brew install mongodb-community@6.0
brew services start mongodb-community@6.0
```

**Ubuntu/Debian**：
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-6.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/6.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-6.0.list
sudo apt update
sudo apt install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

### 2. 后端部署

```bash
# 进入后端目录
cd backend

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env，填入你的 API Key
nano .env

# 构建项目
npm run build

# 启动后端
npm start
```

**后端 .env 配置**：
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/crypto_analysis
NODE_ENV=production
DASHSCOPE_API_KEY=sk-your-actual-api-key-here
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1
UPLOAD_DIR=uploads
```

后端将运行在 http://localhost:3000

### 3. 前端部署

```bash
# 进入前端目录
cd frontend

# 安装依赖
npm install

# 配置环境变量（可选）
echo "VITE_API_URL=http://localhost:3000/api" > .env

# 构建生产版本
npm run build

# 使用 Vite 预览（测试用）
npm run preview
# 或使用任意静态服务器
npx serve -s dist -p 5173
```

前端将运行在 http://localhost:5173

### 4. 验证部署

访问 http://localhost:5173，测试图片上传和分析功能。

---

## 方案二：服务器部署（PM2 + Nginx）

适合：生产环境、需要高可用性

### 1. 服务器环境准备

```bash
# 更新系统
sudo apt update && sudo apt upgrade -y

# 安装 Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# 安装 PM2（进程管理器）
sudo npm install -g pm2

# 安装 Nginx
sudo apt install -y nginx

# 安装 MongoDB（见方案一）
```

### 2. 上传代码

```bash
# 在服务器上创建目录
sudo mkdir -p /var/www/crypto-analysis
sudo chown -R $USER:$USER /var/www/crypto-analysis

# 本地上传代码（使用 scp 或 git）
# 方式1：使用 scp
scp -r ./AI交易分析 user@your-server:/var/www/crypto-analysis

# 方式2：使用 git（推荐）
cd /var/www/crypto-analysis
git clone <your-repo-url> .
```

### 3. 部署后端

```bash
cd /var/www/crypto-analysis/backend

# 安装依赖
npm install --production

# 配置环境变量
cp .env.example .env
nano .env  # 修改配置

# 构建项目
npm run build

# 使用 PM2 启动
pm2 start dist/server.js --name crypto-backend
pm2 save
pm2 startup  # 设置开机自启
```

**PM2 高级配置** `ecosystem.config.js`：
```javascript
module.exports = {
  apps: [{
    name: 'crypto-backend',
    script: './dist/server.js',
    instances: 'max',  // 使用所有 CPU 核心
    exec_mode: 'cluster',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    max_memory_restart: '1G',
    autorestart: true,
    watch: false
  }]
};
```

启动命令：
```bash
pm2 start ecosystem.config.js --env production
pm2 logs crypto-backend  # 查看日志
pm2 status               # 查看状态
```

### 4. 部署前端

```bash
cd /var/www/crypto-analysis/frontend

# 安装依赖
npm install

# 构建生产版本（配置正确的 API 地址）
echo "VITE_API_URL=https://your-domain.com/api" > .env
npm run build

# 构建结果在 ./dist 目录
```

### 5. 配置 Nginx

创建 Nginx 配置文件 `/etc/nginx/sites-available/crypto-analysis`：

```nginx
# HTTP 配置
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # 前端静态文件
    root /var/www/crypto-analysis/frontend/dist;
    index index.html;

    # 启用 gzip 压缩
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript
               application/x-javascript application/xml+rss
               application/json application/javascript image/svg+xml;

    # 前端 SPA 路由
    location / {
        try_files $uri $uri/ /index.html;
    }

    # 后端 API 代理
    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # 增加上传大小限制
        client_max_body_size 10M;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # 上传图片访问
    location /uploads/ {
        alias /var/www/crypto-analysis/backend/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # 静态资源缓存
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # 安全头部
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**启用配置**：
```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/crypto-analysis /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重启 Nginx
sudo systemctl restart nginx
```

### 6. 配置 HTTPS（推荐）

使用 Let's Encrypt 免费 SSL 证书：

```bash
# 安装 Certbot
sudo apt install -y certbot python3-certbot-nginx

# 获取 SSL 证书（自动配置 Nginx）
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# 测试自动续期
sudo certbot renew --dry-run

# 查看证书状态
sudo certbot certificates
```

### 7. 防火墙配置

```bash
# 允许 HTTP 和 HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 22/tcp  # SSH
sudo ufw enable
sudo ufw status
```

### 8. 日常维护命令

```bash
# PM2 管理
pm2 status              # 查看状态
pm2 logs crypto-backend # 查看日志
pm2 restart crypto-backend  # 重启
pm2 stop crypto-backend     # 停止
pm2 delete crypto-backend   # 删除

# Nginx 管理
sudo systemctl status nginx   # 查看状态
sudo systemctl reload nginx   # 重载配置
sudo systemctl restart nginx  # 重启
sudo nginx -t                 # 测试配置

# MongoDB 管理
sudo systemctl status mongod
mongosh  # 连接 MongoDB
```

---

## 方案三：Docker 部署（推荐）

适合：快速部署、易于维护、跨平台一致性

### 1. 安装 Docker

**macOS**：
```bash
brew install --cask docker
```

**Ubuntu/Debian**：
```bash
# 安装 Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# 安装 Docker Compose
sudo apt install -y docker-compose-plugin

# 添加当前用户到 docker 组
sudo usermod -aG docker $USER
newgrp docker

# 验证安装
docker --version
docker compose version
```

### 2. 配置环境变量

编辑 `.env.docker` 文件：

```bash
cd /Users/mibo/Desktop/项目/AI交易分析
cp .env.docker .env

# 编辑 .env
nano .env
```

**配置内容**：
```env
# MongoDB 管理员密码（请修改为强密码）
MONGO_PASSWORD=YourStrongPassword123!

# 阿里云 DashScope API Key（必填）
DASHSCOPE_API_KEY=sk-your-actual-api-key-here

# DashScope API Base URL
DASHSCOPE_BASE_URL=https://dashscope.aliyuncs.com/compatible-mode/v1

# 前端 API 地址（生产环境修改为实际域名）
VITE_API_URL=http://your-domain.com/api
```

### 3. 构建并启动服务

```bash
# 构建镜像并启动
docker compose up -d --build

# 查看服务状态
docker compose ps

# 查看日志
docker compose logs -f

# 查看特定服务日志
docker compose logs -f backend
docker compose logs -f frontend
```

### 4. 验证部署

```bash
# 检查服务健康状态
docker compose ps

# 测试后端 API
curl http://localhost:3000/api/health

# 测试前端
curl http://localhost:80
```

访问 http://localhost 即可使用应用。

### 5. 生产环境优化

**使用 Nginx 反向代理（推荐）**：

创建 `nginx-proxy.conf`：
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /api/ {
        proxy_pass http://localhost:3000/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 10M;
    }

    location /uploads/ {
        proxy_pass http://localhost:3000/uploads/;
        expires 30d;
    }
}
```

### 6. Docker 管理命令

```bash
# 查看运行状态
docker compose ps

# 查看日志
docker compose logs -f [service_name]

# 重启服务
docker compose restart [service_name]

# 停止所有服务
docker compose down

# 停止并删除数据卷（危险！）
docker compose down -v

# 更新服务
docker compose pull
docker compose up -d --build

# 进入容器
docker compose exec backend sh
docker compose exec mongodb mongosh

# 清理未使用的资源
docker system prune -a
```

### 7. 数据备份

```bash
# 备份 MongoDB
docker compose exec mongodb mongodump --out /data/backup
docker cp crypto-mongodb:/data/backup ./backup-$(date +%Y%m%d)

# 恢复 MongoDB
docker cp ./backup-20251205 crypto-mongodb:/data/backup
docker compose exec mongodb mongorestore /data/backup

# 备份上传的图片
docker cp crypto-backend:/app/uploads ./uploads-backup-$(date +%Y%m%d)
```

---

## 常见问题

### 1. 端口被占用

**问题**：启动服务时提示端口被占用。

**解决**：
```bash
# 查看端口占用
sudo lsof -i :3000
sudo lsof -i :80

# 杀死进程
kill -9 <PID>

# 或修改 docker-compose.yml 中的端口映射
ports:
  - "8080:80"  # 将前端映射到 8080 端口
```

### 2. MongoDB 连接失败

**问题**：后端无法连接 MongoDB。

**解决**：
```bash
# 检查 MongoDB 是否运行
sudo systemctl status mongod  # 本地部署
docker compose ps             # Docker 部署

# 检查连接字符串
# 本地：mongodb://localhost:27017/crypto_analysis
# Docker：mongodb://admin:password@mongodb:27017/crypto_analysis?authSource=admin
```

### 3. 图片上传失败

**问题**：上传图片时返回 413 错误。

**解决**：
```bash
# Nginx 配置中增加
client_max_body_size 10M;

# 重启 Nginx
sudo systemctl restart nginx
```

### 4. 前端 API 请求失败（CORS 错误）

**问题**：浏览器控制台显示 CORS 错误。

**解决**：
- 检查后端 CORS 配置是否正确
- 确保前端 `.env` 中的 `VITE_API_URL` 配置正确
- 生产环境建议通过 Nginx 反向代理，统一域名

### 5. Docker 容器启动失败

**问题**：`docker compose up` 失败。

**解决**：
```bash
# 查看详细日志
docker compose logs

# 检查 .env 文件是否配置正确
cat .env

# 清理并重新构建
docker compose down
docker compose up -d --build --force-recreate
```

---

## 性能优化建议

1. **启用 Redis 缓存**（高级）：缓存 AI 分析结果，减少重复调用
2. **使用 CDN**：加速静态资源加载
3. **启用 HTTP/2**：配置 Nginx 支持 HTTP/2
4. **数据库索引**：MongoDB 已配置必要索引，定期检查查询性能
5. **日志轮转**：配置日志自动清理，避免磁盘占满

---

## 安全建议

1. **修改默认密码**：MongoDB、系统用户密码使用强密码
2. **启用防火墙**：只开放必要端口（80、443、22）
3. **定期更新**：及时更新系统和依赖包
4. **API 密钥保护**：不要将 `.env` 文件提交到 Git
5. **HTTPS 强制**：生产环境强制使用 HTTPS

---

## 监控和告警（可选）

使用 PM2 Plus 或 Prometheus + Grafana 监控服务状态。

**PM2 监控**：
```bash
pm2 install pm2-logrotate  # 日志轮转
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7

pm2 monitor  # 启用 PM2 Plus 监控
```

---

## 联系支持

- GitHub Issues: <your-repo-url>/issues
- 文档: README.md

祝部署顺利！🚀
