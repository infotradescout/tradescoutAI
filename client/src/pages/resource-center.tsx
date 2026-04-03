import { memo, useState } from "react";
import {
  BookOpen,
  Video,
  Download,
  FileText,
  Users,
  Star,
  Search,
  Filter,
  Play,
  Eye,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Page, Section } from "@/components/layout/PagePrimitives";

const ResourceCenter = memo(function ResourceCenter() {
  const [searchQuery, setSearchQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [resourceType, setResourceType] = useState("all");

  const resources = [
    {
      id: 1,
      title: "Complete Guide to Home Electrical Safety",
      type: "guide",
      category: "safety",
      description: "Comprehensive safety guide for electrical work in residential properties",
      author: "TradeScout Safety Team",
      rating: 4.9,
      views: 15420,
      downloads: 3240,
      duration: "45 min read",
      level: "Beginner",
      tags: ["electrical", "safety", "residential"],
      thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop",
      featured: true,
      lastUpdated: "2024-03-15",
    },
    {
      id: 2,
      title: "Advanced Plumbing Techniques Masterclass",
      type: "video",
      category: "education",
      description:
        "Professional video series covering advanced plumbing installation and repair techniques",
      author: "Master Plumber Mike Johnson",
      rating: 4.8,
      views: 8760,
      downloads: 0,
      duration: "2h 30min",
      level: "Advanced",
      tags: ["plumbing", "techniques", "masterclass"],
      thumbnail:
        "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=300&h=200&fit=crop",
      featured: true,
      lastUpdated: "2024-03-12",
    },
    {
      id: 3,
      title: "Business License Requirements by State",
      type: "document",
      category: "business",
      description: "Detailed breakdown of contractor licensing requirements across all 50 states",
      author: "TradeScout Legal Team",
      rating: 4.7,
      views: 12350,
      downloads: 5670,
      duration: "Reference",
      level: "All Levels",
      tags: ["licensing", "business", "legal"],
      thumbnail:
        "https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=300&h=200&fit=crop",
      featured: false,
      lastUpdated: "2024-03-10",
    },
    {
      id: 4,
      title: "Customer Communication Best Practices",
      type: "guide",
      category: "business",
      description:
        "How to effectively communicate with homeowners throughout the project lifecycle",
      author: "Business Development Team",
      rating: 4.6,
      views: 9870,
      downloads: 2890,
      duration: "30 min read",
      level: "Intermediate",
      tags: ["communication", "customer service", "business"],
      thumbnail: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop",
      featured: false,
      lastUpdated: "2024-03-08",
    },
    {
      id: 5,
      title: "OSHA Safety Standards Workshop",
      type: "video",
      category: "safety",
      description: "Interactive workshop covering OSHA safety standards for construction workers",
      author: "OSHA Certified Instructors",
      rating: 4.9,
      views: 6540,
      downloads: 0,
      duration: "1h 45min",
      level: "All Levels",
      tags: ["OSHA", "safety", "construction"],
      thumbnail:
        "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=300&h=200&fit=crop",
      featured: true,
      lastUpdated: "2024-03-05",
    },
    {
      id: 6,
      title: "Project Estimation Template Pack",
      type: "template",
      category: "business",
      description: "Professional templates for creating accurate project estimates and quotes",
      author: "TradeScout Tools Team",
      rating: 4.5,
      views: 11230,
      downloads: 7890,
      duration: "Template Pack",
      level: "All Levels",
      tags: ["estimation", "templates", "pricing"],
      thumbnail: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=300&h=200&fit=crop",
      featured: false,
      lastUpdated: "2024-03-01",
    },
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "video":
        return <Video className="h-4 w-4" />;
      case "document":
        return <FileText className="h-4 w-4" />;
      case "template":
        return <Download className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case "Beginner":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "Intermediate":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "Advanced":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    }
  };

  return (
    <>
      <SEOHelmet
        title="Resource Center | Trade Guides, Templates, and Playbooks"
        description="Explore TradeScout's resource center for guides, templates, videos, and practical playbooks to improve local project execution."
        canonical="https://www.thetradescout.com/resource-center"
      />
      <Page>
      <Section
        title={
          <span className="flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Resource Center
          </span>
        }
        subtitle="Educational materials, guides, and tools to advance your trade skills"
      >

        {/* Search and Filters */}
        <Card className="bg-card border-border mb-8">
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search resources..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background border-input text-foreground"
                />
              </div>

              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="bg-background border-input text-foreground">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Categories</SelectItem>
                  <SelectItem value="safety">Safety</SelectItem>
                  <SelectItem value="education">Education</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                  <SelectItem value="technical">Technical</SelectItem>
                </SelectContent>
              </Select>

              <Select value={resourceType} onValueChange={setResourceType}>
                <SelectTrigger className="bg-background border-input text-foreground">
                  <SelectValue placeholder="Resource Type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="guide">Guides</SelectItem>
                  <SelectItem value="video">Videos</SelectItem>
                  <SelectItem value="document">Documents</SelectItem>
                  <SelectItem value="template">Templates</SelectItem>
                </SelectContent>
              </Select>

              <Button className="bg-primary hover:bg-primary/90 flex items-center gap-2">
                <Filter className="h-4 w-4" />
                Advanced Filters
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm">
                {resources.length} resources found
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Featured Resources */}
        <Card className="bg-card border-border mb-8">
          <CardHeader>
            <CardTitle className="text-foreground">Featured Resources</CardTitle>
            <p className="text-muted-foreground">
              Essential learning materials for trade professionals
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {resources
                .filter((resource) => resource.featured)
                .map((resource) => (
                  <div
                    key={resource.id}
                    className="bg-muted rounded-lg overflow-hidden hover:bg-muted/80 transition-colors"
                  >
                    <div className="relative">
                      <img
                        src={resource.thumbnail}
                        alt={resource.title}
                        className="w-full h-48 object-cover"
                      />
                      <div className="absolute top-4 left-4">
                        <Badge className="bg-primary hover:bg-primary/90 flex items-center gap-1">
                          {getTypeIcon(resource.type)}
                          {resource.type}
                        </Badge>
                      </div>
                      {resource.type === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <div className="bg-black/50 rounded-full p-3">
                            <Play className="h-8 w-8 text-white" />
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="p-4">
                      <h3 className="text-foreground font-semibold mb-2 line-clamp-2">
                        {resource.title}
                      </h3>
                      <p className="text-muted-foreground text-sm mb-3 line-clamp-2">
                        {resource.description}
                      </p>

                      <div className="flex items-center gap-2 mb-3">
                        <Badge className={getLevelColor(resource.level)}>{resource.level}</Badge>
                        <div className="flex items-center gap-1 text-yellow-600 text-sm">
                          <Star className="h-3 w-3 fill-current" />
                          {resource.rating}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
                        <span>{resource.duration}</span>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {resource.views.toLocaleString()}
                          </span>
                          {resource.downloads > 0 && (
                            <span className="flex items-center gap-1">
                              <Download className="h-3 w-3" />
                              {resource.downloads.toLocaleString()}
                            </span>
                          )}
                        </div>
                      </div>

                      <Button className="w-full bg-primary hover:bg-primary/90">
                        {resource.type === "video" ? "Watch Now" : "Access Resource"}
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>

        {/* All Resources */}
        <Tabs defaultValue="grid" className="w-full">
          <div className="flex justify-between items-center mb-6">
            <TabsList className="grid w-48 grid-cols-2 bg-muted">
              <TabsTrigger value="grid" className="data-[state=active]:bg-background">
                Grid
              </TabsTrigger>
              <TabsTrigger value="list" className="data-[state=active]:bg-background">
                List
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="grid">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {resources.map((resource) => (
                <Card
                  key={resource.id}
                  className="bg-card border-border hover:bg-muted/50 transition-colors"
                >
                  <div className="relative">
                    <img
                      src={resource.thumbnail}
                      alt={resource.title}
                      className="w-full h-48 object-cover rounded-t-lg"
                    />
                    <div className="absolute top-4 left-4">
                      <Badge className="bg-secondary text-secondary-foreground flex items-center gap-1">
                        {getTypeIcon(resource.type)}
                        {resource.type}
                      </Badge>
                    </div>
                    {resource.type === "video" && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="bg-black/50 rounded-full p-3">
                          <Play className="h-8 w-8 text-white" />
                        </div>
                      </div>
                    )}
                  </div>

                  <CardContent className="p-6">
                    <h3 className="text-foreground font-semibold text-lg mb-2 line-clamp-2">
                      {resource.title}
                    </h3>
                    <p className="text-muted-foreground text-sm mb-4 line-clamp-3">
                      {resource.description}
                    </p>

                    <div className="flex items-center gap-2 mb-4">
                      <Badge className={getLevelColor(resource.level)}>{resource.level}</Badge>
                      <div className="flex items-center gap-1 text-yellow-600 text-sm">
                        <Star className="h-3 w-3 fill-current" />
                        {resource.rating}
                      </div>
                    </div>

                    <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {resource.duration}
                      </span>
                      <span className="flex items-center gap-1">
                        <Eye className="h-3 w-3" />
                        {resource.views.toLocaleString()}
                      </span>
                    </div>

                    <div className="mb-4">
                      <p className="text-muted-foreground text-xs mb-2">By {resource.author}</p>
                      <p className="text-muted-foreground text-xs">
                        Updated {new Date(resource.lastUpdated).toLocaleDateString()}
                      </p>
                    </div>

                    <Button className="w-full bg-primary hover:bg-primary/90">
                      {resource.type === "video" ? "Watch Now" : "Access Resource"}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="list">
            <div className="space-y-4">
              {resources.map((resource) => (
                <Card key={resource.id} className="bg-card border-border">
                  <CardContent className="p-6">
                    <div className="flex gap-6">
                      <img
                        src={resource.thumbnail}
                        alt={resource.title}
                        className="w-32 h-24 object-cover rounded-lg flex-shrink-0"
                      />

                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <h3 className="text-foreground font-semibold text-lg">
                            {resource.title}
                          </h3>
                          <Badge className="bg-secondary text-secondary-foreground flex items-center gap-1">
                            {getTypeIcon(resource.type)}
                            {resource.type}
                          </Badge>
                        </div>

                        <p className="text-muted-foreground text-sm mb-3">{resource.description}</p>

                        <div className="flex items-center gap-4 mb-3">
                          <Badge className={getLevelColor(resource.level)}>{resource.level}</Badge>
                          <div className="flex items-center gap-1 text-yellow-600 text-sm">
                            <Star className="h-3 w-3 fill-current" />
                            {resource.rating}
                          </div>
                          <span className="text-muted-foreground text-sm">{resource.duration}</span>
                          <span className="text-muted-foreground text-sm flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            {resource.views.toLocaleString()} views
                          </span>
                        </div>

                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-muted-foreground text-sm">By {resource.author}</p>
                            <p className="text-muted-foreground text-xs">
                              Updated {new Date(resource.lastUpdated).toLocaleDateString()}
                            </p>
                          </div>
                          <Button className="bg-primary hover:bg-primary/90">
                            {resource.type === "video" ? "Watch Now" : "Access Resource"}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </Section>
    </Page>
    </>
  );
});

export default ResourceCenter;
