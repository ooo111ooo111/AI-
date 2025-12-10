import type { StrategyType } from '../types';

interface StrategySelectorProps {
  selectedStrategy: StrategyType;
  onSelect: (strategy: StrategyType) => void;
}

const strategies = [
  {
    type: 'long-term' as StrategyType,
    name: '长线策略',
    icon: '📈',
    color: 'blue',
    holdingPeriod: '数周到数月',
    description: '趋势跟随、均值回归、基本面驱动',
    features: [
      '50日/200日均线系统',
      'MACD长期趋势',
      'ADX趋势强度',
      '布林带长期通道'
    ],
    suitableFor: '耐心型、研究型投资者',
    positionSize: '30-60%',
    stopLoss: '5-10%'
  },
  {
    type: 'short-term' as StrategyType,
    name: '短线策略',
    icon: '⚡',
    color: 'purple',
    holdingPeriod: '数分钟到数天',
    description: '日内交易、剥头皮、摆动交易',
    features: [
      'RSI超买超卖',
      '短期均线(5/10/20日)',
      'K线形态分析',
      '支撑阻力位'
    ],
    suitableFor: '激进型、技术型交易者',
    positionSize: '10-30%',
    stopLoss: '2-5%'
  }
];

export default function StrategySelector({ selectedStrategy, onSelect }: StrategySelectorProps) {
  return (
    <div className="w-full">
      <label className="block text-sm font-medium mb-3 text-gray-300">
        选择交易策略
      </label>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {strategies.map((strategy) => {
          const isSelected = selectedStrategy === strategy.type;
          
          const colorClasses = {
            blue: {
              border: 'border-blue-500',
              bg: 'bg-blue-500/10',
              text: 'text-blue-400',
              hover: 'hover:border-blue-400'
            },
            purple: {
              border: 'border-purple-500',
              bg: 'bg-purple-500/10',
              text: 'text-purple-400',
              hover: 'hover:border-purple-400'
            }
          };

          const colors = colorClasses[strategy.color as keyof typeof colorClasses];

          return (
            <button
              key={strategy.type}
              onClick={() =>  onSelect(strategy.type)}
              className={`
                relative p-6 rounded-xl border-2 transition-all duration-200
                text-left
                ${isSelected
                  ? `${colors.border} ${colors.bg} shadow-lg`
                  : `border-gray-600 ${colors.hover} bg-dark-card`
                }

              `}
            >
              {/* 选中标记 */}
              {isSelected && (
                <div className={`absolute top-3 right-3 w-6 h-6 rounded-full ${colors.bg} ${colors.border} border-2 flex items-center justify-center`}>
                  <span className="text-sm">✓</span>
                </div>
              )}

              {/* 策略图标和名称 */}
              <div className="flex items-center gap-3 mb-4">
                <span className="text-4xl">{strategy.icon}</span>
                <div>
                  <h3 className={`text-xl font-bold ${isSelected ? colors.text : 'text-gray-200'}`}>
                    {strategy.name}
                  </h3>
                  <p className="text-sm text-gray-500">
                    持仓周期: {strategy.holdingPeriod}
                  </p>
                </div>
              </div>

              {/* 策略描述 */}
              <p className="text-sm text-gray-400 mb-4">
                {strategy.description}
              </p>

              {/* 关键指标 */}
              <div className="space-y-2 mb-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  关键指标
                </p>
                <div className="flex flex-wrap gap-2">
                  {strategy.features.map((feature, index) => (
                    <span
                      key={index}
                      className={`
                        text-xs px-2 py-1 rounded-full
                        ${isSelected
                          ? `${colors.bg} ${colors.text}`
                          : 'bg-gray-700 text-gray-400'
                        }
                      `}
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              {/* 适合人群和参数 */}
              <div className="space-y-2 pt-4 border-t border-gray-700">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">适合:</span>
                  <span className={isSelected ? colors.text : 'text-gray-400'}>
                    {strategy.suitableFor}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">建议仓位:</span>
                  <span className={isSelected ? colors.text : 'text-gray-400'}>
                    {strategy.positionSize}
                  </span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-gray-500">止损幅度:</span>
                  <span className={isSelected ? colors.text : 'text-gray-400'}>
                    {strategy.stopLoss}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
