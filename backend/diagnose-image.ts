#!/usr/bin/env tsx

/**
 * 图片加载问题诊断脚本
 * 检查前后端配置和图片访问
 */

import * as dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import http from 'http';

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🔍 图片加载问题诊断\n');
console.log('=' .repeat(50));

// 1. 检查环境变量
console.log('\n1️⃣  环境变量检查:');
const port = process.env.PORT || 3000;
const uploadDir = process.env.UPLOAD_DIR || 'uploads';
console.log(`   PORT: ${port}`);
console.log(`   UPLOAD_DIR: ${uploadDir}`);

// 2. 检查 uploads 目录
console.log('\n2️⃣  上传目录检查:');
const uploadsPath = path.join(__dirname, uploadDir);
const exists = fs.existsSync(uploadsPath);
console.log(`   路径: ${uploadsPath}`);
console.log(`   存在: ${exists ? '✅' : '❌'}`);

if (exists) {
  const files = fs.readdirSync(uploadsPath).filter(f => !f.startsWith('.'));
  console.log(`   文件数量: ${files.length}`);
  if (files.length > 0) {
    console.log(`   最新文件: ${files[files.length - 1]}`);
  }
}

// 3. 测试图片访问
console.log('\n3️⃣  图片访问测试:');

if (exists) {
  const files = fs.readdirSync(uploadsPath).filter(f => !f.startsWith('.'));

  if (files.length > 0) {
    const testFile = files[0];
    const testUrl = `http://localhost:${port}/uploads/${testFile}`;

    console.log(`   测试 URL: ${testUrl}`);
    console.log('   发起请求...');

    const options = {
      hostname: 'localhost',
      port: port,
      path: `/uploads/${testFile}`,
      method: 'GET'
    };

    const req = http.request(options, (res) => {
      console.log(`   HTTP 状态: ${res.statusCode} ${res.statusMessage}`);
      console.log(`   Content-Type: ${res.headers['content-type']}`);

      if (res.statusCode === 200) {
        console.log('   ✅ 图片可访问');
      } else if (res.statusCode === 404) {
        console.log('   ❌ 图片未找到 (404)');
        console.log('   请检查静态文件中间件配置');
      } else {
        console.log(`   ⚠️  异常状态码: ${res.statusCode}`);
      }
    });

    req.on('error', (err) => {
      console.log(`   ❌ 请求失败: ${err.message}`);
      console.log('   请确保后端服务正在运行: npm run dev');
    });

    req.end();
  } else {
    console.log('   ⚠️  uploads 目录为空，请先上传图片');
  }
} else {
  console.log('   ❌ uploads 目录不存在');
  console.log('   解决方案: mkdir uploads');
}

// 4. 前端配置检查
console.log('\n4️⃣  前端配置建议:');
console.log('   VITE_API_URL 应该设置为: http://localhost:3000/api');
console.log('   图片 URL 格式: http://localhost:3000/uploads/xxx.png');
console.log('   注意: 图片路径不包含 /api 前缀');

console.log('\n' + '='.repeat(50));
console.log('\n✅ 诊断完成！\n');

// 5. 常见问题和解决方案
console.log('💡 常见问题和解决方案:\n');
console.log('问题 1: 图片 404');
console.log('   原因: 静态文件路径配置错误');
console.log('   解决: 检查 server.ts 中 express.static 配置\n');

console.log('问题 2: CORS 错误');
console.log('   原因: 跨域请求被阻止');
console.log('   解决: 确保后端启用了 CORS 中间件\n');

console.log('问题 3: 图片路径拼接错误');
console.log('   原因: VITE_API_URL 包含 /api，但图片在 /uploads');
console.log('   解决: 前端代码中移除 /api 后缀\n');

setTimeout(() => {
  console.log('提示: 请在另一个终端窗口运行后端服务');
  console.log('命令: cd backend && npm run dev\n');
}, 100);
