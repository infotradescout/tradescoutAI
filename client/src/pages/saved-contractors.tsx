import { memo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Heart, Star, MapPin, Phone, Mail, Wrench } from "lucide-react";
import { Link } from "wouter";

const SavedContractors = memo(function SavedContractors() {
  // Mock data - would come from API in real app
  const savedContractors = [
    {
      id: 1,
      name: "ABC Plumbing & Heating",
      category: "Plumbing",
      rating: 4.8,
      reviews: 127,
      location: "Los Angeles, CA",
      phone: "(555) 123-4567",
      email: "contact@abcplumbing.com",
      image: null
    },
    {
      id: 2,
      name: "Elite Electrical Services",
      category: "Electrical",
      rating: 4.9,
      reviews: 89,
      location: "Los Angeles, CA",
      phone: "(555) 234-5678",
      email: "info@eliteelectrical.com",
      image: null
    },
    {
      id: 3,
      name: "Perfect Paint Pro",
      category: "Painting",
      rating: 4.7,
      reviews: 156,
      location: "Beverly Hills, CA",
      phone: "(555) 345-6789",
      email: "hello@perfectpaint.com",
      image: null
    }
  ];

  return (
    <div className="min-h-screen bg-[#0f1419] pb-20 lg:pb-0">
      <div className="container mx-auto px-4 py-6 lg:py-10">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="mb-8 lg:mb-12">
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg">
                  <Heart className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h1 className="text-3xl lg:text-5xl font-bold text-white mb-1">Saved Contractors</h1>
                  <p className="text-lg text-slate-400">
                    Your favorite contractors and service providers
                  </p>
                </div>
              </div>
              <Link href="/find-contractors">
                <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                  Find More
                </Button>
              </Link>
            </div>
          </div>

          {/* Contractors List */}
          {savedContractors.length === 0 ? (
            <Card className="bg-[#1a2332] border-[#2d3748] shadow-xl">
              <CardContent className="pt-12 pb-12 text-center">
                <Heart className="h-16 w-16 text-slate-600 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-white mb-2">No Saved Contractors Yet</h2>
                <p className="text-slate-400 mb-6">
                  Start exploring contractors and save your favorites for easy access
                </p>
                <Link href="/find-contractors">
                  <Button className="bg-orange-500 hover:bg-orange-600 text-white">
                    Browse Contractors
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {savedContractors.map((contractor) => (
                <Card key={contractor.id} className="bg-[#1a2332] border-[#2d3748] shadow-xl hover:border-orange-500/30 transition-all">
                  <CardContent className="p-6">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Contractor Image/Icon */}
                      <div className="flex-shrink-0">
                        <div className="h-24 w-24 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-lg">
                          {contractor.name.split(' ').map(w => w[0]).join('').slice(0, 2)}
                        </div>
                      </div>

                      {/* Contractor Info */}
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-3">
                          <div>
                            <h3 className="text-xl font-bold text-white mb-1">{contractor.name}</h3>
                            <div className="flex items-center gap-3 text-sm text-slate-300">
                              <span className="flex items-center gap-1">
                                <Wrench className="h-4 w-4 text-orange-500" />
                                {contractor.category}
                              </span>
                              <span className="flex items-center gap-1">
                                <MapPin className="h-4 w-4 text-orange-500" />
                                {contractor.location}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          >
                            <Heart className="h-5 w-5 fill-current" />
                          </Button>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                          <div className="flex items-center gap-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`h-4 w-4 ${
                                  i < Math.floor(contractor.rating)
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-slate-600'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-white font-semibold">{contractor.rating}</span>
                          <span className="text-slate-400 text-sm">({contractor.reviews} reviews)</span>
                        </div>

                        <div className="flex flex-wrap gap-3 mb-4">
                          <a
                            href={`tel:${contractor.phone}`}
                            className="flex items-center gap-2 text-sm text-slate-300 hover:text-orange-500 transition-colors"
                          >
                            <Phone className="h-4 w-4" />
                            {contractor.phone}
                          </a>
                          <a
                            href={`mailto:${contractor.email}`}
                            className="flex items-center gap-2 text-sm text-slate-300 hover:text-orange-500 transition-colors"
                          >
                            <Mail className="h-4 w-4" />
                            {contractor.email}
                          </a>
                        </div>

                        <div className="flex gap-2">
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white">
                            View Profile
                          </Button>
                          <Button size="sm" variant="outline" className="border-[#2d3748] text-slate-300 hover:bg-[#0f1419]">
                            Request Quote
                          </Button>
                          <Button size="sm" variant="outline" className="border-[#2d3748] text-slate-300 hover:bg-[#0f1419]">
                            Message
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
});

export default SavedContractors;
