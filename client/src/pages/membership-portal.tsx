import { memo, useState } from 'react';
import { Crown, Star, Shield, Zap, Users, CheckCircle, Clock, CreditCard } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

const MembershipPortal = memo(function MembershipPortal() {
  const [currentPlan, setCurrentPlan] = useState("premium");

  const membershipTiers = [
    {
      name: "Basic",
      price: "Free",
      period: "",
      features: [
        "Basic profile listing",
        "Standard search visibility",
        "Basic messaging",
        "Community forum access",
        "Standard customer support"
      ],
      limitations: [
        "Limited to 3 project quotes per month",
        "Basic analytics only",
        "No priority support"
      ],
      popular: false
    },
    {
      name: "Premium",
      price: "$29",
      period: "/month",
      features: [
        "Enhanced profile with portfolio",
        "Priority search placement",
        "Unlimited messaging",
        "Advanced analytics dashboard",
        "Priority customer support",
        "Lead notification alerts",
        "Customer review management",
        "Social media integration"
      ],
      limitations: [],
      popular: true
    },
    {
      name: "Professional",
      price: "$79",
      period: "/month",
      features: [
        "All Premium features",
        "Featured contractor badge",
        "Top search rankings",
        "CRM integration",
        "Advanced lead analytics",
        "White-label proposals",
        "Dedicated account manager",
        "Marketing consultation",
        "Multi-area visibility",
        "API access"
      ],
      limitations: [],
      popular: false
    },
    {
      name: "Enterprise",
      price: "Custom",
      period: "",
      features: [
        "All Professional features",
        "Custom integrations",
        "Bulk user management",
        "Advanced reporting",
        "Custom branding",
        "Priority technical support",
        "Training and onboarding",
        "SLA guarantees"
      ],
      limitations: [],
      popular: false
    }
  ];

  const currentMembershipData = {
    plan: "Premium",
    status: "Active",
    nextBilling: "2024-04-15",
    usage: {
      quotes: { used: 47, limit: "Unlimited" },
      leads: { used: 23, limit: "Unlimited" },
      profiles: { used: 1, limit: 1 }
    },
    benefits: [
      { name: "Priority Support", status: "active" },
      { name: "Advanced Analytics", status: "active" },
      { name: "Lead Notifications", status: "active" },
      { name: "Portfolio Showcase", status: "active" }
    ]
  };

  return (
    <div className="h-full bg-background">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <Crown className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Membership Portal</h1>
          </div>
          <p className="text-muted-foreground text-lg">
            Manage your TradeScout membership and unlock premium features
          </p>
        </div>

        <Tabs defaultValue="current" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-muted mb-8">
            <TabsTrigger value="current" className="data-[state=active]:bg-background">Current Plan</TabsTrigger>
            <TabsTrigger value="plans" className="data-[state=active]:bg-background">All Plans</TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-background">Billing</TabsTrigger>
          </TabsList>

          <TabsContent value="current">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Current Plan Overview */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Star className="h-5 w-5 text-primary" />
                    Current Membership
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div className="flex justify-between items-center">
                      <div>
                        <h3 className="text-2xl font-bold text-foreground">{currentMembershipData.plan}</h3>
                        <p className="text-muted-foreground">Active since January 2024</p>
                      </div>
                      <Badge className="bg-green-600 hover:bg-green-700">
                        {currentMembershipData.status}
                      </Badge>
                    </div>

                    <div className="bg-muted rounded-lg p-4">
                      <h4 className="text-foreground font-medium mb-3">Next Billing</h4>
                      <p className="text-primary text-lg">
                        {new Date(currentMembershipData.nextBilling).toLocaleDateString()}
                      </p>
                      <p className="text-muted-foreground text-sm">$29.00 will be charged</p>
                    </div>

                    <div>
                      <h4 className="text-foreground font-medium mb-3">Active Benefits</h4>
                      <div className="space-y-2">
                        {currentMembershipData.benefits.map((benefit, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span className="text-muted-foreground">{benefit.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button className="flex-1 bg-primary hover:bg-primary/90">
                        Upgrade Plan
                      </Button>
                      <Button variant="outline" className="flex-1 border-primary text-primary hover:bg-primary/10">
                        Manage
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Usage Statistics */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <Zap className="h-5 w-5 text-primary" />
                    Usage This Month
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Quote Requests</span>
                        <span className="text-foreground">
                          {currentMembershipData.usage.quotes.used} / {currentMembershipData.usage.quotes.limit}
                        </span>
                      </div>
                      <Progress value={75} className="h-2" />
                      <p className="text-muted-foreground text-xs mt-1">No limits on Premium plan</p>
                    </div>

                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Leads Generated</span>
                        <span className="text-foreground">
                          {currentMembershipData.usage.leads.used} / {currentMembershipData.usage.leads.limit}
                        </span>
                      </div>
                      <Progress value={60} className="h-2" />
                      <p className="text-muted-foreground text-xs mt-1">Up 15% from last month</p>
                    </div>

                    <div className="bg-muted rounded-lg p-4">
                      <h4 className="text-foreground font-medium mb-2">Member Since</h4>
                      <p className="text-primary">January 15, 2024</p>
                      <p className="text-muted-foreground text-sm">2 months, 8 days</p>
                    </div>

                    <Button className="w-full bg-blue-600 hover:bg-blue-700">
                      View Detailed Analytics
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="plans">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {membershipTiers.map((tier, index) => (
                <Card key={index} className={`bg-card border-border relative ${
                  tier.popular ? 'ring-2 ring-primary' : ''
                }`}>
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-primary hover:bg-primary/90">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <CardTitle className="text-foreground">{tier.name}</CardTitle>
                    <div className="mt-4">
                      <span className="text-4xl font-bold text-primary">{tier.price}</span>
                      <span className="text-muted-foreground">{tier.period}</span>
                    </div>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-foreground font-medium mb-2">Features Included:</h4>
                        <ul className="space-y-2">
                          {tier.features.map((feature, featureIndex) => (
                            <li key={featureIndex} className="flex items-start gap-2 text-sm">
                              <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      {tier.limitations.length > 0 && (
                        <div>
                          <h4 className="text-foreground font-medium mb-2">Limitations:</h4>
                          <ul className="space-y-2">
                            {tier.limitations.map((limitation, limIndex) => (
                              <li key={limIndex} className="flex items-start gap-2 text-sm">
                                <Clock className="h-4 w-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <span className="text-muted-foreground">{limitation}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <Button 
                        className={`w-full ${
                          tier.name === currentPlan 
                            ? 'bg-muted hover:bg-muted/80' 
                            : tier.popular 
                              ? 'bg-primary hover:bg-primary/90' 
                              : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                        disabled={tier.name === currentPlan}
                      >
                        {tier.name === currentPlan ? 'Current Plan' : `Choose ${tier.name}`}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="billing">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Payment Method */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground flex items-center gap-2">
                    <CreditCard className="h-5 w-5 text-primary" />
                    Payment Method
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="bg-muted rounded-lg p-4">
                      <div className="flex justify-between items-center mb-2">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-5 bg-blue-600 rounded flex items-center justify-center text-white text-xs font-bold">
                            VISA
                          </div>
                          <span className="text-foreground">•••• •••• •••• 4242</span>
                        </div>
                        <Badge variant="outline">Primary</Badge>
                      </div>
                      <p className="text-muted-foreground text-sm">Expires 12/2026</p>
                    </div>

                    <div className="space-y-3">
                      <Button className="w-full bg-primary hover:bg-primary/90">
                        Update Payment Method
                      </Button>
                      <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
                        Add New Card
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Billing History */}
              <Card className="bg-card border-border">
                <CardHeader>
                  <CardTitle className="text-foreground">Billing History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { date: "2024-03-15", amount: "$29.00", status: "Paid", plan: "Premium" },
                      { date: "2024-02-15", amount: "$29.00", status: "Paid", plan: "Premium" },
                      { date: "2024-01-15", amount: "$29.00", status: "Paid", plan: "Premium" },
                    ].map((invoice, index) => (
                      <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-foreground font-medium">{invoice.plan} Plan</p>
                          <p className="text-muted-foreground text-sm">{new Date(invoice.date).toLocaleDateString()}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-foreground">{invoice.amount}</p>
                          <Badge className="bg-green-600 hover:bg-green-700 text-xs">
                            {invoice.status}
                          </Badge>
                        </div>
                      </div>
                    ))}

                    <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10">
                      View All Invoices
                    </Button>
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

export default MembershipPortal;