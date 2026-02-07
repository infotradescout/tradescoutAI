import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";

export function LegalFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      className="hidden md:block border-t"
      style={{
        backgroundColor: "var(--charcoal-900)",
        color: "var(--text-secondary)",
        borderColor: "var(--border-secondary)",
      }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Company Info */}
          <div className="col-span-1 md:col-span-1">
            <h3
              className="text-sm font-semibold mb-1 tracking-wide uppercase"
              style={{ color: "var(--text-primary)" }}
            >
              TradeScout
            </h3>
            <p className="text-xs mb-2 max-w-xs" style={{ color: "var(--text-secondary)" }}>
              Connecting residents, pros, organizations, and neighbors through verified local
              networks and valuable exchanges.
            </p>
            <div className="text-xs space-y-0.5" style={{ color: "var(--text-secondary)" }}>
              <p>📧 support@tradescout.com</p>
              <p>📍 Operating nationwide, county-first</p>
            </div>
          </div>

          {/* Legal Links */}
          <div className="col-span-1">
            <h4
              className="text-xs font-semibold mb-1 tracking-wide uppercase"
              style={{ color: "var(--text-primary)" }}
            >
              Legal
            </h4>
            <ul className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="hover:text-white transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/compliance" className="hover:text-white transition-colors">
                  Compliance
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform */}
          <div className="col-span-1">
            <h4
              className="text-xs font-semibold mb-1 tracking-wide uppercase"
              style={{ color: "var(--text-primary)" }}
            >
              Platform
            </h4>
            <ul className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <li>
                <Link href="/contractors" className="hover:text-white transition-colors">
                  Find Contractors
                </Link>
              </li>
              <li>
                <Link href="/marketplace" className="hover:text-white transition-colors">
                  Exchange
                </Link>
              </li>
              <li>
                <Link href="/quote" className="hover:text-white transition-colors">
                  Quote Calculator
                </Link>
              </li>
              <li>
                <Link href="/community" className="hover:text-white transition-colors">
                  Community
                </Link>
              </li>
            </ul>
          </div>

          {/* Compliance */}
          <div className="col-span-1">
            <h4
              className="text-xs font-semibold mb-1 tracking-wide uppercase"
              style={{ color: "var(--text-primary)" }}
            >
              Compliance
            </h4>
            <ul className="space-y-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                INFORM Act Compliant
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                CCPA/GDPR Ready
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                ADA Accessible
              </li>
              <li className="flex items-center">
                <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                PCI DSS Secure
              </li>
            </ul>
          </div>
        </div>

        <Separator className="my-3" style={{ backgroundColor: "var(--border-secondary)" }} />

        <div
          className="flex flex-col md:flex-row justify-between items-start gap-2 text-[11px] md:text-xs"
          style={{ color: "var(--text-secondary)" }}
        >
          <div>
            <p className="whitespace-pre-line">
              &copy; {currentYear} TradeScout. All rights reserved.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 justify-end">
            <button
              onClick={() => window.open("/privacy", "_blank")}
              className="hover:text-orange-400 transition-colors"
            >
              🍪 Cookie Preferences
            </button>
            <Link href="/compliance" className="hover:text-orange-400 transition-colors">
              Compliance Dashboard
            </Link>
          </div>
        </div>

        {/* Compliance Statement */}
        <div className="mt-3 pt-2 border-t" style={{ borderColor: "var(--border-secondary)" }}>
          <p
            className="text-[10px] leading-relaxed text-left md:text-center max-w-4xl mx-auto"
            style={{ color: "var(--text-secondary)" }}
          >
            TradeScout operates in compliance with federal, state, and local regulations including
            the INFORM Consumers Act, state marketplace facilitator tax laws, CCPA/GDPR privacy
            requirements, and ADA accessibility standards. All transactions are processed securely
            through PCI DSS compliant payment processors.
          </p>
        </div>
      </div>
    </footer>
  );
}
