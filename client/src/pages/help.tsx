
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  HelpCircle, 
  MessageCircle, 
  Phone, 
  Mail, 
  FileText, 
  Video,
  Search,
  Clock,
  Users,
  BookOpen
} from "lucide-react";

export default function Help() {
  const helpCategories = [
    {
      title: "Getting Started",
      icon: BookOpen,
      articles: [
        "How to create your first project",
        "Setting up your profile",
        "Finding contractors in your area",
        "Understanding the quote process"
      ]
    },
    {
      title: "For Contractors",
      icon: Users,
      articles: [
        "How to join the network",
        "Creating winning proposals",
        "Managing your reputation",
        "Using the accelerator program"
      ]
    },
    {
      title: "Marketplace",
      icon: Search,
      articles: [
        "Buying and selling equipment",
        "Creating effective listings",
        "Safe transaction practices",
        "Return and refund policies"
      ]
    }
  ];

  return (
    <div className="min-h-screen gradient-bg">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Help Center</h1>
          <p className="text-xl text-gray-300 max-w-2xl mx-auto">
            Get answers to your questions and learn how to make the most of TradeScout
          </p>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card className="bg-navy-800 border-navy-600 hover:bg-navy-700 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <MessageCircle className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <h3 className="text-white font-medium">Live Chat</h3>
              <p className="text-gray-400 text-sm">Get instant help</p>
            </CardContent>
          </Card>
          
          <Card className="bg-navy-800 border-navy-600 hover:bg-navy-700 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <Phone className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <h3 className="text-white font-medium">Call Support</h3>
              <p className="text-gray-400 text-sm">1-800-TRADESCOUT</p>
            </CardContent>
          </Card>
          
          <Card className="bg-navy-800 border-navy-600 hover:bg-navy-700 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <Mail className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <h3 className="text-white font-medium">Email Us</h3>
              <p className="text-gray-400 text-sm">support@tradescout.com</p>
            </CardContent>
          </Card>
          
          <Card className="bg-navy-800 border-navy-600 hover:bg-navy-700 transition-colors cursor-pointer">
            <CardContent className="p-4 text-center">
              <Video className="w-8 h-8 text-orange-500 mx-auto mb-2" />
              <h3 className="text-white font-medium">Video Tutorials</h3>
              <p className="text-gray-400 text-sm">Learn by watching</p>
            </CardContent>
          </Card>
        </div>

        {/* Help Categories */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {helpCategories.map((category, index) => {
            const Icon = category.icon;
            return (
              <Card key={index} className="bg-navy-800 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center text-white">
                    <Icon className="w-5 h-5 text-orange-500 mr-2" />
                    {category.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {category.articles.map((article, articleIndex) => (
                      <div key={articleIndex} className="flex items-center text-gray-300 hover:text-white cursor-pointer transition-colors">
                        <FileText className="w-4 h-4 mr-2 text-gray-400" />
                        <span className="text-sm">{article}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Support Hours */}
        <Card className="bg-navy-800 border-navy-600 mt-8">
          <CardHeader>
            <CardTitle className="flex items-center text-white">
              <Clock className="w-5 h-5 text-orange-500 mr-2" />
              Support Hours
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-gray-300">
              <div>
                <h4 className="font-medium text-white mb-2">Live Chat & Phone</h4>
                <p>Monday - Friday: 8:00 AM - 8:00 PM EST</p>
                <p>Saturday - Sunday: 10:00 AM - 6:00 PM EST</p>
              </div>
              <div>
                <h4 className="font-medium text-white mb-2">Email Support</h4>
                <p>24/7 - We respond within 4 hours</p>
                <Badge variant="secondary" className="mt-2">
                  Average response: 1.2 hours
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
