import { useState, useEffect } from 'react';
import { symbolService } from '../services/symbolService';
import type { CryptoSymbol } from '../types';

interface SymbolSelectorProps {
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}

export default function SymbolSelector({ selectedSymbol, onSelect }: SymbolSelectorProps) {
  const [symbols, setSymbols] = useState<CryptoSymbol[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSymbols = async () => {
      try {
        const data = await symbolService.getSymbols();
        setSymbols(data);
      } catch (error) {
        console.error('获取币种列表失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSymbols();
  }, []);

  if (loading) {
    return <div className="text-center text-gray-500">加载中...</div>;
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium mb-3 text-gray-300">
        选择币种
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {symbols.map((symbol) => (
          <button
            key={symbol.symbol}
            onClick={() => onSelect(symbol.symbol)}
            className={`
              p-4 rounded-lg border-2 transition-all duration-200
              flex flex-col items-center gap-2
              ${selectedSymbol === symbol.symbol
                ? 'border-blue-500 bg-blue-500/10 text-blue-400'
                : 'border-gray-600 hover:border-gray-500 bg-dark-card text-gray-300'
              }
            `}
          >
            <span className="text-2xl">{symbol.icon}</span>
            <div className="text-center">
              <div className="font-bold">{symbol.symbol}</div>
              <div className="text-xs text-gray-500">{symbol.name}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
