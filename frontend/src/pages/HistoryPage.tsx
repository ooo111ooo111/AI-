import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { analysisService } from '../services/analysisService';
import type { Analysis, StrategyType } from '../types';
import { getTrendColor, getTrendLabel, getRiskColor, getRiskLabel, resolveImageUrl } from '../utils/helpers';

export default function HistoryPage() {
  const navigate = useNavigate();
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterSymbol, setFilterSymbol] = useState<string>('');
  const [filterStrategy, setFilterStrategy] = useState<StrategyType | ''>('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [symbolOptions, setSymbolOptions] = useState<string[]>([]);

  useEffect(() => {
    fetchAnalyses();
  }, [page, filterSymbol, filterStrategy]);

  useEffect(() => {
    const loadSymbols = async () => {
      try {
        const symbols = await analysisService.getUserSymbols();
        setSymbolOptions(symbols);
      } catch (error) {
        console.error('获取币种列表失败:', error);
      }
    };
    loadSymbols();
  }, []);

  const fetchAnalyses = async () => {
    try {
      setLoading(true);
      const params: any = { page, limit: 10 };
      if (filterSymbol) params.symbol = filterSymbol;
      if (filterStrategy) params.strategyType = filterStrategy;

      const response = await analysisService.getAnalyses(params);
      setAnalyses(response.analyses);
      setTotalPages(response.pagination.pages);
    } catch (error) {
      console.error('获取历史记录失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确认删除这条分析记录吗?')) return;

    try {
      await analysisService.deleteAnalysis(id);
      fetchAnalyses();
    } catch (error) {
      console.error('删除失败:', error);
      alert('删除失败,请稍后重试');
    }
  };

  return (
    <div className="h-full p-8 space-y-6">
      {/* 页面标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">历史记录</h1>
          <p className="text-gray-400 mt-1">查看和管理您的分析历史</p>
        </div>
        <button
          onClick={() => navigate('/')}
          className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 rounded-xl font-medium transition-all"
        >
          <span className="flex items-center gap-2">
            新建分析
          </span>
        </button>
      </div>

      {/* 筛选器 */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6">
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm text-gray-400 mb-2">币种筛选</label>
            <select
              value={filterSymbol}
              onChange={(e) => {
                setFilterSymbol(e.target.value);
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部币种</option>
              {symbolOptions.map((symbol) => (
                <option key={symbol} value={symbol}>
                  {symbol}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-2">策略筛选</label>
            <select
              value={filterStrategy}
              onChange={(e) => {
                setFilterStrategy(e.target.value as StrategyType | '');
                setPage(1);
              }}
              className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">全部策略</option>
              <option value="long-term">长线策略</option>
              <option value="short-term">短线策略</option>
            </select>
          </div>
        </div>
      </div>

      {/* 列表 */}
      {loading ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">加载中...</p>
        </div>
      ) : analyses.length === 0 ? (
        <div className="text-center py-20">
          <div className="text-6xl mb-4">📊</div>
          <p className="text-gray-400 text-lg">暂无分析记录</p>
          <button
            onClick={() => navigate('/')}
            className="mt-6 px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors"
          >
            开始第一次分析
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {analyses.map((analysis) => (
            <div
              key={analysis._id}
              className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 hover:border-gray-600 transition-all cursor-pointer"
              onClick={() => navigate(`/result/${analysis._id}`)}
            >
              <div className="flex items-start justify-between gap-6">
                {/* 左侧:图片 */}
                <img
                  src={resolveImageUrl(analysis.imageUrl)}
                  alt="走势图"
                  className="w-32 h-24 object-cover rounded-lg border border-gray-600"
                />

                {/* 中间:信息 */}
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold">{analysis.symbol}</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${getTrendColor(analysis.trend)}`}>
                      {getTrendLabel(analysis.trend)}
                    </span>
                    <span className={`px-3 py-1 rounded-full text-sm ${getRiskColor(analysis.riskLevel)}`}>
                      {getRiskLabel(analysis.riskLevel)}
                    </span>
                    <span className="px-3 py-1 rounded-full text-sm bg-gray-700 text-gray-300">
                      {analysis.strategyType === 'long-term' ? '📈 长线' : '⚡ 短线'}
                    </span>
                  </div>

                  <div className="flex items-center gap-6 text-sm text-gray-400">
                    <div>
                      <span className="text-gray-500">置信度:</span>
                      <span className="ml-2 text-blue-400 font-medium">{analysis.confidence}%</span>
                    </div>
                    {analysis.timeframe && (
                      <div>
                        <span className="text-gray-500">周期:</span>
                        <span className="ml-2 text-gray-300">{analysis.timeframe}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">分析时间:</span>
                      <span className="ml-2 text-gray-300">
                        {new Date(analysis.createdAt).toLocaleString('zh-CN')}
                      </span>
                    </div>
                  </div>

                  {analysis.strategyDetails && (
                    <div className="text-sm text-gray-400">
                      <span className="text-gray-500">策略:</span>
                      <span className="ml-2 text-gray-300">{analysis.strategyDetails.name}</span>
                    </div>
                  )}
                </div>

                {/* 右侧:操作 */}
                <div className="flex flex-col gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(`/result/${analysis._id}`);
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm transition-colors"
                  >
                    查看详情
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(analysis._id);
                    }}
                    className="px-4 py-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 rounded-lg text-sm text-red-400 transition-colors"
                  >
                    删除
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            上一页
          </button>
          <span className="px-4 py-2 bg-gray-800 rounded-lg">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            下一页
          </button>
        </div>
      )}
    </div>
  );
}
