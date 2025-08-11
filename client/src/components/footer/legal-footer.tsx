import { Link } from "wouter";
import { Separator } from "@/components/ui/separator";

export function LegalFooter() {
  const currentYear = new Date().getFullYear();
  
  return (
    <footer className="bg-gray-900 text-gray-300 py-12 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          
          {/* Company Info */}
          <div className="col-span-1 md:col-span-1">
            <h3 className="text-lg font-semibold text-white mb-4">TradeScout</h3>
            <p className="text-sm mb-4">
              Connecting homeowners with verified contractors and facilitating valuable exchanges.
            </p>
            <div className="text-sm">
              <p>📧 support@tradescout.com</p>
              <p>📞 [Your Phone Number]</p>
            </div>
          </div>

          {/* Legal Links */}
          <div className="col-span-1">
            <h4 className="text-md font-medium text-white mb-4">Legal</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/legal/privacy-policy" className="hover:text-white transition-colors">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/terms-of-service" className="hover:text-white transition-colors">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/legal/cookie-policy" className="hover:text-white transition-colors">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="/legal/compliance" className="hover:text-white transition-colors">
                  Compliance
                </Link>
              </li>
            </ul>
          </div>

          {/* Platform */}
          <div className="col-span-1">
            <h4 className="text-md font-medium text-white mb-4">Platform</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/contractors/board" className="hover:text-white transition-colors">
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
            <h4 className="text-md font-medium text-white mb-4">Compliance</h4>
            <ul className="space-y-2 text-sm">
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

        <Separator className="my-8 bg-gray-700" />

        <div className="flex flex-col md:flex-row justify-between items-center text-sm">
          <div className="mb-4 md:mb-0">
            <p>&copy; {currentYear} TradeScout. All rights reserved.</p>
          </div>
          
          <div className="flex space-x-6">
            <button 
              onClick={() => window.open('/legal/cookie-policy', '_blank')}
              className="hover:text-white transition-colors"
            >
              🍪 Cookie Preferences
            </button>
            <Link href="/legal/compliance" className="hover:text-white transition-colors">
              Compliance Dashboard
            </Link>
          </div>
        </div>

        {/* Compliance Statement */}
        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-xs text-gray-400 text-center">
            TradeScout operates in compliance with federal, state, and local regulations including the INFORM Consumers Act, 
            state marketplace facilitator tax laws, CCPA/GDPR privacy requirements, and ADA accessibility standards. 
            All transactions are processed securely through PCI DSS compliant payment processors.
          </p>
        </div>
      </div>
    </footer>
  );
}