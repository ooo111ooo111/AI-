import type { Analysis } from '../types';
import {
  getTrendColor,
  getTrendBgColor,
  getTrendLabel,
  getRiskColor,
  getRiskLabel,
} from '../utils/helpers';

interface AnalysisResultProps {
  analysis: Analysis;
  imageUrl: string;
}

export default function AnalysisResult({ analysis, imageUrl }: AnalysisResultProps) {
  // 修复：从 VITE_API_URL 中移除 /api 后缀，用于访问静态资源
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
  const baseUrl = apiUrl.replace(/\/api$/, ''); // 移除 /api 后缀

  // 构建完整的图片 URL
  const fullImageUrl = `${baseUrl}${imageUrl}`;

  // 格式化操作建议，识别结构化内容
  const formatRecommendation = (text: string) => {
    // 按段落分割
    const sections = text.split(/【|】/).filter(s => s.trim());

    return (
      <div className="space-y-4">
        {sections.map((section, index) => {
          if (index % 2 === 0 && sections[index + 1]) {
            const title = section.trim();
            const content = sections[index + 1].trim();

            return (
              <div key={index} className="space-y-2">
                <h4 className="text-base font-semibold text-blue-300 flex items-center gap-2">
                  <span className="w-1 h-4 bg-blue-400 rounded"></span>
                  {title}
                </h4>
                <div className="pl-4 space-y-1.5 text-sm text-gray-300 leading-relaxed">
                  {content.split('\n').map((line, i) => {
                    const trimmed = line.trim();
                    if (!trimmed) return null;

                    // 检测列表项（以 - 或 • 开头）
                    if (trimmed.startsWith('- ') || trimmed.startsWith('• ')) {
                      return (
                        <div key={i} className="flex gap-2 items-start">
                          <span className="text-blue-400 mt-1">•</span>
                          <span className="flex-1">{trimmed.substring(2)}</span>
                        </div>
                      );
                    }

                    // 检测缩进内容（建仓批次等）
                    if (trimmed.match(/^(第[一二三]批|批次\d)/)) {
                      return (
                        <div key={i} className="ml-4 text-gray-400">
                          {trimmed}
                        </div>
                      );
                    }

                    // 普通文本
                    return (
                      <div key={i}>
                        {trimmed}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }
          return null;
        })}

        {/* 如果没有结构化格式，显示原始文本 */}
        {sections.length <= 1 && (
          <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap">
            {text}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">分析结果</h1>
        <div className="flex items-center gap-2">
          <span className="text-2xl">{analysis.symbol}</span>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* 左侧：图片 */}
        <div className="space-y-4">
          <div className="bg-dark-card rounded-lg border border-dark-border p-4">
            <img
              src={fullImageUrl}
              alt="走势图"
              className="w-full h-auto rounded-lg"
              onError={(e) => {
                console.error('图片加载失败:', fullImageUrl);
                e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="300"%3E%3Crect width="400" height="300" fill="%23374151"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%239CA3AF" font-family="sans-serif" font-size="16"%3E图片加载失败%3C/text%3E%3C/svg%3E';
              }}
            />
          </div>

          {/* 关键价格位 */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-4">
            <h3 className="text-lg font-semibold mb-3">关键价格位</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">支撑位</p>
                <div className="space-y-1">
                  {analysis.keyLevels.support.length > 0 ? (
                    analysis.keyLevels.support.map((level, idx) => (
                      <div key={idx} className="text-green-400 font-mono">
                        ${level.toLocaleString()}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-sm">未识别</div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-400 mb-2">阻力位</p>
                <div className="space-y-1">
                  {analysis.keyLevels.resistance.length > 0 ? (
                    analysis.keyLevels.resistance.map((level, idx) => (
                      <div key={idx} className="text-red-400 font-mono">
                        ${level.toLocaleString()}
                      </div>
                    ))
                  ) : (
                    <div className="text-gray-500 text-sm">未识别</div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：分析详情 */}
        <div className="space-y-4">
          {/* 趋势和置信度 */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm text-gray-400 mb-1">趋势预测</p>
                <div className={`text-3xl font-bold ${getTrendColor(analysis.trend)}`}>
                  {getTrendLabel(analysis.trend)}
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-400 mb-1">置信度</p>
                <div className="text-3xl font-bold text-blue-400">
                  {analysis.confidence}%
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm border ${getTrendBgColor(analysis.trend)}`}>
                {getTrendLabel(analysis.trend)}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm border bg-gray-500/10 border-gray-500/30 ${getRiskColor(analysis.riskLevel)}`}>
                {getRiskLabel(analysis.riskLevel)}
              </span>
              {analysis.timeframe && (
                <span className="px-3 py-1 rounded-full text-sm border bg-gray-500/10 border-gray-500/30 text-gray-300">
                  {analysis.timeframe}
                </span>
              )}
            </div>
          </div>

          {/* 技术指标 */}
          {analysis.indicators && Object.keys(analysis.indicators).length > 0 && (
            <div className="bg-dark-card rounded-lg border border-dark-border p-5">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                </svg>
                技术指标
              </h3>
              <div className="space-y-3">
                {analysis.indicators.rsi && (
                  <div className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <span className="text-gray-400 font-medium min-w-[60px] text-sm">RSI:</span>
                    <span className="font-mono text-blue-300 text-sm">{analysis.indicators.rsi}</span>
                  </div>
                )}
                {analysis.indicators.macd && (
                  <div className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <span className="text-gray-400 font-medium min-w-[60px] text-sm">MACD:</span>
                    <span className="text-gray-300 flex-1 text-sm leading-relaxed">{analysis.indicators.macd}</span>
                  </div>
                )}
                {analysis.indicators.volume && (
                  <div className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <span className="text-gray-400 font-medium min-w-[60px] text-sm">成交量:</span>
                    <span className="text-gray-300 flex-1 text-sm leading-relaxed">{analysis.indicators.volume}</span>
                  </div>
                )}
                {analysis.indicators.movingAverages && (
                  <div className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
                    <span className="text-gray-400 font-medium min-w-[60px] text-sm">均线:</span>
                    <span className="text-gray-300 flex-1 text-sm leading-relaxed">{analysis.indicators.movingAverages}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 详细分析 */}
          <div className="bg-dark-card rounded-lg border border-dark-border p-5">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
              详细分析
            </h3>
            <div className="text-gray-300 text-sm leading-relaxed space-y-2">
              {analysis.analysis.split('\n\n').map((paragraph, index) => (
                <p key={index} className="whitespace-pre-wrap">
                  {paragraph}
                </p>
              ))}
            </div>
          </div>

          {/* 操作建议 */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-5">
            <h3 className="text-lg font-semibold mb-4 text-blue-400 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              操作建议
            </h3>
            <div className="text-gray-300">
              {formatRecommendation(analysis.recommendation)}
            </div>
          </div>

          {/* 免责声明 */}
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
            <p className="text-xs text-yellow-400">
              ⚠️ 免责声明：本分析结果由 AI 生成，仅供参考，不构成投资建议。
              加密货币投资风险极高，请谨慎决策，自行承担投资风险。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
