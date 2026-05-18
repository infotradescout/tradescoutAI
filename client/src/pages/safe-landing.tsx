export default function SafeLanding() {
  return (
    <div className="bg-gradient-to-br from-blue-950 to-slate-900 text-white py-16">
      <div className="container mx-auto px-4">
        <div className="text-center max-w-4xl mx-auto">
          <h1 className="text-3xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            TradeScout Social Platform
          </h1>

          <p className="text-xl mb-8 text-white/70">
            Connect with your community, find trusted contractors, and build lasting relationships
          </p>

          <div className="grid md:grid-cols-3 gap-8 mb-12">
            <div className="bg-white/5 p-6 rounded-lg border border-white/10">
              <div className="text-4xl mb-4">🏠</div>
              <h3 className="text-xl font-semibold mb-2">Community Feed</h3>
              <p className="text-white/60">
                Share updates, ask questions, and connect with neighbors
              </p>
            </div>

            <div className="bg-white/5 p-6 rounded-lg border border-white/10">
              <div className="text-4xl mb-4">🔨</div>
              <h3 className="text-xl font-semibold mb-2">Find Local Help</h3>
              <p className="text-white/60">Discover verified local providers for your projects</p>
            </div>

            <div className="bg-white/5 p-6 rounded-lg border border-white/10">
              <div className="text-4xl mb-4">💬</div>
              <h3 className="text-xl font-semibold mb-2">Marketplace</h3>
              <p className="text-white/60">Buy, sell, and trade with your community</p>
            </div>
          </div>

          <div className="space-x-4">
            <a
              href="/pre-scout-setup?mode=signin"
              className="inline-block bg-ts-orange hover:bg-ts-orange-dark text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Get Started
            </a>
            <a
              href="/community"
              className="inline-block border border-ts-orange/30 text-ts-orange hover:bg-ts-orange hover:text-white px-8 py-3 rounded-lg font-semibold transition-colors"
            >
              Explore Community
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
