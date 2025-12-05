#!/bin/bash

# AI 交易分析系统 - 快速部署脚本

set -e

echo "================================="
echo "  AI 交易分析系统 - 快速部署"
echo "================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查命令是否存在
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# 检查必要工具
echo "检查必要工具..."

if ! command_exists node; then
    echo -e "${RED}✗ Node.js 未安装${NC}"
    echo "请先安装 Node.js 18+: https://nodejs.org/"
    exit 1
fi
echo -e "${GREEN}✓ Node.js $(node -v)${NC}"

if ! command_exists npm; then
    echo -e "${RED}✗ npm 未安装${NC}"
    exit 1
fi
echo -e "${GREEN}✓ npm $(npm -v)${NC}"

if ! command_exists docker; then
    echo -e "${YELLOW}⚠ Docker 未安装，将使用本地部署模式${NC}"
    DEPLOYMENT_MODE="local"
else
    echo -e "${GREEN}✓ Docker $(docker -v | cut -d' ' -f3)${NC}"
    DEPLOYMENT_MODE="docker"
fi

echo ""

# 询问部署模式
echo "选择部署模式:"
echo "  1) Docker 部署（推荐，自动安装 MongoDB）"
echo "  2) 本地部署（需要手动安装 MongoDB）"
read -p "请输入选项 (1/2): " mode_choice

if [ "$mode_choice" == "1" ]; then
    DEPLOYMENT_MODE="docker"
elif [ "$mode_choice" == "2" ]; then
    DEPLOYMENT_MODE="local"
else
    echo -e "${RED}无效选项${NC}"
    exit 1
fi

echo ""

# Docker 部署
if [ "$DEPLOYMENT_MODE" == "docker" ]; then
    echo "===== Docker 部署模式 ====="
    echo ""

    # 检查 .env 文件
    if [ ! -f .env ]; then
        echo "配置环境变量..."
        cp .env.docker .env
        echo -e "${YELLOW}请编辑 .env 文件，填入你的配置：${NC}"
        echo "  - DASHSCOPE_API_KEY: 阿里云 DashScope API Key"
        echo "  - MONGO_PASSWORD: MongoDB 密码"
        echo ""
        read -p "是否现在编辑 .env 文件？(y/n): " edit_env
        if [ "$edit_env" == "y" ]; then
            ${EDITOR:-nano} .env
        else
            echo -e "${RED}请手动编辑 .env 文件后再次运行此脚本${NC}"
            exit 0
        fi
    fi

    # 启动 Docker Compose
    echo ""
    echo "启动 Docker 容器..."
    docker compose up -d --build

    echo ""
    echo -e "${GREEN}✓ Docker 部署完成！${NC}"
    echo ""
    echo "服务地址："
    echo "  - 前端: http://localhost"
    echo "  - 后端: http://localhost:3000"
    echo "  - MongoDB: localhost:27017"
    echo ""
    echo "管理命令："
    echo "  - 查看日志: docker compose logs -f"
    echo "  - 重启服务: docker compose restart"
    echo "  - 停止服务: docker compose down"
    echo ""

# 本地部署
else
    echo "===== 本地部署模式 ====="
    echo ""

    # 检查 MongoDB
    if ! command_exists mongod; then
        echo -e "${RED}✗ MongoDB 未安装${NC}"
        echo "请先安装 MongoDB:"
        echo "  macOS: brew install mongodb-community@6.0"
        echo "  Ubuntu: 参见 DEPLOYMENT.md"
        exit 1
    fi
    echo -e "${GREEN}✓ MongoDB 已安装${NC}"

    # 检查 MongoDB 是否运行
    if ! pgrep -x "mongod" > /dev/null; then
        echo -e "${YELLOW}⚠ MongoDB 未运行，正在启动...${NC}"
        if [[ "$OSTYPE" == "darwin"* ]]; then
            brew services start mongodb-community@6.0
        else
            sudo systemctl start mongod
        fi
        sleep 3
    fi
    echo -e "${GREEN}✓ MongoDB 运行中${NC}"

    # 部署后端
    echo ""
    echo "===== 部署后端 ====="
    cd backend

    if [ ! -f .env ]; then
        echo "配置后端环境变量..."
        cp .env.example .env
        echo -e "${YELLOW}请编辑 backend/.env 文件，填入你的 DASHSCOPE_API_KEY${NC}"
        read -p "按回车继续..."
    fi

    echo "安装后端依赖..."
    npm install

    echo "构建后端..."
    npm run build

    echo "启动后端..."
    if command_exists pm2; then
        pm2 delete crypto-backend 2>/dev/null || true
        pm2 start dist/server.js --name crypto-backend
        echo -e "${GREEN}✓ 后端已使用 PM2 启动${NC}"
    else
        echo -e "${YELLOW}⚠ PM2 未安装，使用 npm start 启动后端（推荐安装 PM2）${NC}"
        nohup npm start > backend.log 2>&1 &
        echo $! > backend.pid
        echo -e "${GREEN}✓ 后端已在后台启动（PID: $(cat backend.pid))${NC}"
    fi

    cd ..

    # 部署前端
    echo ""
    echo "===== 部署前端 ====="
    cd frontend

    if [ ! -f .env ]; then
        echo "VITE_API_URL=http://localhost:3000/api" > .env
    fi

    echo "安装前端依赖..."
    npm install

    echo "构建前端..."
    npm run build

    echo "启动前端..."
    if command_exists pm2; then
        pm2 delete crypto-frontend 2>/dev/null || true
        pm2 serve dist 5173 --name crypto-frontend --spa
        echo -e "${GREEN}✓ 前端已使用 PM2 启动${NC}"
    else
        echo -e "${YELLOW}⚠ PM2 未安装，使用 npm run preview 启动前端${NC}"
        nohup npm run preview > frontend.log 2>&1 &
        echo $! > frontend.pid
        echo -e "${GREEN}✓ 前端已在后台启动（PID: $(cat frontend.pid))${NC}"
    fi

    cd ..

    echo ""
    echo -e "${GREEN}✓ 本地部署完成！${NC}"
    echo ""
    echo "服务地址："
    echo "  - 前端: http://localhost:5173"
    echo "  - 后端: http://localhost:3000"
    echo ""
    if command_exists pm2; then
        echo "管理命令（PM2）："
        echo "  - 查看状态: pm2 status"
        echo "  - 查看日志: pm2 logs"
        echo "  - 重启服务: pm2 restart all"
        echo "  - 停止服务: pm2 stop all"
    else
        echo "停止服务："
        echo "  - 后端: kill \$(cat backend/backend.pid)"
        echo "  - 前端: kill \$(cat frontend/frontend.pid)"
    fi
    echo ""
fi

echo -e "${GREEN}🎉 部署成功！请访问前端地址开始使用。${NC}"
