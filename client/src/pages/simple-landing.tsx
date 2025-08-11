import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function SimpleLanding() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 to-black text-white">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center">
          <h1 className="text-4xl font-bold mb-6">
            Welcome to TradeScout
            <span className="text-orange-500"> Social Platform</span>
          </h1>
          <p className="text-xl text-gray-300 mb-8">
            Connect with your community, share updates, and discover local services
          </p>
          
          <div className="space-x-4 mb-12">
            <Link href="/login">
              <Button size="lg" className="bg-orange-500 hover:bg-orange-600">
                Get Started
              </Button>
            </Link>
            <Link href="/community">
              <Button variant="outline" size="lg">
                Explore Community
              </Button>
            </Link>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center p-6 bg-gray-800/50 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Social Feed</h3>
              <p className="text-gray-400">Share updates and stay connected with your neighbors</p>
            </div>
            <div className="text-center p-6 bg-gray-800/50 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Local Contractors</h3>
              <p className="text-gray-400">Find trusted professionals in your area</p>
            </div>
            <div className="text-center p-6 bg-gray-800/50 rounded-lg">
              <h3 className="text-xl font-semibold mb-3">Community</h3>
              <p className="text-gray-400">Connect with neighbors and local businesses</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}