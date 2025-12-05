#!/usr/bin/env tsx

import { analyzeChartImage } from './src/services/qwen.service';
import * as dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

console.log('🚀 Qwen3-VL-Flash 集成验证\n');
console.log('================================\n');

// 检查环境变量
const apiKey = process.env.DASHSCOPE_API_KEY;
const baseUrl = process.env.DASHSCOPE_BASE_URL;

console.log('环境变量检查:');
console.log(`✓ DASHSCOPE_API_KEY: ${apiKey ? '已配置 (' + apiKey.substring(0, 10) + '...)' : '❌ 未配置'}`);
console.log(`✓ DASHSCOPE_BASE_URL: ${baseUrl || '使用默认值'}\n`);

if (!apiKey) {
  console.error('❌ 错误: DASHSCOPE_API_KEY 未配置');
  console.log('请在 .env 文件中配置 API Key');
  console.log('获取地址: https://help.aliyun.com/zh/model-studio/get-api-key\n');
  process.exit(1);
}

console.log('📊 准备测试图像分析...\n');

// 测试图像（使用在线示例图片的 Base64）
const testImageBase64 = 'data:image/jpeg;base64,/9j/4AAQSkZJRg...'; // 实际使用时需要完整的 Base64

console.log('⚠️  注意: 完整测试需要提供真实的图表图片');
console.log('建议操作:');
console.log('1. 上传一张加密货币图表到 backend/uploads/ 目录');
console.log('2. 修改此脚本的 imagePath 参数');
console.log('3. 重新运行: npm run verify\n');

console.log('✅ 环境配置验证完成！');
console.log('下一步: 启动服务器并通过前端上传图片进行测试\n');
console.log('启动命令: npm run dev\n');
