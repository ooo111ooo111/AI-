export default function ReferralPage() {
  const exchanges = [
    {
      name: 'Binance 币安',
      logoUrl: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png?v=029',
      description: '全球最大的加密货币交易所',
      features: ['现货交易', '合约交易', '理财产品', '低手续费'],
      referralCode: 'BN9999999999',
      registerUrl: 'https://accounts.maxweb.cab/register?ref=BN9999999999',
      benefits: '使用邀请码注册进群私聊管理员可享受 20% 手续费返佣'
    },
    {
      name: 'Gate.io 芝麻开门',
      logoUrl: '/gate-logo.png',
      description: '老牌知名数字资产交易平台',
      features: ['现货交易', '合约交易', '杠杆交易', '丰富币种'],
      referralCode: 'AJAJAJAJ',
      registerUrl: 'https://www.gatenode.xyz/share/AJAJAJAJ',
      benefits: '使用邀请码注册进群私聊管理员可享受 50% 手续费返佣'
    },
    {
      name: 'Bitget',
      logoUrl: '/bitget-banner.png',
      description: '主打合约与跟单交易的全球平台',
      features: ['USDT 合约', '量化 API', '专业跟单', '复制交易'],
      referralCode: 'SVDNYH51',
      registerUrl: 'https://partner.hdmune.cn/bg/svdnyh51',
      benefits: '使用邀请码注册进群私聊管理员可享受 20% 手续费返佣'
    },
    {
      name: 'HTX 火币',
      logoUrl: '/htx-logo.png',
      description: '全球领先的数字资产金融服务商',
      features: ['现货交易', '合约交易', '理财服务', '流动性挖矿'],
      referralCode: 'hb1999',
      registerUrl: 'https://www.htx.com.pk/invite/zh-cn/1h?invite_code=hb1999',
      benefits: '使用邀请码注册进群私聊管理员可享受 20% 手续费返佣'
    }
  ];

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* 页面标题 */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
            推荐注册 & 加入社群
          </h1>
          <p className="text-gray-400 text-lg">
            使用专属邀请码注册交易所,享受手续费优惠 · 加入粉丝群获取实时交易信号
          </p>
        </div>

        {/* 交易所推荐 */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-blue-500 to-purple-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-white">交易所推荐注册</h2>
          </div>

          <div
            className="grid gap-6"
            style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
          >
            {exchanges.map((exchange) => (
              <div
                key={exchange.name}
                className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-2xl p-6 hover:border-blue-500/50 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/20"
              >
                <div className="space-y-4">
                  {/* 交易所名称 */}
                <div className="flex items-center gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center">
                    <img
                      src={exchange.logoUrl}
                      alt={exchange.name}
                      className="w-10 h-10 object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{exchange.name}</h3>
                    <p className="text-sm text-gray-400">{exchange.description}</p>
                  </div>
                </div>

                  {/* 特性标签 */}
                  <div className="flex flex-wrap gap-2">
                    {exchange.features.map((feature) => (
                      <span
                        key={feature}
                        className="px-3 py-1 bg-blue-500/10 text-blue-400 text-xs rounded-full border border-blue-500/20"
                      >
                        {feature}
                      </span>
                    ))}
                  </div>

                  {/* 邀请码 */}
                  <div className="bg-gray-900/50 rounded-lg p-4 space-y-2">
                    <div className="text-sm text-gray-400">专属邀请码</div>
                    <div className="flex items-center justify-between gap-2">
                      <code className="text-lg font-mono text-blue-400 font-bold">
                        {exchange.referralCode}
                      </code>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(exchange.referralCode);
                          alert('邀请码已复制到剪贴板!');
                        }}
                        className="px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 text-sm rounded-lg transition-colors"
                      >
                        复制
                      </button>
                    </div>
                  </div>

                  {/* 优惠说明 */}
                  <div className="bg-gradient-to-r from-green-500/10 to-blue-500/10 border border-green-500/20 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <p className="text-sm text-green-400">{exchange.benefits}</p>
                    </div>
                  </div>

                  {/* 注册按钮 */}
                  <a
                    href={exchange.registerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full py-3 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 text-white font-medium text-center rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    立即注册 →
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 粉丝群二维码 */}
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="w-1 h-8 bg-gradient-to-b from-purple-500 to-pink-500 rounded-full"></div>
            <h2 className="text-2xl font-bold text-white">加入粉丝交流群</h2>
          </div>

          <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700 rounded-2xl p-8">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              {/* 左侧:二维码 */}
              <div className="flex-shrink-0">
                <div className="bg-white p-6 rounded-3xl shadow-2xl">
                  <img
                    src="/qq-group-qr.jpg"
                    alt="加密交易港核心群"
                    className="w-72 h-72 md:w-80 md:h-80 object-contain"
                  />
                </div>
                <div className="mt-4 text-center">
                  <p className="text-gray-400 text-sm">扫码加入 QQ 群</p>
                  <p className="text-blue-400 font-mono font-bold mt-1">1038479358</p>
                </div>
              </div>

              {/* 右侧:群介绍 */}
              <div className="flex-1 space-y-6">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-2">
                    加密交易港—核心群
                  </h3>
                  <p className="text-gray-400">
                    专业的加密货币交流社群,汇聚优质交易员与投资者
                  </p>
                </div>

                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div>
                      <h4 className="text-white font-medium">实时交易信号</h4>
                      <p className="text-sm text-gray-400">第一时间获取市场动态和交易机会</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div>
                      <h4 className="text-white font-medium">策略分享</h4>
                      <p className="text-sm text-gray-400">大佬分享实战经验和盈利策略</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div>
                      <h4 className="text-white font-medium">学习交流</h4>
                      <p className="text-sm text-gray-400">直播讲解学习交易技能</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3">
                    <div>
                      <h4 className="text-white font-medium">社群互助</h4>
                      <p className="text-sm text-gray-400">遇到问题随时提问,热心群友解答</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4">
                  <div className="flex items-start gap-2">                    <div>
                      <h4 className="text-white font-medium mb-1">VIP 专属福利</h4>
                      <ul className="text-sm text-gray-300 space-y-1">
                        <li>• AI 分析工具优先体验</li>
                        <li>• 独家策略报告定期发布</li>
                        <li>• 线上/线下交流活动</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 风险提示 */}
        <div className="bg-gradient-to-r from-red-500/10 to-orange-500/10 border border-red-500/30 rounded-xl p-6">
          <div className="flex items-start gap-3">
            <div className="space-y-2">
              <h3 className="text-red-400 font-bold text-lg">风险提示</h3>
              <p className="text-gray-300 text-sm leading-relaxed">
                加密货币交易存在高风险,市场波动剧烈。请务必理性投资,不要投入超过自己承受能力的资金。
                本平台提供的分析仅供参考,不构成投资建议。投资决策需自行判断,盈亏自负。
                建议新手从小额开始,逐步学习和积累经验。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
