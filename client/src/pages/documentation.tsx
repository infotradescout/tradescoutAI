import { memo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BookOpen,
  Search,
  FileText,
  Video,
  Download,
  ExternalLink,
  Lightbulb,
  Settings,
  Users,
} from "lucide-react";
import { HelpArticleWrapper } from "@/components/help/HelpArticleWrapper";
import { getCategoryColorClass } from "@/lib/colors";

const Documentation = memo(function Documentation() {
  const [searchQuery, setSearchQuery] = useState("");

  const documentationSections = [
    {
      id: "getting-started",
      title: "Getting Started",
      icon: Lightbulb,
      description: "Essential guides for people new to TradeScout",
      articles: [
        { title: "First 10 Minutes on TradeScout", views: 1247, type: "guide" },
        { title: "Identity and Verification Basics", views: 892, type: "guide" },
        { title: "Set Your Local Scope Correctly", views: 734, type: "guide" },
        { title: "Scout + Direct Connect Fundamentals", views: 567, type: "overview" },
      ],
    },
    {
      id: "lead-management",
      title: "Requests and Follow-up",
      icon: Users,
      description: "How to handle requests and keep follow-up clear",
      articles: [
        { title: "Direct Connect Response Guide", views: 1089, type: "guide" },
        { title: "Conversation Templates", views: 845, type: "template" },
        { title: "Follow-up Without Friction", views: 623, type: "guide" },
        { title: "Request Prioritization Rules", views: 456, type: "reference" },
      ],
    },
    {
      id: "features",
      title: "Platform Features",
      icon: Settings,
      description: "Detailed walkthroughs for key platform tools",
      articles: [
        { title: "Admin Overview Walkthrough", views: 967, type: "guide" },
        { title: "Admin Navigation Map", views: 789, type: "guide" },
        { title: "Payments and Records Controls", views: 612, type: "reference" },
        { title: "Mobile Shortcuts", views: 534, type: "guide" },
      ],
    },
    {
      id: "business",
      title: "Business Growth",
      icon: FileText,
      description: "Practical guides for local business growth",
      articles: [
        { title: "Build Trust Through Delivery Signals", views: 1156, type: "guide" },
        { title: "Pricing With Transparency", views: 923, type: "guide" },
        { title: "Local Offer Positioning", views: 678, type: "guide" },
        { title: "Retention Through Reliability", views: 445, type: "tip" },
      ],
    },
  ];

  const popularArticles = [
    {
      title: "How to Route the Right Next Step",
      category: "Business Growth",
      views: 2340,
      type: "guide",
    },
    {
      title: "Verification Requirements",
      category: "Getting Started",
      views: 1876,
      type: "reference",
    },
    {
      title: "Payments and Records Guide",
      category: "Platform Features",
      views: 1654,
      type: "guide",
    },
    {
      title: "Response Time and Reliability",
      category: "Requests and Follow-up",
      views: 1432,
      type: "guide",
    },
    {
      title: "Profile Credibility Checklist",
      category: "Getting Started",
      views: 1298,
      type: "tip",
    },
  ];

  const videoTutorials = [
    {
      title: "Platform Overview for New Users",
      duration: "12:45",
      views: 3456,
      thumbnail: "bg-gradient-to-br from-blue-600 to-purple-600",
    },
    {
      title: "Running Your First Direct Connect Request",
      duration: "8:30",
      views: 2789,
      thumbnail: "bg-gradient-to-br from-emerald-600 to-cyan-600",
    },
    {
      title: "Using TradeScout on Mobile",
      duration: "15:20",
      views: 2234,
      thumbnail: "bg-gradient-to-br from-orange-600 to-red-600",
    },
    {
      title: "Admin Dashboard Deep Dive",
      duration: "18:15",
      views: 1987,
      thumbnail: "bg-gradient-to-br from-purple-600 to-pink-600",
    },
  ];

  const getTypeColor = (type: string) => {
    return getCategoryColorClass(type);
  };

  return (
    <HelpArticleWrapper>
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold text-white mb-4">Documentation Center</h1>
            <p className="text-xl text-white/70">
              Practical guides that explain what to do next in clear, simple language.
            </p>
          </div>

          {/* Search Bar */}
          <Card className="bg-white/5 border-white/10 mb-8">
            <CardContent className="p-6">
              <div className="relative">
                <Search className="w-5 h-5 text-white/60 absolute left-4 top-1/2 transform -translate-y-1/2" />
                <Input
                  placeholder="Search documentation..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-12 h-12 bg-white/10 border-white/15 text-white text-lg"
                />
                <Button
                  size="sm"
                  className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-ts-orange-dark hover:bg-ts-orange-dark"
                >
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="browse" className="space-y-6">
            <TabsList className="grid grid-cols-2 md:grid-cols-4 gap-2">
              <TabsTrigger value="browse">Browse by section</TabsTrigger>
              <TabsTrigger value="popular">Popular</TabsTrigger>
              <TabsTrigger value="videos">Video tutorials</TabsTrigger>
              <TabsTrigger value="downloads">Downloads</TabsTrigger>
            </TabsList>

            <TabsContent value="browse">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {documentationSections.map((section) => {
                  const Icon = section.icon;
                  return (
                    <Card key={section.id} className="bg-white/5 border-white/10">
                      <CardHeader>
                        <CardTitle className="text-white flex items-center gap-2">
                          <Icon className="w-5 h-5 text-ts-orange" />
                          {section.title}
                        </CardTitle>
                        <CardDescription className="text-white/60">
                          {section.description}
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {section.articles.map((article, index) => (
                            <div
                              key={index}
                              className="flex items-center justify-between p-3 bg-white/10 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
                            >
                              <div className="flex items-center gap-3">
                                <FileText className="w-4 h-4 text-white/60" />
                                <div>
                                  <h4 className="font-medium text-white text-sm">
                                    {article.title}
                                  </h4>
                                  <p className="text-xs text-white/60">{article.views} views</p>
                                </div>
                              </div>
                              <Badge className={getTypeColor(article.type)}>{article.type}</Badge>
                            </div>
                          ))}
                        </div>

                        <Button variant="outline" className="w-full mt-4">
                          View All Articles
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            <TabsContent value="popular">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-ts-orange" />
                    Most Popular Articles
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    The most viewed and helpful articles this month
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {popularArticles.map((article, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-white/10 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="text-2xl font-bold text-ts-orange w-8">{index + 1}</div>
                          <div>
                            <h3 className="font-semibold text-white mb-1">{article.title}</h3>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="border-white/15 text-white/60">
                                {article.category}
                              </Badge>
                              <span className="text-white/60 text-sm">{article.views} views</span>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className={getTypeColor(article.type)}>{article.type}</Badge>
                          <Button size="sm" variant="outline">
                            <ExternalLink className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="videos">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-ts-orange" />
                    Video Tutorials
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Step-by-step video guides for platform features
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {videoTutorials.map((video, index) => (
                      <div key={index} className="bg-white/10 rounded-lg overflow-hidden">
                        <div className={`h-40 ${video.thumbnail} flex items-center justify-center`}>
                          <div
                            className="w-16 h-16 rounded-full flex items-center justify-center backdrop-blur-sm"
                            style={{ backgroundColor: "var(--surface-frame)" }}
                          >
                            <Video className="w-8 h-8 text-white" />
                          </div>
                        </div>
                        <div className="p-4">
                          <h3 className="font-semibold text-white mb-2">{video.title}</h3>
                          <div className="flex items-center justify-between text-sm text-white/60">
                            <span>{video.duration}</span>
                            <span>{video.views} views</span>
                          </div>
                          <Button
                            size="sm"
                            className="w-full mt-3 bg-ts-orange-dark hover:bg-ts-orange-dark"
                          >
                            Watch Tutorial
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="downloads">
              <Card className="bg-white/5 border-white/10">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Download className="w-5 h-5 text-ts-orange" />
                    Downloadable Resources
                  </CardTitle>
                  <CardDescription className="text-white/60">
                    Templates, guides, and tools to help grow your business
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <div className="p-4 bg-white/10 rounded-lg">
                      <div className="w-12 h-12 bg-blue-600/20 rounded-lg flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-blue-400" />
                      </div>
                      <h3 className="font-semibold text-white mb-2">Quote Templates</h3>
                      <p className="text-white/60 text-sm mb-4">
                        Professional quote templates for different trade types
                      </p>
                      <Button size="sm" variant="outline" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>

                    <div className="p-4 bg-white/10 rounded-lg">
                      <div className="w-12 h-12 bg-emerald-600/20 rounded-lg flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-emerald-400" />
                      </div>
                      <h3 className="font-semibold text-white mb-2">Business Checklist</h3>
                      <p className="text-white/60 text-sm mb-4">
                        Complete checklist for setting up your business profile
                      </p>
                      <Button size="sm" variant="outline" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>

                    <div className="p-4 bg-white/10 rounded-lg">
                      <div className="w-12 h-12 bg-purple-600/20 rounded-lg flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-purple-400" />
                      </div>
                      <h3 className="font-semibold text-white mb-2">Marketing Guide</h3>
                      <p className="text-white/60 text-sm mb-4">
                        Comprehensive guide to marketing your services
                      </p>
                      <Button size="sm" variant="outline" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>

                    <div className="p-4 bg-white/10 rounded-lg">
                      <div className="w-12 h-12 bg-ts-orange-dark/20 rounded-lg flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-ts-orange" />
                      </div>
                      <h3 className="font-semibold text-white mb-2">Pricing Worksheet</h3>
                      <p className="text-white/60 text-sm mb-4">
                        Excel template for calculating project costs
                      </p>
                      <Button size="sm" variant="outline" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Download XLSX
                      </Button>
                    </div>

                    <div className="p-4 bg-white/10 rounded-lg">
                      <div className="w-12 h-12 bg-red-600/20 rounded-lg flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-red-400" />
                      </div>
                      <h3 className="font-semibold text-white mb-2">Contract Templates</h3>
                      <p className="text-white/60 text-sm mb-4">
                        Legal contract templates for different project types
                      </p>
                      <Button size="sm" variant="outline" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>

                    <div className="p-4 bg-white/10 rounded-lg">
                      <div className="w-12 h-12 bg-cyan-600/20 rounded-lg flex items-center justify-center mb-4">
                        <FileText className="w-6 h-6 text-cyan-400" />
                      </div>
                      <h3 className="font-semibold text-white mb-2">Mobile App Guide</h3>
                      <p className="text-white/60 text-sm mb-4">
                        Complete guide to using the TradeScout mobile app
                      </p>
                      <Button size="sm" variant="outline" className="w-full">
                        <Download className="w-4 h-4 mr-2" />
                        Download PDF
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>

          {/* Help Section */}
          <Card className="bg-white/5 border-white/10 mt-8">
            <CardContent className="p-6 text-center">
              <h3 className="text-xl font-semibold text-white mb-2">Need More Help?</h3>
              <p className="text-white/60 mb-4">
                If an article does not unblock you, route the issue through Scout with your exact
                goal and blocker.
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button variant="outline">Add request details</Button>
                <Button className="bg-ts-orange-dark hover:bg-ts-orange-dark">
                  Open Support Ticket
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </HelpArticleWrapper>
  );
});

export default Documentation;
