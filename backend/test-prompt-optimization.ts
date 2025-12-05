#!/usr/bin/env tsx

/**
 * 提示词优化效果测试
 * 对比优化前后的输出质量
 */

import * as dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '.env') });

console.log('🧪 提示词优化效果测试\n');
console.log('=' .repeat(60));

console.log('\n📋 优化内容摘要:\n');

console.log('✅ 1. 操作建议结构化');
console.log('   - 交易方向（看多/看空/观望）');
console.log('   - 入场策略（价位、时机、仓位配置）');
console.log('   - 止损策略（价位、理由、最大亏损）');
console.log('   - 止盈策略（多级目标位、分批减仓、移动止盈）');
console.log('   - 风险提示（消息面、市场情绪、纪律执行）\n');

console.log('✅ 2. 仓位管理建议');
console.log('   - 高风险：10-20% 仓位');
console.log('   - 中风险：20-40% 仓位');
console.log('   - 低风险：40-60% 仓位');
console.log('   - 分批建仓：2-3 批入场\n');

console.log('✅ 3. 止损止盈策略');
console.log('   - 止损：基于技术位，2-5% 范围');
console.log('   - 止盈：3 个目标位，分批减仓');
console.log('   - 移动止盈：保护利润\n');

console.log('✅ 4. 风险控制加强');
console.log('   - 单笔最大亏损：1-3% 总资金');
console.log('   - 风险等级明确定义');
console.log('   - 强调纪律执行\n');

console.log('=' .repeat(60));

console.log('\n📊 预期输出示例:\n');

const exampleOutput = {
  trend: 'bullish',
  confidence: 75,
  keyLevels: {
    support: [3140, 3066],
    resistance: [3193, 3250, 3300]
  },
  indicators: {
    rsi: 62,
    macd: 'MACD柱状图显示多头动能增强，快线向上穿越慢线形成金叉',
    volume: '近期成交量配合价格上涨，呈现放量态势，价量配合良好',
    movingAverages: 'MA(20)与MA(50)呈金叉形态，且价格持续在均线上方运行，多头排列'
  },
  analysis: `该图表显示 ETH 在近期经历了一波强劲的上涨行情，价格从 3066.13 附近启动，突破 3140 阻力后继续上行至 3193.15。当前价格位于 3167.32，仍处于上升通道内。

均线系统（MA20和MA50）呈多头排列，且价格持续在均线上方运行，表明短期趋势偏强。RSI 值为 62，处于中性偏多区域，未出现超买信号，暗示上涨动能仍有空间。K线形态呈现连续阳线，虽有小幅回调但并未跌破关键支撑位 3140，显示出市场对该位置的强力支撑。

未出现明显的背离信号，技术面支持继续看涨。整体来看，多头占据主导地位，技术面支持进一步上行，但需关注 3193 阻力位的突破情况。`,
  recommendation: `【交易方向】看多，理由：技术形态呈现上涨趋势，均线多头排列，MACD金叉向上，价量配合良好

【入场策略】
- 建议入场价位：$3140-3150（关键支撑区域回调企稳）
- 入场时机：等待价格回调至支撑位并出现止跌信号（如小时线收阳线、成交量萎缩后再次放量）
- 仓位配置：建议总资金的 30%（中等风险，技术面较为明确但需防范回调）
- 分批建仓：第一批 $3150 建仓 15%，第二批 $3140 加仓 15%，避免追高

【止损策略】
- 止损价位：$3066（前期启动点，关键支撑位下方，约 2.5% 止损空间）
- 止损理由：跌破 3066 说明上涨趋势失效，多头结构破坏，应立即止损离场
- 单笔最大亏损：不超过总资金的 2%（通过仓位控制实现）

【止盈策略】
- 目标位 1：$3193（第一阻力位，前高位置），建议减仓 50%，锁定部分利润
- 目标位 2：$3250（次级阻力位，整数关口），建议减仓 30%
- 目标位 3：$3300（终极目标位，心理关口），剩余 20% 仓位
- 移动止盈：价格突破 3193 后，将止损位上移至 3150（成本价保护），突破 3250 后上移至 3193

【风险提示】
- 关注美联储货币政策变动和宏观经济数据（如 CPI、非农数据）对加密市场的影响
- 注意比特币（BTC）走势，ETH 通常与 BTC 呈现高度相关性
- 严格执行止损纪律，避免侥幸心理导致亏损扩大
- 关注市场整体情绪和消息面变化，重大利空出现时需及时减仓`,
  riskLevel: 'medium',
  timeframe: '4h'
};

console.log(JSON.stringify(exampleOutput, null, 2));

console.log('\n' + '='.repeat(60));

console.log('\n🚀 测试步骤:\n');
console.log('1. 确保后端服务正在运行: npm run dev');
console.log('2. 上传一张加密货币图表进行分析');
console.log('3. 对比实际输出与上面的示例');
console.log('4. 检查 recommendation 字段是否包含所有必需内容\n');

console.log('📋 检查清单:\n');
console.log('[ ] 交易方向明确');
console.log('[ ] 入场价位具体');
console.log('[ ] 仓位比例合理');
console.log('[ ] 止损价位和理由清晰');
console.log('[ ] 至少 2 个止盈目标位');
console.log('[ ] 包含移动止盈策略');
console.log('[ ] 风险提示充分\n');

console.log('=' .repeat(60));

console.log('\n💡 提示:\n');
console.log('如果实际输出不符合预期，可能的原因：');
console.log('1. 模型理解能力有限，可能需要简化提示词');
console.log('2. 图表质量不佳，模型无法准确识别');
console.log('3. Token 限制不足，输出被截断（已增加至 3096）\n');

console.log('如需调整提示词，请编辑：');
console.log('backend/src/services/qwen.service.ts:82-120\n');

console.log('✅ 测试准备完成！\n');
