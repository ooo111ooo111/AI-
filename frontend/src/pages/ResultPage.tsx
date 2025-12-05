import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { analysisService } from '../services/analysisService';
import AnalysisResult from '../components/AnalysisResult';
import type { Analysis } from '../types';

export default function ResultPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    const fetchAnalysis = async () => {
      if (!id) return;

      try {
        const data = await analysisService.getAnalysisById(id);
        setAnalysis(data);
      } catch (err: any) {
        console.error('获取分析结果失败:', err);
        setError(err.response?.data?.message || '获取分析结果失败');
      } finally {
        setLoading(false);
      }
    };

    fetchAnalysis();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">加载中...</p>
        </div>
      </div>
    );
  }

  if (error || !analysis) {
    return (
      <div className="min-h-screen bg-dark-bg flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-dark-card rounded-lg border border-dark-border p-8 text-center space-y-4">
          <div className="text-5xl">❌</div>
          <h2 className="text-2xl font-bold text-red-400">加载失败</h2>
          <p className="text-gray-400">{error || '分析结果不存在'}</p>
          <button
            onClick={() => navigate('/')}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-dark-bg">
      {/* 顶部导航 */}
      <div className="border-b border-dark-border bg-dark-card">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <span>←</span>
            <span>返回首页</span>
          </button>
          <button
            onClick={() => navigate('/')}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            新建分析
          </button>
        </div>
      </div>

      {/* 分析结果 */}
      <AnalysisResult analysis={analysis} imageUrl={analysis.imageUrl} />
    </div>
  );
}
