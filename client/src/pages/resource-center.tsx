import { memo, useState } from "react";
import { BookOpen, Video, Download, FileText, Search, Play, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
      title: "Electrical Safety Decisions in Live Jobs",
      type: "guide",
      category: "safety",
      description:
        "Decision-focused checklist for residential electrical work before contact, quote, and execution.",
      author: "TradeScout Safety Team",
      duration: "45 min read",
      level: "Beginner",
      tags: ["electrical", "safety", "residential"],
      thumbnail: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=300&h=200&fit=crop",
      featured: true,
      lastUpdated: "2024-03-15",
    },
    {
      id: 2,
      title: "Plumbing Failure Diagnostics Masterclass",
      type: "video",
      category: "education",
      description:
        "Scenario-based video series for diagnosing failures and planning corrective action.",
      author: "TradeScout Field Review",
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
      title: "Licensing and Insurance Requirements by State",
      type: "document",
      category: "business",
      description: "Simple reference map for license and insurance requirements by state.",
      author: "TradeScout Legal Team",
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
      title: "Client Communication Under Decision Pressure",
      type: "guide",
      category: "business",
      description: "Simple message patterns that keep projects moving.",
      author: "TradeScout Operations Team",
      duration: "30 min read",
      level: "Intermediate",
      tags: ["communication", "customer service", "business"],
      thumbnail: "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=300&h=200&fit=crop",
      featured: false,
      lastUpdated: "2024-03-08",
    },
    {
      id: 5,
      title: "OSHA Safety Standards Field Workshop",
      type: "video",
      category: "safety",
      description: "Field workshop covering OSHA safety standards for construction workers",
      author: "TradeScout Safety Review",
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
      title: "Project Estimation and Scope Template Pack",
      type: "template",
      category: "business",
      description: "Reference templates for clearer project estimates and scope decisions",
      author: "TradeScout Tools Team",
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

  const query = searchQuery.trim().toLowerCase();
  const filteredResources = resources.filter((resource) => {
    const matchesQuery =
      !query ||
      resource.title.toLowerCase().includes(query) ||
      resource.description.toLowerCase().includes(query) ||
      resource.tags.some((tag) => tag.toLowerCase().includes(query));
    const matchesCategory = category === "all" || resource.category === category;
    const matchesType = resourceType === "all" || resource.type === resourceType;
    return matchesQuery && matchesCategory && matchesType;
  });

  return (
    <>
      <SEOHelmet
        title="Resource Center | Trade Guides, Templates, and Videos"
        description="Explore TradeScout's resource center for guides, templates, and videos that help you plan and complete local projects."
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
          subtitle="Simple guides, templates, and videos to help you complete local projects"
        >
          {/* Search and Filters */}
          <Card className="bg-card border-border mb-8">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
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
              </div>

              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {filteredResources.length} resources matched
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Featured Resources */}
          <Card className="bg-card border-border mb-8">
            <CardHeader>
              <CardTitle className="text-foreground">Priority References</CardTitle>
              <p className="text-muted-foreground">
                Decision support materials selected for safety, clarity, and local work planning
              </p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredResources
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
                        </div>

                        <div className="flex justify-between items-center text-sm text-muted-foreground mb-3">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {resource.duration}
                          </span>
                          <span>
                            Reviewed {new Date(resource.lastUpdated).toLocaleDateString()}
                          </span>
                        </div>

                        <div className="rounded-md border border-border bg-background px-3 py-2 text-center text-sm text-muted-foreground">
                          Reference summary
                        </div>
                      </div>
                    </div>
                  ))}
                {filteredResources.filter((resource) => resource.featured).length === 0 ? (
                  <div className="rounded-lg border border-border bg-muted p-6 text-sm text-muted-foreground md:col-span-3">
                    No priority references match the current filters.
                  </div>
                ) : null}
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
                {filteredResources.map((resource) => (
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
                      </div>

                      <div className="flex justify-between items-center text-sm text-muted-foreground mb-4">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {resource.duration}
                        </span>
                      </div>

                      <div className="mb-4">
                        <p className="text-muted-foreground text-xs mb-2">By {resource.author}</p>
                        <p className="text-muted-foreground text-xs">
                          Updated {new Date(resource.lastUpdated).toLocaleDateString()}
                        </p>
                      </div>

                      <div className="rounded-md border border-border bg-background px-3 py-2 text-center text-sm text-muted-foreground">
                        Reference summary
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredResources.length === 0 ? (
                  <Card className="bg-card border-border md:col-span-2 lg:col-span-3">
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      No resources match the current filters.
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </TabsContent>

            <TabsContent value="list">
              <div className="space-y-4">
                {filteredResources.map((resource) => (
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

                          <p className="text-muted-foreground text-sm mb-3">
                            {resource.description}
                          </p>

                          <div className="flex items-center gap-4 mb-3">
                            <Badge className={getLevelColor(resource.level)}>
                              {resource.level}
                            </Badge>
                            <span className="text-muted-foreground text-sm">
                              {resource.duration}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <div>
                              <p className="text-muted-foreground text-sm">By {resource.author}</p>
                              <p className="text-muted-foreground text-xs">
                                Updated {new Date(resource.lastUpdated).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="rounded-md border border-border bg-background px-3 py-2 text-sm text-muted-foreground">
                              Reference summary
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {filteredResources.length === 0 ? (
                  <Card className="bg-card border-border">
                    <CardContent className="p-6 text-sm text-muted-foreground">
                      No resources match the current filters.
                    </CardContent>
                  </Card>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
        </Section>
      </Page>
    </>
  );
});

export default ResourceCenter;
