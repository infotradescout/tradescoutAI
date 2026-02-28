import { memo, useState } from "react";
import {
  Network,
  Shield,
  Zap,
  Target,
  Compass,
  Users2,
  Briefcase,
  TrendingUp,
  Copy,
  Check,
  ExternalLink,
  BarChart2,
  UserPlus,
  Crown,
  QrCode,
  Link2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

const SocialIntegration = memo(function SocialIntegration() {
  const [copyStatus, setCopyStatus] = useState<string>("");
  const { toast } = useToast();

  const socialPlatforms = [
    {
      name: "Facebook",
      icon: Shield,
      connected: true,
      followers: 2847,
      engagement: "4.2%",
      lastPost: "2 hours ago",
      color: "bg-blue-600",
    },
    {
      name: "Instagram",
      icon: Target,
      connected: true,
      followers: 1523,
      engagement: "6.8%",
      lastPost: "6 hours ago",
      color: "bg-pink-600",
    },
    {
      name: "Twitter",
      icon: Zap,
      connected: false,
      followers: 0,
      engagement: "0%",
      lastPost: "Never",
      color: "bg-blue-500",
    },
    {
      name: "LinkedIn",
      icon: Briefcase,
      connected: true,
      followers: 892,
      engagement: "3.1%",
      lastPost: "1 day ago",
      color: "bg-blue-700",
    },
    {
      name: "YouTube",
      icon: TrendingUp,
      connected: false,
      followers: 0,
      engagement: "0%",
      lastPost: "Never",
      color: "bg-red-600",
    },
  ];

  const sharingTemplates = [
    {
      id: 1,
      name: "Project Showcase",
      template:
        "Just completed an amazing {projectType} project in {location}! Check out the transformation on TradeScout: {link}",
      category: "Project",
    },
    {
      id: 2,
      name: "Service Promotion",
      template:
        "Need {serviceType} in {location}? I'm offering a special promotion this month! Book through TradeScout: {link}",
      category: "Promotion",
    },
    {
      id: 3,
      name: "Customer Recommendation",
      template:
        'Thrilled to receive another recommendation! "{reviewText}" - {customerName}. See more on TradeScout: {link}',
      category: "Recommendation",
    },
    {
      id: 4,
      name: "Community Event",
      template:
        "Join us for {eventName} in {location} on {date}! Great opportunity to connect with local contractors and homeowners: {link}",
      category: "Event",
    },
  ];

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyStatus(label);
      toast({
        title: "Copied!",
        description: `${label} copied to clipboard`,
      });
      setTimeout(() => setCopyStatus(""), 2000);
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="h-full gradient-bg text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Network className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Social Media Integration</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Connect your social accounts and manage your online presence
          </p>
        </div>

        <Tabs defaultValue="accounts" className="w-full">
          <TabsList className="grid w-full grid-cols-4 bg-tsCard/50 backdrop-blur-sm">
            <TabsTrigger value="accounts" className="data-[state=active]:bg-ts-orange-dark">
              Connected Accounts
            </TabsTrigger>
            <TabsTrigger value="sharing" className="data-[state=active]:bg-ts-orange-dark">
              Auto-Sharing
            </TabsTrigger>
            <TabsTrigger value="templates" className="data-[state=active]:bg-ts-orange-dark">
              Post Templates
            </TabsTrigger>
            <TabsTrigger value="analytics" className="data-[state=active]:bg-ts-orange-dark">
              Social Analytics
            </TabsTrigger>
          </TabsList>

          <TabsContent value="accounts" className="mt-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {socialPlatforms.map((platform) => {
                const IconComponent = platform.icon;
                return (
                  <Card
                    key={platform.name}
                    className="bg-tsCard/50 border-white/10 backdrop-blur-sm"
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-3 rounded-lg ${platform.color}`}>
                            <IconComponent className="h-6 w-6 text-white" />
                          </div>
                          <div>
                            <CardTitle className="text-white">{platform.name}</CardTitle>
                            <Badge
                              className={
                                platform.connected
                                  ? "bg-green-600 hover:bg-green-700"
                                  : "bg-white/10 hover:bg-white/10"
                              }
                            >
                              {platform.connected ? "Connected" : "Not Connected"}
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent>
                      {platform.connected ? (
                        <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <p className="text-white/60">Followers</p>
                              <p className="text-white font-semibold">
                                {platform.followers.toLocaleString()}
                              </p>
                            </div>
                            <div>
                              <p className="text-white/60">Engagement</p>
                              <p className="text-white font-semibold">{platform.engagement}</p>
                            </div>
                          </div>

                          <div>
                            <p className="text-white/60 text-sm">Last Post</p>
                            <p className="text-white text-sm">{platform.lastPost}</p>
                          </div>

                          <div className="flex gap-2">
                            <Button className="flex-1 bg-ts-orange-dark hover:bg-ts-orange-dark">
                              Manage
                            </Button>
                            <Button
                              variant="outline"
                              className="border-red-600 text-red-400 hover:bg-red-600/20"
                            >
                              Disconnect
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <p className="text-white/60 text-sm">
                            Connect your {platform.name} account to automatically share your
                            TradeScout content
                          </p>
                          <Button className="w-full bg-ts-orange-dark hover:bg-ts-orange-dark">
                            Connect {platform.name}
                          </Button>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="sharing" className="mt-6">
            <div className="space-y-6">
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Auto-Sharing Settings</CardTitle>
                  <p className="text-white/60">
                    Automatically share your TradeScout activity to social media
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {[
                      {
                        label: "New project completions",
                        description: "Share when you mark a project as completed",
                        enabled: true,
                      },
                      {
                        label: "Customer RECOMMENDATIONS",
                        description: "Share verified customer recommendations (no star ratings)",
                        enabled: true,
                      },
                      {
                        label: "Service promotions",
                        description: "Share your daily deal promotions",
                        enabled: false,
                      },
                      {
                        label: "Community posts",
                        description: "Share your community forum posts",
                        enabled: false,
                      },
                      {
                        label: "Achievement badges",
                        description: "Share when you earn new badges or certifications",
                        enabled: true,
                      },
                      {
                        label: "Referral milestones",
                        description: "Share referral program achievements",
                        enabled: false,
                      },
                    ].map((setting, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between p-4 bg-tsCard/50 rounded-lg"
                      >
                        <div>
                          <h4 className="text-white font-medium">{setting.label}</h4>
                          <p className="text-white/60 text-sm">{setting.description}</p>
                        </div>
                        <Switch checked={setting.enabled} />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Platform-Specific Settings</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {socialPlatforms
                      .filter((p) => p.connected)
                      .map((platform) => {
                        const IconComponent = platform.icon;
                        return (
                          <div
                            key={platform.name}
                            className="flex items-center justify-between p-4 bg-tsCard/50 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded ${platform.color}`}>
                                <IconComponent className="h-4 w-4 text-white" />
                              </div>
                              <span className="text-white">{platform.name}</span>
                            </div>
                            <div className="flex items-center gap-4">
                              <label className="text-white/60 text-sm">Auto-post:</label>
                              <Switch />
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="templates" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Post Templates</CardTitle>
                  <p className="text-white/60">
                    Pre-written templates for easy social media posting
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {sharingTemplates.map((template) => (
                      <div key={template.id} className="p-4 bg-tsCard/50 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <h4 className="text-white font-medium">{template.name}</h4>
                          <Badge variant="outline">{template.category}</Badge>
                        </div>
                        <p className="text-white/70 text-sm mb-3">{template.template}</p>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20"
                            onClick={() => copyToClipboard(template.template, template.name)}
                          >
                            {copyStatus === template.name ? (
                              <Check className="h-3 w-3" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            Copy
                          </Button>
                          <Button size="sm" className="bg-ts-orange-dark hover:bg-ts-orange-dark">
                            Edit
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button className="w-full mt-4 bg-blue-600 hover:bg-blue-700">
                    Create New Template
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Quick Share Tools</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-white font-medium mb-3">Profile Links</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value="https://tradescout.com/contractor/mike-construction-llc"
                            readOnly
                            className="bg-tsCard border-white/10 text-white"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(
                                "https://tradescout.com/contractor/mike-construction-llc",
                                "Profile Link"
                              )
                            }
                          >
                            {copyStatus === "Profile Link" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <div className="flex gap-2">
                          <Button className="flex-1 bg-blue-600 hover:bg-blue-700">
                            <QrCode className="h-4 w-4 mr-2" />
                            Generate QR Code
                          </Button>
                          <Button className="flex-1 bg-green-600 hover:bg-green-700">
                            <Link2 className="h-4 w-4 mr-2" />
                            Short Link
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-3">Referral Links</h4>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <Input
                            value="https://tradescout.com/join?ref=MIKE2024"
                            readOnly
                            className="bg-tsCard border-white/10 text-white"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                              copyToClipboard(
                                "https://tradescout.com/join?ref=MIKE2024",
                                "Referral Link"
                              )
                            }
                          >
                            {copyStatus === "Referral Link" ? (
                              <Check className="h-4 w-4" />
                            ) : (
                              <Copy className="h-4 w-4" />
                            )}
                          </Button>
                        </div>

                        <p className="text-white/60 text-xs">
                          Earn 10% commission on every new user who signs up with your link
                        </p>
                      </div>
                    </div>

                    <div>
                      <h4 className="text-white font-medium mb-3">Business Card Integration</h4>
                      <div className="bg-tsCard/50 rounded-lg p-4">
                        <div className="flex items-center gap-3 mb-3">
                          <Crown className="h-5 w-5 text-ts-orange" />
                          <span className="text-white font-medium">Digital Business Card</span>
                        </div>
                        <p className="text-white/60 text-sm mb-3">
                          Share your TradeScout profile as a digital business card
                        </p>
                        <Button className="w-full bg-ts-orange-dark hover:bg-ts-orange-dark">
                          Create Digital Card
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="mt-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Social Media Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {socialPlatforms
                      .filter((p) => p.connected)
                      .map((platform) => {
                        const IconComponent = platform.icon;
                        return (
                          <div key={platform.name} className="p-4 bg-tsCard/50 rounded-lg">
                            <div className="flex items-center gap-3 mb-4">
                              <div className={`p-2 rounded ${platform.color}`}>
                                <IconComponent className="h-4 w-4 text-white" />
                              </div>
                              <h4 className="text-white font-medium">{platform.name}</h4>
                            </div>

                            <div className="grid grid-cols-3 gap-4 text-center">
                              <div>
                                <div className="text-xl font-bold text-white">
                                  {platform.followers}
                                </div>
                                <div className="text-white/60 text-xs">Followers</div>
                              </div>
                              <div>
                                <div className="text-xl font-bold text-ts-orange">
                                  {platform.engagement}
                                </div>
                                <div className="text-white/60 text-xs">Engagement</div>
                              </div>
                              <div>
                                <div className="text-xl font-bold text-green-400">+127</div>
                                <div className="text-white/60 text-xs">This Month</div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Referral Traffic</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-tsCard/50 rounded-lg">
                      <div className="text-3xl font-bold text-ts-orange mb-2">1,247</div>
                      <div className="text-white/60">Total Social Visits</div>
                      <div className="text-green-400 text-sm">+23% this month</div>
                    </div>

                    <div className="space-y-3">
                      {[
                        { source: "Facebook", visits: 543, conversion: "12%" },
                        { source: "Instagram", visits: 398, conversion: "18%" },
                        { source: "LinkedIn", visits: 306, conversion: "8%" },
                      ].map((source) => (
                        <div
                          key={source.source}
                          className="flex justify-between items-center p-3 bg-tsCard/50 rounded-lg"
                        >
                          <span className="text-white">{source.source}</span>
                          <div className="text-right">
                            <div className="text-white font-medium">{source.visits} visits</div>
                            <div className="text-green-400 text-sm">
                              {source.conversion} conversion
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default SocialIntegration;
