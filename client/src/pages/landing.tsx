import { useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Shield, Calculator, Users } from "lucide-react";

export default function Landing() {
  const [selectedState, setSelectedState] = useState("");
  const [selectedCounty, setSelectedCounty] = useState("");
  const [selectedTrade, setSelectedTrade] = useState("");

  return (
    <div className="min-h-screen gradient-bg">
      {/* Hero Section */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
              Find Trusted Contractors
              <span className="text-orange-500"> In Your County</span>
            </h1>
            <p className="text-xl text-gray-300 mb-8 max-w-3xl mx-auto">
              Connect with verified, local contractors. Get quotes, read recommendations, and hire with confidence.
            </p>
            
            {/* County Search */}
            <div className="max-w-2xl mx-auto">
              <Card className="bg-navy-700 border-navy-600">
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">State</label>
                      <Select value={selectedState} onValueChange={setSelectedState}>
                        <SelectTrigger className="form-field">
                          <SelectValue placeholder="Select State" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="CA">California</SelectItem>
                          <SelectItem value="TX">Texas</SelectItem>
                          <SelectItem value="FL">Florida</SelectItem>
                          <SelectItem value="NY">New York</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">County</label>
                      <Select value={selectedCounty} onValueChange={setSelectedCounty}>
                        <SelectTrigger className="form-field">
                          <SelectValue placeholder="Select County" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="06037">Los Angeles</SelectItem>
                          <SelectItem value="06059">Orange</SelectItem>
                          <SelectItem value="06073">San Diego</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Trade</label>
                      <Select value={selectedTrade} onValueChange={setSelectedTrade}>
                        <SelectTrigger className="form-field">
                          <SelectValue placeholder="All Trades" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="plumbing">Plumbing</SelectItem>
                          <SelectItem value="electrical">Electrical</SelectItem>
                          <SelectItem value="roofing">Roofing</SelectItem>
                          <SelectItem value="hvac">HVAC</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Link href="/contractors/board">
                    <Button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-lg font-semibold mt-6 glow-effect transition-all duration-300">
                      Find Contractors
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <div className="text-orange-500 text-3xl mb-4">
                  <Shield className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Verified Contractors</h3>
                <p className="text-gray-300">All contractors are license-verified with current insurance documentation.</p>
              </CardContent>
            </Card>
            
            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <div className="text-orange-500 text-3xl mb-4">
                  <Calculator className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Regional Pricing</h3>
                <p className="text-gray-300">Get accurate cost estimates based on your specific county and project type.</p>
              </CardContent>
            </Card>
            
            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <div className="text-orange-500 text-3xl mb-4">
                  <Users className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-3">Real Recommendations</h3>
                <p className="text-gray-300">Read authentic recommendations from homeowners in your area.</p>
              </CardContent>
            </Card>
          </div>

          {/* CTA Section */}
          <div className="text-center">
            <Card className="bg-gradient-to-r from-orange-500/20 to-orange-600/20 border-orange-500/30 max-w-2xl mx-auto">
              <CardContent className="p-8">
                <h3 className="text-2xl font-bold text-white mb-4">Ready to find your contractor?</h3>
                <p className="text-gray-300 mb-6">
                  Join thousands of homeowners who have found trusted contractors through Trade Scout.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Link href="/contractors/board">
                    <Button className="bg-navy-600 hover:bg-navy-500 text-white px-8 py-3 rounded-lg font-semibold border border-navy-500">
                      Browse Contractors
                    </Button>
                  </Link>
                  <Link href="/calculator">
                    <Button className="bg-orange-500 hover:bg-orange-600 text-white px-8 py-3 rounded-lg font-semibold glow-effect">
                      Quote Calculator
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
