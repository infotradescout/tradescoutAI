import { GuestGate } from "@/components/guest-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function Privacy() {
  return (
    <GuestGate action="view-privacy">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-navy-800 border-navy-600 text-white">
          <CardHeader>
            <CardTitle className="text-2xl text-center">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <section>
              <h2 className="text-lg font-semibold mb-3">Information We Collect</h2>
              <p className="text-gray-300">
                When you create an account with TradeScout, we collect information such as your name, 
                email address, and profile information. If you sign up using Facebook, we receive 
                your public profile information and email address from Facebook.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">How We Use Your Information</h2>
              <ul className="list-disc list-inside text-gray-300 space-y-2">
                <li>To provide and maintain our contractor marketplace service</li>
                <li>To verify your identity and prevent fraud</li>
                <li>To send you important updates about our service</li>
                <li>To connect homeowners with contractors in their area</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Facebook Login</h2>
              <p className="text-gray-300">
                When you log in with Facebook, we only access your basic profile information 
                (name, email, profile picture) to create your TradeScout account. We do not 
                post to Facebook on your behalf or access your Facebook friends list.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Data Security</h2>
              <p className="text-gray-300">
                We implement appropriate security measures to protect your personal information 
                against unauthorized access, alteration, disclosure, or destruction.
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold mb-3">Contact</h2>
              <p className="text-gray-300">
                If you have questions about this Privacy Policy, please contact us at 
                privacy@tradescout.com
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
    </GuestGate>
  );
}