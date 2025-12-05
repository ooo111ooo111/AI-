import { analyzeChartImage } from '../src/services/qwen.service';
import * as dotenv from 'dotenv';
import path from 'path';

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '../.env') });

/**
 * Qwen3-VL-Flash 集成测试
 *
 * 测试场景：
 * 1. 使用在线图片 URL 进行分析
 * 2. 验证返回的 JSON 结构
 * 3. 检查错误处理
 */

async function testQwenIntegration() {
  console.log('开始测试 Qwen3-VL-Flash 集成...\n');

  // 测试用例 1：使用 Base64 编码的测试图片
  const testImageUrl = 'https://img.alicdn.com/imgextra/i1/O1CN01gDEY8M1W114Hi3XcN_!!6000000002727-0-tps-1024-406.jpg';

  console.log('测试用例 1：在线图片 URL');
  console.log(`图片 URL: ${testImageUrl}`);
  console.log('币种: BTC\n');

  try {
    // 由于函数需要文件路径，我们使用空路径但提供 Base64
    // 实际使用时应该先下载图片或直接传递 Base64
    const result = await analyzeChartImage(
      '', // 空路径
      'BTC',
      testImageUrl // 这里应该是 Base64，但为了演示，我们使用 URL
    );

    console.log('✅ 分析成功！\n');
    console.log('分析结果：');
    console.log(JSON.stringify(result, null, 2));

    // 验证结果结构
    console.log('\n验证结果结构：');
    console.log(`✓ trend: ${result.trend} (${['bullish', 'bearish', 'neutral'].includes(result.trend) ? '有效' : '无效'})`);
    console.log(`✓ confidence: ${result.confidence} (${result.confidence >= 0 && result.confidence <= 100 ? '有效' : '无效'})`);
    console.log(`✓ keyLevels: ${result.keyLevels ? '存在' : '缺失'}`);
    console.log(`✓ indicators: ${result.indicators ? '存在' : '缺失'}`);
    console.log(`✓ analysis: ${result.analysis ? '存在' : '缺失'}`);
    console.log(`✓ recommendation: ${result.recommendation ? '存在' : '缺失'}`);
    console.log(`✓ riskLevel: ${result.riskLevel} (${['low', 'medium', 'high'].includes(result.riskLevel) ? '有效' : '无效'})`);

  } catch (error: any) {
    console.error('❌ 测试失败：', error.message);

    if (error.message.includes('DASHSCOPE_API_KEY')) {
      console.log('\n⚠️  请确保在 .env 文件中配置了 DASHSCOPE_API_KEY');
      console.log('获取 API Key：https://help.aliyun.com/zh/model-studio/get-api-key');
    }
  }

  console.log('\n测试完成！');
}

// 运行测试
testQwenIntegration().catch(console.error);
