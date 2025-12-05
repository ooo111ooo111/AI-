import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import UploadZone from '../components/UploadZone';
import SymbolSelector from '../components/SymbolSelector';
import LoadingSpinner from '../components/LoadingSpinner';
import { analysisService } from '../services/analysisService';
import { generateCompressedBase64 } from '../utils/image';

const BASE64_LENGTH_LIMIT = 60000;
const COMPRESSION_PROFILES = [
  { maxDimension: 640, quality: 0.65 },
  { maxDimension: 512, quality: 0.55 },
  { maxDimension: 384, quality: 0.5 },
  { maxDimension: 320, quality: 0.45 },
  { maxDimension: 256, quality: 0.4 },
  { maxDimension: 192, quality: 0.3 },
  { maxDimension: 128, quality: 0.25 },
];

async function compressImageForAI(file: File) {
  let lastResult = '';

  for (const profile of COMPRESSION_PROFILES) {
    const base64 = await generateCompressedBase64(file, profile);
    lastResult = base64;

    if (base64.length <= BASE64_LENGTH_LIMIT) {
      return base64;
    }
  }

  return lastResult.length <= BASE64_LENGTH_LIMIT ? lastResult : null;
}

export default function HomePage() {
  const navigate = useNavigate();
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedSymbol, setSelectedSymbol] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');

  const handleAnalyze = async () => {
    if (!selectedFile) {
      setError('请上传图片');
      return;
    }

    if (!selectedSymbol) {
      setError('请选择币种');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const compressedBase64 = await compressImageForAI(selectedFile);

      if (!compressedBase64) {
        setError('图片过大，压缩后仍超过限制，请裁剪或降低分辨率后重试');
        return;
      }

      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('symbol', selectedSymbol);
      formData.append('imageBase64', compressedBase64);

      const result = await analysisService.createAnalysis(formData);

      // 跳转到结果页
      navigate(`/result/${result._id}`);
    } catch (err: any) {
      console.error('分析失败:', err);
      setError(err.response?.data?.message || '分析失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-dark-bg">
      {loading && <LoadingSpinner />}

      <div className="max-w-4xl mx-auto p-6 space-y-8">
        {/* 头部 */}
        <div className="text-center space-y-3">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            AI 加密货币走势分析
          </h1>
          <p className="text-gray-400">
            上传 K 线图，选择币种，让 AI 为您分析市场趋势
          </p>
        </div>

        {/* 上传区域 */}
        <div className="bg-dark-card rounded-lg border border-dark-border p-6">
          <UploadZone
            onFileSelect={setSelectedFile}
            selectedFile={selectedFile}
          />
        </div>

        {/* 币种选择 */}
        <div className="bg-dark-card rounded-lg border border-dark-border p-6">
          <SymbolSelector
            selectedSymbol={selectedSymbol}
            onSelect={setSelectedSymbol}
          />
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
            {error}
          </div>
        )}

        {/* 分析按钮 */}
        <button
          onClick={handleAnalyze}
          disabled={!selectedFile || !selectedSymbol || loading}
          className={`
            w-full py-4 rounded-lg font-semibold text-lg
            transition-all duration-200
            ${selectedFile && selectedSymbol && !loading
              ? 'bg-blue-600 hover:bg-blue-700 text-white cursor-pointer'
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
            }
          `}
        >
          {loading ? '分析中...' : '开始分析'}
        </button>

        {/* 说明 */}
        <div className="text-center text-sm text-gray-500 space-y-2">
          <p>💡 提示：请上传清晰的 K 线图或走势图以获得更准确的分析结果</p>
          <p>⚡ 分析通常需要 10-30 秒，请耐心等待</p>
        </div>
      </div>
    </div>
  );
}
