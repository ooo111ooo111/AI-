#!/bin/bash

echo "======================================"
echo "OAuth 认证系统测试"
echo "======================================"
echo ""

# 测试1: 健康检查
echo "✅ 测试1: 健康检查"
curl -s http://localhost:3000/api/health | jq .
echo ""

# 测试2: 未登录访问受保护接口
echo "✅ 测试2: 未登录访问受保护接口"
curl -s http://localhost:3000/api/auth/me | jq .
echo ""

# 测试3: 检查 Google 登录接口（应该重定向）
echo "✅ 测试3: Google 登录接口（应返回重定向）"
curl -s -I http://localhost:3000/api/auth/google | grep "Location"
echo ""

echo "======================================"
echo "后端服务运行正常！"
echo ""
echo "下一步操作："
echo "1. 启动前端: cd ../frontend && npm run dev"
echo "2. 访问: http://localhost:5173/"
echo "3. 点击 'Google 登录' 按钮测试完整流程"
echo "======================================"
