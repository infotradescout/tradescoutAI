import React, { memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

const SimpleLanding = memo(function SimpleLanding() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect authenticated users to Scout hub
  React.useEffect(() => {
    if (isAuthenticated) {
      setLocation("/scout");
    }
  }, [isAuthenticated, setLocation]);

  // Fetch real-time platform statistics
  const { data: stats, isLoading: statsLoading } = useQuery<{
    totalContractors: number;
    totalHomeowners: number;
    totalProjectsCompleted: number;
    successRate: number;
    totalProjectValue: number;
  }>({
    queryKey: ["/api/stats/platform"],
    refetchInterval: 60000, // Refetch every minute
    staleTime: 30000, // Consider data stale after 30 seconds
  });

  // Format large numbers for display
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  // Format currency
  const formatCurrency = (num: number) => {
    if (num >= 1000000000) {
      return `$${(num / 1000000000).toFixed(2)}B`;
    } else if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    }
    return `$${num.toLocaleString()}`;
  };

  return (
    <div className="h-full text-primary" style={{ backgroundColor: "var(--surface-app-bg)" }}>
      {/* Premium Hero Section */}
      <section className="relative h-full flex items-center overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-surface via-surface-hover to-surface"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl"></div>
          <div className="absolute inset-0 opacity-30">
            <div
              className="absolute top-10 left-10 w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--surface-frame)" }}
            ></div>
            <div
              className="absolute top-20 left-32 w-1 h-1 rounded-full"
              style={{ backgroundColor: "var(--surface-frame)" }}
            ></div>
            <div
              className="absolute top-32 left-64 w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--surface-frame)" }}
            ></div>
            <div
              className="absolute top-48 left-24 w-1 h-1 rounded-full"
              style={{ backgroundColor: "var(--surface-frame)" }}
            ></div>
            <div
              className="absolute top-64 left-80 w-2 h-2 rounded-full"
              style={{ backgroundColor: "var(--surface-frame)" }}
            ></div>
          </div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="max-w-5xl mx-auto text-center">
            {/* Trust Badge - Dynamic */}
            <div className="inline-flex items-center gap-2 px-6 py-3 bg-surface/5 backdrop-blur-sm border border-border rounded-full text-sm font-medium mb-8 hover:bg-surface/10 transition-all duration-300">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
              <span className="text-muted-foreground">
                {statsLoading
                  ? "Loading..."
                  : `Trusted by ${formatNumber(stats?.totalHomeowners || 0)}+ homeowners nationwide`}
              </span>
            </div>

            {/* Main Headline */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-bold mb-8 leading-tight">
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent">
                Find Great
              </span>
              <br />
              <span className="bg-gradient-to-r from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent">
                Contractors
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 leading-relaxed">
              Connect with trusted, verified contractors for your home projects.
              <span className="text-primary font-medium">
                {" "}
                Quality work, fair pricing, great results.
              </span>
            </p>

            {/* CTA Buttons - Clear Separation */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <a
                href="/signup?type=homeowner"
                className="group relative px-8 py-4 bg-gradient-to-r from-blue-500 via-blue-600 to-blue-700 rounded-2xl font-semibold text-white shadow-2xl hover:shadow-blue-500/25 transition-all duration-300 hover:scale-105 min-w-[240px] inline-block text-center"
                data-testid="button-homeowner-signup"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                    />
                  </svg>
                  I'm a Homeowner
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-blue-800 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>

              <a
                href="/signup?type=professional"
                className="group relative px-8 py-4 bg-gradient-to-r from-primary via-primary/90 to-primary/80 rounded-2xl font-semibold text-primary-foreground shadow-2xl hover:shadow-primary/25 transition-all duration-300 hover:scale-105 min-w-[240px] inline-block text-center"
                data-testid="button-professional-signup"
              >
                <span className="relative z-10 flex items-center justify-center gap-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                    />
                  </svg>
                  I'm a Professional
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-primary/90 to-primary rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>
            </div>

            {/* Already have account */}
            <div className="text-center mb-8">
              <a
                href="/pre-scout-setup?mode=signin"
                className="text-sm text-gray-400 hover:text-white transition-colors"
              >
                Already have an account? <span className="underline">Sign in</span>
              </a>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Fully Licensed & Insured
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Background Verified
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Quality Guaranteed
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Why Choose Us Section */}
      <section className="py-24 bg-gradient-to-b from-slate-900 to-slate-800">
        <div className="container mx-auto px-6">
          <div className="text-center mb-20">
            <h2 className="text-4xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
              Why Choose TradeScout
            </h2>
            <p className="text-xl text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Connect with trusted contractors and get your projects done right
            </p>
          </div>

          <div className="grid lg:grid-cols-3 gap-8 mb-16">
            {/* Verified Contractors */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-orange-500/10 to-orange-600/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-slate-800/50 backdrop-blur-sm p-8 rounded-3xl border border-slate-700/50 group-hover:border-orange-500/30 transition-all duration-500 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 via-orange-600 to-orange-700 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-white">Verified Contractors</h3>
                <p className="text-gray-400 leading-relaxed mb-6">
                  We check backgrounds, licenses, and insurance so you know you're working with
                  trustworthy professionals.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Background checked
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Licensed professionals
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Fully insured
                  </div>
                </div>
              </div>
            </div>

            {/* Precision Matching */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-surface-hover backdrop-blur-sm p-8 rounded-3xl border border-border group-hover:border-blue-500/30 transition-all duration-500 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg
                    className="w-8 h-8 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-primary">Smart Matching</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  We connect you with contractors who are right for your specific project and
                  location.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Local contractors
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Right skills for your project
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    Fair pricing
                  </div>
                </div>
              </div>
            </div>

            {/* White-Glove Service */}
            <div className="group relative">
              <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-primary/10 rounded-3xl blur-xl group-hover:blur-2xl transition-all duration-500"></div>
              <div className="relative bg-surface-hover backdrop-blur-sm p-8 rounded-3xl border border-border group-hover:border-primary/30 transition-all duration-500 h-full">
                <div className="w-16 h-16 bg-gradient-to-br from-primary via-primary/90 to-primary/80 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300 shadow-lg">
                  <svg
                    className="w-8 h-8 text-primary-foreground"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold mb-4 text-primary">Great Support</h3>
                <p className="text-muted-foreground leading-relaxed mb-6">
                  We're here to help make sure your project goes smoothly from start to finish.
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Helpful support team
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Quick responses
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                    Work guaranteed
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Numbers Section */}
      <section className="relative py-24 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface-hover to-surface"></div>
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent"></div>
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-primary to-transparent"></div>
        </div>

        <div className="container mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent">
              Trusted by Thousands
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Join residents, pros, and community leaders across the country
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8">
            <div className="group text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/20 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-surface-hover backdrop-blur-sm border border-border rounded-3xl p-8 group-hover:border-primary/30 transition-all duration-500">
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent mb-3">
                    {statsLoading ? "..." : `${formatNumber(stats?.totalContractors || 0)}+`}
                  </div>
                  <div className="text-primary text-lg font-semibold mb-2">Great Contractors</div>
                  <div className="text-muted-foreground text-sm">Trusted professionals</div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-xs text-primary">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Verified & Insured
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/20 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-surface-hover backdrop-blur-sm border border-border rounded-3xl p-8 group-hover:border-primary/30 transition-all duration-500">
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent mb-3">
                    {statsLoading ? "..." : `${formatNumber(stats?.totalHomeowners || 0)}+`}
                  </div>
                  <div className="text-primary text-lg font-semibold mb-2">Happy Homeowners</div>
                  <div className="text-muted-foreground text-sm">Satisfied customers</div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-xs text-primary">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      {statsLoading ? "98%" : `${(stats?.successRate || 98).toFixed(1)}%`}{" "}
                      Satisfaction Rate
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/20 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-surface-hover backdrop-blur-sm border border-border rounded-3xl p-8 group-hover:border-primary/30 transition-all duration-500">
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent mb-3">
                    {statsLoading ? "..." : formatCurrency(stats?.totalProjectValue || 0)}
                  </div>
                  <div className="text-primary text-lg font-semibold mb-2">Projects Completed</div>
                  <div className="text-muted-foreground text-sm">Total project value</div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-xs text-primary">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      On-Time Delivery
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="group text-center">
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/20 rounded-3xl blur-lg group-hover:blur-xl transition-all duration-500"></div>
                <div className="relative bg-surface-hover backdrop-blur-sm border border-border rounded-3xl p-8 group-hover:border-primary/30 transition-all duration-500">
                  <div className="text-5xl md:text-6xl font-bold bg-gradient-to-br from-primary via-primary/90 to-primary/80 bg-clip-text text-transparent mb-3">
                    {statsLoading ? "..." : `${(stats?.successRate || 99.2).toFixed(1)}%`}
                  </div>
                  <div className="text-primary text-lg font-semibold mb-2">Success Rate</div>
                  <div className="text-muted-foreground text-sm">Project completion</div>
                  <div className="mt-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-center gap-2 text-xs text-primary">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Quality Guaranteed
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Get Started Section */}
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
                Ready to Get
              </span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-600 bg-clip-text text-transparent">
                Started?
              </span>
            </h2>

            <p className="text-xl md:text-2xl text-gray-400 max-w-3xl mx-auto mb-16 leading-relaxed">
              Join thousands of homeowners who found great contractors through TradeScout.
              <span className="text-white font-medium">
                {" "}
                Trusted contractors, quality work, fair prices.
              </span>
            </p>

            <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-12">
              <a
                href="/signup?type=homeowner"
                className="group relative px-10 py-5 bg-gradient-to-r from-orange-500 via-orange-600 to-orange-700 rounded-2xl font-bold text-white text-lg shadow-2xl hover:shadow-orange-500/25 transition-all duration-300 hover:scale-105 min-w-[280px] inline-block text-center"
                data-testid="button-find-contractors"
              >
                <span className="relative z-10 flex items-center justify-center gap-3">
                  Find Contractors
                  <svg
                    className="w-6 h-6 group-hover:translate-x-1 transition-transform"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 8l4 4m0 0l-4 4m4-4H3"
                    />
                  </svg>
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-orange-600 to-orange-800 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
              </a>

              <a
                href="/signup?type=homeowner"
                className="group relative px-10 py-5 backdrop-blur-sm border border-white/20 rounded-2xl font-bold text-white text-lg hover:border-white/30 transition-all duration-300 min-w-[280px] inline-block text-center"
                data-testid="button-schedule-consultation"
              >
                <span className="flex items-center justify-center gap-3">
                  Schedule Consultation
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                </span>
              </a>
            </div>

            {/* Premium Guarantees */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500 pt-8 border-t border-white/10">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                100% Satisfaction Guarantee
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Great Support Included
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-emerald-400" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                    clipRule="evenodd"
                  />
                </svg>
                Great Contractor Network
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
});

export default SimpleLanding;
