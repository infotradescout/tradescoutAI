import { GuestGate } from "@/components/guest-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Cookies() {
  return (
    <GuestGate action="view-cookies">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-navy-800 border-navy-600 text-white">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Cookie Policy</CardTitle>
            <p className="text-center text-gray-300 mt-2">
              Last updated: {new Date().toLocaleDateString()}
            </p>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold mb-3 text-orange-400">What Are Cookies</h2>
              <p className="text-gray-300">
                Cookies are small text files that are stored on your computer or mobile device when you visit a website. 
                They help us provide you with a better experience by remembering your preferences and improving site functionality.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-orange-400">How We Use Cookies</h2>
              <div className="space-y-4">
                <div>
                  <h3 className="font-medium text-white mb-2">Essential Cookies</h3>
                  <p className="text-gray-300">Required for basic site functionality, user authentication, and security.</p>
                </div>
                
                <div>
                  <h3 className="font-medium text-white mb-2">Analytics Cookies</h3>
                  <p className="text-gray-300">Help us understand how visitors interact with our website to improve user experience.</p>
                </div>
                
                <div>
                  <h3 className="font-medium text-white mb-2">Functional Cookies</h3>
                  <p className="text-gray-300">Remember your preferences and settings to provide enhanced, personalized features.</p>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-orange-400">Managing Cookies</h2>
              <p className="text-gray-300 mb-3">
                You can control and manage cookies through your browser settings. However, please note that 
                disabling cookies may affect website functionality and your user experience.
              </p>
              <ul className="list-disc list-inside text-gray-300 space-y-1">
                <li>Chrome: Settings → Advanced → Privacy and Security → Site Settings → Cookies</li>
                <li>Firefox: Options → Privacy & Security → Cookies and Site Data</li>
                <li>Safari: Preferences → Privacy → Cookies and Website Data</li>
                <li>Edge: Settings → Site Permissions → Cookies and Site Data</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-orange-400">Cookie Consent</h2>
              <p className="text-gray-300">
                By continuing to use TradeScout, you consent to our use of cookies as described in this policy. 
                For essential cookies required for basic functionality, no consent is required.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3 text-orange-400">Contact Us</h2>
              <p className="text-gray-300">
                If you have questions about our use of cookies, please contact us at privacy@tradescout.com
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </GuestGate>
  );
}