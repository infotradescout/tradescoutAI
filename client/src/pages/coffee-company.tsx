import { memo } from 'react';
import { Coffee, Heart, Users, DollarSign, Target, Award, Truck, Leaf } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';

const CoffeeCompany = memo(function CoffeeCompany() {
  return (
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <div className="w-24 h-24 bg-gradient-to-br from-orange-600 to-orange-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
            <Coffee className="h-12 w-12 text-white" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-6">
            TradeScout <span className="text-orange-400">Coffee Company</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-8">
            Every cup creates impact. 100% of profits fund trade education, community projects, and the Mike Rowe Works Foundation.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Badge className="bg-orange-600 hover:bg-orange-700 px-4 py-2 text-base">
              100% Profit Donation
            </Badge>
            <Badge className="bg-green-600 hover:bg-green-700 px-4 py-2 text-base">
              Ethically Sourced
            </Badge>
            <Badge className="bg-blue-600 hover:bg-blue-700 px-4 py-2 text-base">
              Direct Trade
            </Badge>
          </div>
        </div>

        {/* Impact Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Heart className="h-8 w-8 text-red-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">$125,000</div>
              <div className="text-gray-400 text-sm">Donated to Date</div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Users className="h-8 w-8 text-blue-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">450</div>
              <div className="text-gray-400 text-sm">Students Supported</div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Target className="h-8 w-8 text-green-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">28</div>
              <div className="text-gray-400 text-sm">Community Projects</div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-6 text-center">
              <Coffee className="h-8 w-8 text-orange-400 mx-auto mb-3" />
              <div className="text-2xl font-bold text-white mb-1">75,000</div>
              <div className="text-gray-400 text-sm">Cups Sold</div>
            </CardContent>
          </Card>
        </div>

        {/* Product Showcase */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-12">
          <CardHeader>
            <CardTitle className="text-white text-2xl text-center">Our Coffee Collection</CardTitle>
            <p className="text-gray-400 text-center">Premium blends supporting skilled trades education</p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  name: "Foundation Blend",
                  description: "Rich, full-bodied blend supporting the Mike Rowe Works Foundation",
                  price: "$18.99",
                  origin: "Colombia & Guatemala",
                  roast: "Medium",
                  impact: "Funds 2 scholarship applications",
                  image: "https://images.unsplash.com/photo-1498804103079-a6351b050096?w=300&h=300&fit=crop"
                },
                {
                  name: "Builders Roast",
                  description: "Bold, strong coffee for early morning construction starts",
                  price: "$19.99",
                  origin: "Brazil & Ethiopia",
                  roast: "Dark",
                  impact: "Supports 1 community project",
                  image: "https://images.unsplash.com/photo-1559056199-641a0ac8b55e?w=300&h=300&fit=crop"
                },
                {
                  name: "Craft Coffee",
                  description: "Artisanal light roast highlighting craftsmanship in every cup",
                  price: "$21.99",
                  origin: "Single Origin - Kenya",
                  roast: "Light",
                  impact: "Funds trade school equipment",
                  image: "https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=300&h=300&fit=crop"
                }
              ].map((coffee, index) => (
                <div key={index} className="bg-navy-700/50 rounded-lg p-6 hover:bg-navy-600/50 transition-colors">
                  <img
                    src={coffee.image}
                    alt={coffee.name}
                    className="w-full h-48 object-cover rounded-lg mb-4"
                  />
                  <h3 className="text-xl font-semibold text-white mb-2">{coffee.name}</h3>
                  <p className="text-gray-400 text-sm mb-4">{coffee.description}</p>
                  
                  <div className="space-y-2 mb-4">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Origin:</span>
                      <span className="text-white">{coffee.origin}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Roast:</span>
                      <span className="text-white">{coffee.roast}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Impact:</span>
                      <span className="text-orange-400">{coffee.impact}</span>
                    </div>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-2xl font-bold text-orange-400">{coffee.price}</span>
                    <Button className="bg-orange-600 hover:bg-orange-700">
                      Add to Cart
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Impact Breakdown */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-12">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Where Your Money Goes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white">Mike Rowe Works Foundation</span>
                    <span className="text-orange-400">50%</span>
                  </div>
                  <Progress value={50} className="h-3" />
                  <p className="text-gray-400 text-xs mt-1">Trade scholarships and workforce development</p>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-white">Local Community Projects</span>
                    <span className="text-green-400">50%</span>
                  </div>
                  <Progress value={50} className="h-3" />
                  <p className="text-gray-400 text-xs mt-1">Infrastructure and educational initiatives</p>
                </div>

                <div className="bg-navy-700/50 rounded-lg p-4 mt-4">
                  <p className="text-white text-sm font-medium mb-2">100% Transparency Promise</p>
                  <p className="text-gray-400 text-xs">
                    Every dollar of profit is tracked and reported. No administrative fees, no overhead costs.
                    All donations go directly to their intended recipients.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Award className="h-5 w-5" />
                Recent Impact Stories
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  {
                    title: "Welding Equipment for Riverside Community College",
                    amount: "$15,000",
                    description: "New welding stations for 50 students per semester",
                    date: "March 2024"
                  },
                  {
                    title: "Mike Rowe Works Scholarship Recipients",
                    amount: "$8,500",
                    description: "5 students received trade education scholarships",
                    date: "February 2024"
                  },
                  {
                    title: "Veterans Retraining Program",
                    amount: "$12,000",
                    description: "Carpentry tools and training for 15 veterans",
                    date: "January 2024"
                  }
                ].map((story, index) => (
                  <div key={index} className="bg-navy-700/50 rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="text-white font-medium text-sm">{story.title}</h4>
                      <Badge className="bg-green-600 hover:bg-green-700">
                        {story.amount}
                      </Badge>
                    </div>
                    <p className="text-gray-400 text-xs mb-2">{story.description}</p>
                    <p className="text-gray-500 text-xs">{story.date}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Values & Sustainability */}
        <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm mb-12">
          <CardHeader>
            <CardTitle className="text-white text-2xl text-center flex items-center justify-center gap-3">
              <Leaf className="h-6 w-6" />
              Our Values
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="text-center">
                <Truck className="h-12 w-12 text-blue-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">Direct Trade</h3>
                <p className="text-gray-400 text-sm">
                  We work directly with coffee farmers, ensuring fair prices and sustainable farming practices.
                  No middlemen, just honest relationships.
                </p>
              </div>

              <div className="text-center">
                <Heart className="h-12 w-12 text-red-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">Community First</h3>
                <p className="text-gray-400 text-sm">
                  Every purchase directly benefits both coffee-growing communities and American trade workers.
                  Your coffee creates jobs on both ends.
                </p>
              </div>

              <div className="text-center">
                <Award className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-3">Quality Craft</h3>
                <p className="text-gray-400 text-sm">
                  Just like skilled trades, great coffee requires expertise. We roast in small batches with
                  the same attention to detail as master craftsmen.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="bg-gradient-to-r from-orange-900/50 to-orange-800/50 border-orange-600 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Start Making an Impact Today</h2>
            <p className="text-gray-300 text-lg mb-6 max-w-2xl mx-auto">
              Join thousands of coffee lovers who are supporting skilled trades education and community development
              with every cup. Your morning coffee becomes someone else's career opportunity.
            </p>
            <div className="flex flex-wrap justify-center gap-4">
              <Button className="bg-orange-600 hover:bg-orange-700 text-lg px-8 py-3">
                Shop Coffee Collection
              </Button>
              <Button variant="outline" className="border-orange-600 text-orange-400 hover:bg-orange-600/20 text-lg px-8 py-3">
                Learn About Our Impact
              </Button>
            </div>
            
            <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">Free Shipping</div>
                <div className="text-gray-400 text-sm">On orders over $50</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">Fresh Roasted</div>
                <div className="text-gray-400 text-sm">Roasted to order</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-400">100% Impact</div>
                <div className="text-gray-400 text-sm">All profits donated</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default CoffeeCompany;