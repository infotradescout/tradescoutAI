import { memo } from 'react';
import { Users, Target, Activity, TrendingUp, Calendar, Phone, Mail, DollarSign } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Page, Section } from '@/components/layout/PagePrimitives';

const CRM = memo(function CRM() {
  return (
    <Page>
      <Section
        title="Customer Relationship Management"
        subtitle="Manage your contacts, deals, and business relationships"
      >

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Total Contacts</p>
                  <p className="text-2xl font-bold text-white">1,247</p>
                </div>
                <Users className="h-8 w-8 text-ts-orange" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Active Deals</p>
                  <p className="text-2xl font-bold text-white">89</p>
                </div>
                <Target className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Pipeline Value</p>
                  <p className="text-2xl font-bold text-white">$285K</p>
                </div>
                <DollarSign className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Conversion Rate</p>
                  <p className="text-2xl font-bold text-white">34%</p>
                </div>
                <TrendingUp className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Contacts & Deals */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Recent Contacts */}
          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Users className="h-5 w-5" />
                Recent Contacts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Sarah Johnson", type: "Homeowner", status: "Hot Lead", phone: "(555) 123-4567" },
                  { name: "Mike Construction Co.", type: "Contractor", status: "Active", phone: "(555) 987-6543" },
                  { name: "Jennifer Davis", type: "Realtor", status: "Follow Up", phone: "(555) 456-7890" },
                ].map((contact, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-tsCard/50 rounded-lg">
                    <div>
                      <p className="font-semibold text-white">{contact.name}</p>
                      <p className="text-sm text-white/60">{contact.type}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="secondary" className="mb-1">
                        {contact.status}
                      </Badge>
                      <p className="text-sm text-white/60">{contact.phone}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4 bg-ts-orange-dark hover:bg-ts-orange-dark">
                View All Contacts
              </Button>
            </CardContent>
          </Card>

          {/* Active Deals */}
          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                <Target className="h-5 w-5" />
                Active Deals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { title: "Kitchen Renovation", value: "$45,000", stage: "Proposal", probability: "75%" },
                  { title: "Bathroom Remodel", value: "$22,000", stage: "Negotiation", probability: "60%" },
                  { title: "Deck Construction", value: "$18,500", stage: "Qualified", probability: "40%" },
                ].map((deal, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-tsCard/50 rounded-lg">
                    <div>
                      <p className="font-semibold text-white">{deal.title}</p>
                      <p className="text-sm text-ts-orange">{deal.value}</p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="mb-1">
                        {deal.stage}
                      </Badge>
                      <p className="text-sm text-green-400">{deal.probability}</p>
                    </div>
                  </div>
                ))}
              </div>
              <Button className="w-full mt-4 bg-ts-orange-dark hover:bg-ts-orange-dark">
                View Pipeline
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Activity className="h-5 w-5" />
              Quick Actions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700">
                <Users className="h-6 w-6" />
                Add Contact
              </Button>
              <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-green-600 hover:bg-green-700">
                <Target className="h-6 w-6" />
                Create Deal
              </Button>
              <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700">
                <Calendar className="h-6 w-6" />
                Schedule Follow-up
              </Button>
              <Button className="h-24 flex flex-col items-center justify-center gap-2 bg-ts-orange-dark hover:bg-ts-orange-dark">
                <Phone className="h-6 w-6" />
                Log Call
              </Button>
            </div>
          </CardContent>
        </Card>
      </Section>
    </Page>
  );
});
export default CRM;