import { AlertCircle, Home, Map, HelpCircle, ArrowRight } from "lucide-react";
import { Link } from "wouter";
import { SEOHelmet } from "@/components/SEOHelmet";
import { motion } from "framer-motion";

export default function NotFound() {
  return (
    <>
      <SEOHelmet
        title="Page Not Found | TradeScout"
        description="The page you're looking for doesn't exist. Return to TradeScout home, explore counties, or get help."
        canonical="https://www.thetradescout.com/404"
        noIndex
      />
      <div className="w-full flex items-center justify-center px-4 py-24 font-body">
        <motion.div
          initial={{ opacity: 0, y: 30, filter: "blur(8px)" }}
          animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="max-w-md w-full space-y-6 text-center"
        >
          {/* Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-ts-orange/10 border border-ts-orange/30 rounded-2xl flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-ts-orange" />
            </div>
          </div>

          {/* Text */}
          <div>
            <h1 className="font-display text-3xl font-extrabold text-white mb-2">Page Not Found</h1>
            <p className="text-white/60 text-sm">We couldn't find the page you're looking for.</p>
          </div>

          {/* Links */}
          <div className="bg-tsCard border border-white/10 rounded-xl p-4 shadow-[0_18px_52px_rgba(0,0,0,0.36)] space-y-2 text-left">
            <Link href="/">
              <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="w-8 h-8 bg-ts-orange/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Home className="w-4 h-4 text-ts-orange" />
                </div>
                <span className="text-sm text-white group-hover:text-ts-orange transition-colors">
                  Go to Home
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-white/30 ml-auto group-hover:text-ts-orange transition-colors" />
              </a>
            </Link>
            <Link href="/county-directory">
              <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="w-8 h-8 bg-ts-orange/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Map className="w-4 h-4 text-ts-orange" />
                </div>
                <span className="text-sm text-white group-hover:text-ts-orange transition-colors">
                  Browse Counties
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-white/30 ml-auto group-hover:text-ts-orange transition-colors" />
              </a>
            </Link>
            <Link href="/help/how-tradescout-works">
              <a className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors group">
                <div className="w-8 h-8 bg-ts-orange/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <HelpCircle className="w-4 h-4 text-ts-orange" />
                </div>
                <span className="text-sm text-white group-hover:text-ts-orange transition-colors">
                  How TradeScout Works
                </span>
                <ArrowRight className="w-3.5 h-3.5 text-white/30 ml-auto group-hover:text-ts-orange transition-colors" />
              </a>
            </Link>
          </div>
        </motion.div>
      </div>
    </>
  );
}
