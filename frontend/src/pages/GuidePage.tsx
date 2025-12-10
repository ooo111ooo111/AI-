export default function GuidePage() {
  return (
    <div className="h-full p-8 space-y-8 overflow-y-auto">
      {/* 页面标题 */}
      <div>
        <h1 className="text-3xl font-bold text-white">策略指南</h1>
        <p className="text-gray-400 mt-1">学习长短线交易策略,掌握市场分析技巧</p>
      </div>

      {/* 策略概览 */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* 长线策略 */}
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/30 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">📈</span>
            <h2 className="text-2xl font-bold text-blue-400">长线策略</h2>
          </div>

          <div className="space-y-3 text-gray-300">
            <div>
              <p className="text-sm text-gray-400 mb-1">持仓周期</p>
              <p className="text-lg font-semibold">数周到数月</p>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">代表策略</p>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>趋势跟随策略(海龟交易法则)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>均值回归策略</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-400 mt-1">•</span>
                  <span>基本面驱动策略</span>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">关键指标</p>
              <div className="flex flex-wrap gap-2">
                {['50日均线', '200日均线', 'MACD', 'ADX', '布林带'].map((indicator) => (
                  <span key={indicator} className="px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs">
                    {indicator}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-blue-500/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">建议仓位</span>
                <span className="text-blue-300 font-medium">30-60%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">止损幅度</span>
                <span className="text-blue-300 font-medium">5-10%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">适合人群</span>
                <span className="text-blue-300 font-medium">耐心型、研究型</span>
              </div>
            </div>
          </div>
        </div>

        {/* 短线策略 */}
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/30 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-4xl">⚡</span>
            <h2 className="text-2xl font-bold text-purple-400">短线策略</h2>
          </div>

          <div className="space-y-3 text-gray-300">
            <div>
              <p className="text-sm text-gray-400 mb-1">持仓周期</p>
              <p className="text-lg font-semibold">数分钟到数天</p>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">代表策略</p>
              <ul className="space-y-1 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">•</span>
                  <span>日内交易</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">•</span>
                  <span>高频剥头皮</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-purple-400 mt-1">•</span>
                  <span>摆动交易</span>
                </li>
              </ul>
            </div>

            <div>
              <p className="text-sm text-gray-400 mb-2">关键指标</p>
              <div className="flex flex-wrap gap-2">
                {['RSI', '5日均线', '10日均线', 'K线形态', '支撑阻力'].map((indicator) => (
                  <span key={indicator} className="px-3 py-1 bg-purple-500/20 text-purple-300 rounded-full text-xs">
                    {indicator}
                  </span>
                ))}
              </div>
            </div>

            <div className="pt-4 border-t border-purple-500/20 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">建议仓位</span>
                <span className="text-purple-300 font-medium">10-30%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">止损幅度</span>
                <span className="text-purple-300 font-medium">2-5%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">适合人群</span>
                <span className="text-purple-300 font-medium">激进型、技术型</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 著名交易大师 */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span>🎯</span>
          著名交易大师
        </h2>

        <div className="grid md:grid-cols-2 gap-6">
          {/* 长线大师 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-blue-400">长线大师</h3>
            <div className="space-y-3">
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="font-medium text-white mb-1">理查德·丹尼斯 (Richard Dennis)</p>
                <p className="text-sm text-gray-400">海龟交易法则创始人,趋势跟随策略的典范</p>
              </div>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="font-medium text-white mb-1">杰瑞米·西格尔 (Jeremy Siegel)</p>
                <p className="text-sm text-gray-400">长期趋势跟随理念,股指期货应用</p>
              </div>
            </div>
          </div>

          {/* 短线大师 */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold text-purple-400">短线大师</h3>
            <div className="space-y-3">
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="font-medium text-white mb-1">保罗·都铎·琼斯 (Paul Tudor Jones)</p>
                <p className="text-sm text-gray-400">短线兼中线混合操作,宏观趋势+日内波段</p>
              </div>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="font-medium text-white mb-1">琳达·拉斯克 (Linda Bradford Raschke)</p>
                <p className="text-sm text-gray-400">日内交易专家,著名的"短线交易法则"</p>
              </div>
              <div className="p-4 bg-gray-700/50 rounded-lg">
                <p className="font-medium text-white mb-1">詹姆斯·西蒙斯 (James Simons)</p>
                <p className="text-sm text-gray-400">文艺复兴科技,算法化高频交易</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 策略对比表 */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span>📋</span>
          策略对比
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="text-left py-3 px-4 text-gray-400 font-medium">对比项</th>
                <th className="text-left py-3 px-4 text-blue-400 font-medium">长线策略</th>
                <th className="text-left py-3 px-4 text-purple-400 font-medium">短线策略</th>
              </tr>
            </thead>
            <tbody className="text-sm">
              {[
                ['持仓周期', '数周到数月', '数分钟到数天'],
                ['交易频率', '低', '高'],
                ['关键指标', '50日/200日均线、MACD、ADX', 'RSI、短期均线、K线形态'],
                ['仓位建议', '30-60%', '10-30%'],
                ['止损幅度', '5-10%', '2-5%'],
                ['盯盘强度', '低', '高'],
                ['心理压力', '中等', '较大'],
                ['分析重点', '趋势+基本面', '形态+技术指标'],
                ['适合人群', '耐心型、研究型', '激进型、技术型']
              ].map(([item, long, short], index) => (
                <tr key={index} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                  <td className="py-3 px-4 text-gray-400">{item}</td>
                  <td className="py-3 px-4 text-gray-300">{long}</td>
                  <td className="py-3 px-4 text-gray-300">{short}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 推荐书籍 */}
      <div className="bg-gray-800/50 backdrop-blur-sm rounded-xl border border-gray-700 p-6 space-y-4">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <span>📚</span>
          推荐书籍
        </h2>

        <div className="grid md:grid-cols-3 gap-4">
          {[
            '《海龟交易法则》 - 柯蒂斯·费思',
            '《短线交易秘诀》 - 拉瑞·威廉姆斯',
            '《日本蜡烛图技术》 - 史蒂夫·尼森',
            '《趋势跟踪》 - 迈克尔·卡沃尔',
            '《交易心理分析》 - 马克·道格拉斯',
            '《技术分析权威指南》 - 约翰·墨菲'
          ].map((book) => (
            <div key={book} className="p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors">
              <p className="text-sm text-gray-300">{book}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 免责声明 */}
      <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-yellow-400 mb-3 flex items-center gap-2">
          <span>⚠️</span>
          免责声明
        </h3>
        <p className="text-sm text-yellow-300/80 leading-relaxed">
          本系统提供的策略指南和分析结果仅供学习参考,不构成任何投资建议。
          加密货币市场波动剧烈,投资风险极高。
          请充分了解市场风险,根据自身风险承受能力理性投资,切勿盲目跟风。
          任何投资决策由您自行负责,本系统不承担任何投资损失。
        </p>
      </div>
    </div>
  );
}
