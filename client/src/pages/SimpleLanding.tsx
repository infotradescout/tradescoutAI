import { memo } from 'react';

const SimpleLanding = memo(function SimpleLanding() {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Premium Hero Section */}
      <section className="relative min-h-screen flex items-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-10 left-10 w-2 h-2 bg-white rounded-full"></div>
            <div className="absolute top-20 left-32 w-1 h-1 bg-white rounded-full"></div>
            <div className="absolute top-32 left-64 w-2 h-2 bg-white rounded-full"></div>
            <div className="absolute top-48 left-24 w-1 h-1 bg-white rounded-full"></div>
            <div className="absolute top-64 left-80 w-2 h-2 bg-white rounded-full"></div>
          </div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Premium Badge */}
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full text-sm font-medium mb-8 hover:bg-white/10 transition-all duration-300">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-gray-300">Trusted by 125,000+ homeowners nationwide</span>
            </div>
            
            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                Premium Home
              </span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">
                Contractors
              </span>
            </h1>
            
            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-12 leading-relaxed">
              Connect with elite, verified contractors for your home projects. 
              <span className="text-white font-medium"> Guaranteed quality, transparent pricing, exceptional results.</span>
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <button 
                onClick={() => window.location.pathname = '/find-contractors'}
                className="group relative px-8 py-4 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 rounded-2xl font-semibold text-white shadow-2xl hover:shadow-orange-500/25 transition-all duration-300 hover:scale-105 min-w-[200px] inline-block text-center"
                data-testid="button-find-contractors"
              >
                <span className="relative z-10 flex items-center gap-2">
                  Find Elite Contractors
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-800 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
              
              <button 
                onClick={() => window.location.pathname = '/quote-calculator'}
                className="group relative px-8 py-4 bg-white/5 backdrop-blur-sm border border-white/20 rounded-2xl font-semibold text-white hover:bg-white/10 hover:border-white/30 transition-all duration-300 min-w-[200px] inline-block text-center"
                data-testid="button-get-quote"
              >
                Get Instant Quote
              </button>
            </div>
            
            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Fully Licensed & Insured
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Background Verified
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Quality Guaranteed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Features Section */}
      <section className="py-24 bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              The Premium Difference
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Experience unmatched quality with our elite contractor network and premium platform features
            </p>
          </div>
          
          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {/* Elite Verification */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-orange-600/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 group-hover:border-orange-500/30 transition-all duration-500 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Elite Verification</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Multi-layer screening process including background checks, license verification, insurance validation, and customer satisfaction reviews.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    Criminal background screening
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    Professional license validation
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    Insurance & bonding verification
                  </div>
                </div>
              </div>
            </div>

            {/* Precision Matching */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 group-hover:border-blue-500/30 transition-all duration-500 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Precision Matching</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Advanced AI-powered matching system connects you with contractors perfectly suited for your specific project needs and location.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Local expertise matching
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Project complexity analysis
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Budget optimization
                  </div>
                </div>
              </div>
            </div>

            {/* White-Glove Service */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 to-teal-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 group-hover:border-emerald-500/30 transition-all duration-500 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">White-Glove Service</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  Dedicated project concierge service ensures seamless communication, timeline adherence, and exceptional results from start to finish.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    Personal project manager
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    24/7 customer support
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                    Quality guarantee
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium Stats Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-slate-800 via-slate-900 to-slate-800"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Industry Leadership
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Setting the standard for premium contractor services nationwide
            </p>
          </div>
          
          <div className="grid md:grid-cols-4 gap-8">
            <div className="group text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-orange-500/20 to-orange-600/20 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-8 group-hover:border-orange-500/30 transition-all duration-500">
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent mb-3">
                    28,500+
                  </div>
                  <div className="text-white text-lg font-semibold mb-2">Elite Contractors</div>
                  <div className="text-gray-500 text-sm">Top 1% industry professionals</div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-center gap-2 text-xs text-orange-400">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                      Verified & Insured
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-purple-500/20 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-8 group-hover:border-blue-500/30 transition-all duration-500">
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-blue-400 via-blue-500 to-purple-600 bg-clip-text text-transparent mb-3">
                    125,000+
                  </div>
                  <div className="text-white text-lg font-semibold mb-2">Premium Members</div>
                  <div className="text-gray-500 text-sm">Satisfied homeowners</div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-center gap-2 text-xs text-blue-400">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                      98% Satisfaction Rate
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/20 to-teal-500/20 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-8 group-hover:border-emerald-500/30 transition-all duration-500">
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 bg-clip-text text-transparent mb-3">
                    $2.45M
                  </div>
                  <div className="text-white text-lg font-semibold mb-2">Projects Completed</div>
                  <div className="text-gray-500 text-sm">Premium project value</div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-center gap-2 text-xs text-emerald-400">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full"></div>
                      On-Time Delivery
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-violet-500/20 to-purple-500/20 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-slate-800/80 backdrop-blur-sm border border-slate-700/50 rounded-3xl p-8 group-hover:border-violet-500/30 transition-all duration-500">
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-violet-400 via-violet-500 to-purple-600 bg-clip-text text-transparent mb-3">
                    99.2%
                  </div>
                  <div className="text-white text-lg font-semibold mb-2">Success Rate</div>
                  <div className="text-gray-500 text-sm">Project completion</div>
                  <div className="mt-4 pt-4 border-t border-slate-700">
                    <div className="flex items-center justify-center gap-2 text-xs text-violet-400">
                      <div className="w-1.5 h-1.5 bg-violet-500 rounded-full"></div>
                      Quality Guaranteed
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Premium CTA Section */}
      <section className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
        <div className="absolute inset-0 opacity-50">
          <div className="absolute top-0 left-1/3 w-96 h-96 bg-orange-500/20 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/3 w-96 h-96 bg-blue-500/20 rounded-full blur-3xl"></div>
        </div>
        
        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            <h2 className="text-5xl md:text-7xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Transform Your Home
              </span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">
                With Confidence
              </span>
            </h2>
            
            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-16 leading-relaxed">
              Join our exclusive network of discerning homeowners who demand excellence. 
              <span className="text-white font-medium"> Premium contractors, guaranteed results, exceptional service.</span>
            </p>
            
            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
              <button className="group relative px-10 py-5 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 rounded-2xl font-bold text-white text-lg shadow-2xl hover:shadow-orange-500/25 transition-all duration-300 hover:scale-105 min-w-[280px]">
                <span className="relative z-10 flex items-center justify-center gap-3">
                  Start Premium Project
                  <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-800 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </button>
              
              <button className="group relative px-10 py-5 bg-white/5 backdrop-blur-sm border border-white/20 rounded-2xl font-bold text-white text-lg hover:bg-white/10 hover:border-white/30 transition-all duration-300 min-w-[280px]">
                <span className="flex items-center justify-center gap-3">
                  Schedule Consultation
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </span>
              </button>
            </div>
            
            {/* Premium Guarantees */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500 pt-8 border-t border-white/10">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                100% Satisfaction Guarantee
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Premium Support Included
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                Elite Contractor Network
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

export default SimpleLanding;