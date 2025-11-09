import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Hammer, Heart, Users, Shield, Target, Award, Building, Globe } from 'lucide-react';

const About = memo(function About() {
  const missionPoints = [
    {
      icon: Hammer,
      title: "Connecting Quality Contractors",
      description: "We verify and showcase the best contractors in every community, ensuring homeowners find reliable professionals."
    },
    {
      icon: Heart,
      title: "Supporting Communities",
      description: "10% of our profits support the Mike Rowe Works Foundation and local community projects."
    },
    {
      icon: Users,
      title: "Building Trust",
      description: "Our verification system and community feedback create a trusted marketplace for home improvement."
    },
    {
      icon: Shield,
      title: "Ensuring Quality",
      description: "Rigorous verification, insurance requirements, and quality standards protect both contractors and homeowners."
    }
  ];

  const stats = [
    { number: '3,112', label: 'Counties Covered', description: 'Nationwide coverage across all 50 states' },
    { number: '15,000+', label: 'Verified Contractors', description: 'Licensed and insured professionals' },
    { number: '250,000+', label: 'Projects Completed', description: 'Successful home improvements' },
    { number: '$50M+', label: 'Community Investment', description: 'Economic impact in local communities' }
  ];

  const timeline = [
    {
      year: '2023',
      title: 'Foundation',
      description: 'TradeScout founded with a mission to connect quality contractors with homeowners'
    },
    {
      year: '2024',
      title: 'National Expansion',
      description: 'Expanded to cover all 3,112 counties across the United States'
    },
    {
      year: '2024',
      title: 'HOA Partnership',
      description: 'Launched comprehensive HOA management and community features'
    },
    {
      year: '2024',
      title: 'Foundation Partnership',
      description: 'Partnered with Mike Rowe Works Foundation to support skilled trades'
    }
  ];

  const values = [
    {
      icon: Target,
      title: "Quality First",
      description: "We prioritize quality contractors and workmanship above all else. Every contractor goes through our rigorous verification process."
    },
    {
      icon: Users,
      title: "Community-Centered",
      description: "Local communities are at the heart of everything we do. We organize by county to strengthen local connections."
    },
    {
      icon: Shield,
      title: "Trust & Transparency",
      description: "Open feedback systems, verified reviews, and transparent pricing help build trust between contractors and homeowners."
    },
    {
      icon: Heart,
      title: "Giving Back",
      description: "We donate 10% of profits to support trade education and community development programs."
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"></div>
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl"></div>
        </div>

        <div className="relative z-10 container mx-auto px-6 py-20">
          <div className="max-w-4xl mx-auto text-center">
            <Badge className="mb-6 bg-orange-600/20 text-orange-400 border-orange-600/30 text-sm px-4 py-2">
              About TradeScout
            </Badge>
            
            <h1 className="text-5xl md:text-7xl font-bold mb-6">
              <span className="bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">
                Building America's
              </span>
              <br />
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
                Home Improvement Future
              </span>
            </h1>
            
            <p className="text-xl text-gray-300 mb-8 leading-relaxed">
              TradeScout connects homeowners with elite contractors while supporting communities 
              and the skilled trades through our partnership with the Mike Rowe Works Foundation.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-orange-600 hover:bg-orange-700 px-8 py-4 text-lg">
                Join Our Mission
              </Button>
              <Button size="lg" variant="outline" className="px-8 py-4 text-lg">
                Learn More
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-6 py-16">
        {/* Mission Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Our Mission</h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              To create the most trusted platform for home improvement by connecting quality contractors 
              with homeowners while supporting skilled trades and local communities.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {missionPoints.map((point, index) => {
              const Icon = point.icon;
              return (
                <Card key={index} className="bg-[#1a2332]/50 border-slate-700 text-center">
                  <CardContent className="p-6">
                    <div className="w-16 h-16 bg-orange-600/20 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Icon className="w-8 h-8 text-orange-400" />
                    </div>
                    <h3 className="font-semibold text-white mb-3">{point.title}</h3>
                    <p className="text-gray-400 text-sm">{point.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Stats Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Impact by the Numbers</h2>
            <p className="text-xl text-gray-300">
              See how TradeScout is transforming the home improvement industry
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <Card key={index} className="bg-[#1a2332]/50 border-slate-700 text-center">
                <CardContent className="p-6">
                  <div className="text-4xl font-bold text-orange-400 mb-2">{stat.number}</div>
                  <h3 className="font-semibold text-white mb-2">{stat.label}</h3>
                  <p className="text-gray-400 text-sm">{stat.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Values Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Our Values</h2>
            <p className="text-xl text-gray-300">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {values.map((value, index) => {
              const Icon = value.icon;
              return (
                <Card key={index} className="bg-[#1a2332]/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-3">
                      <div className="w-10 h-10 bg-orange-600/20 rounded-lg flex items-center justify-center">
                        <Icon className="w-6 h-6 text-orange-400" />
                      </div>
                      {value.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-300">{value.description}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Timeline Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-white mb-4">Our Journey</h2>
            <p className="text-xl text-gray-300">
              Key milestones in building the future of home improvement
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 transform -translate-x-1/2 w-1 h-full bg-orange-600/30"></div>
            <div className="space-y-12">
              {timeline.map((event, index) => (
                <div key={index} className={`flex items-center ${index % 2 === 0 ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className="flex-1">
                    <Card className={`bg-[#1a2332]/50 border-slate-700 ${index % 2 === 0 ? 'mr-8' : 'ml-8'}`}>
                      <CardContent className="p-6">
                        <div className="flex items-center gap-3 mb-3">
                          <Badge className="bg-orange-600 hover:bg-orange-700">
                            {event.year}
                          </Badge>
                          <h3 className="font-semibold text-white">{event.title}</h3>
                        </div>
                        <p className="text-gray-300">{event.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                  
                  <div className="w-4 h-4 bg-orange-600 rounded-full border-4 border-slate-900 z-10"></div>
                  
                  <div className="flex-1"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Foundation Partnership */}
        <Card className="bg-gradient-to-r from-orange-600/20 to-orange-500/20 border-orange-500/30 mb-20">
          <CardContent className="p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <Award className="w-8 h-8 text-orange-400" />
                  <h2 className="text-3xl font-bold text-white">Mike Rowe Works Foundation</h2>
                </div>
                <p className="text-gray-300 mb-6">
                  We're proud to partner with the Mike Rowe Works Foundation, donating 50% of our 
                  profits to support skilled trades education and workforce development. This partnership 
                  helps ensure the next generation of skilled workers has the tools and training they need to succeed.
                </p>
                <Button className="bg-orange-600 hover:bg-orange-700">
                  Learn About Our Partnership
                </Button>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-[#1a2332]/50 rounded-lg text-center">
                  <Building className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                  <p className="font-semibold text-white">Trade Schools</p>
                  <p className="text-sm text-gray-400">Supported nationwide</p>
                </div>
                <div className="p-4 bg-[#1a2332]/50 rounded-lg text-center">
                  <Users className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                  <p className="font-semibold text-white">Students</p>
                  <p className="text-sm text-gray-400">Scholarships provided</p>
                </div>
                <div className="p-4 bg-[#1a2332]/50 rounded-lg text-center">
                  <Globe className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                  <p className="font-semibold text-white">Communities</p>
                  <p className="text-sm text-gray-400">Local programs funded</p>
                </div>
                <div className="p-4 bg-[#1a2332]/50 rounded-lg text-center">
                  <Heart className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                  <p className="font-semibold text-white">Impact</p>
                  <p className="text-sm text-gray-400">Lives changed</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <Card className="bg-[#1a2332]/50 border-slate-700">
          <CardContent className="p-8 text-center">
            <h2 className="text-3xl font-bold text-white mb-4">Join the TradeScout Community</h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl mx-auto">
              Whether you're a homeowner looking for quality contractors or a contractor 
              wanting to grow your business, TradeScout is here to help you succeed.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg" className="bg-orange-600 hover:bg-orange-700">
                Find Contractors
              </Button>
              <Button size="lg" variant="outline">
                Become a Contractor
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default About;