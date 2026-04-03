import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DollarSign,
  ShieldCheck,
  Clock,
  Users,
  ChevronRight,
  Phone,
  FileText,
  CheckCircle,
} from "lucide-react";
import { Page, Section } from "@/components/layout/PagePrimitives";

export default function ContractorDashboardSimple() {
  const stats = {
    revenue: "$85,000",
    cvs: "82",
    jobs: "12",
    inquiries: "15",
  };

  const recentInquiries = [
    {
      id: 1,
      project: "Kitchen Remodel",
      homeowner: "Sarah Johnson",
      value: "$25,000",
      status: "New",
      location: "Austin, TX",
    },
    {
      id: 2,
      project: "Bathroom Renovation",
      homeowner: "Mike Chen",
      value: "$8,500",
      status: "Quoted",
      location: "Austin, TX",
    },
    {
      id: 3,
      project: "Deck Installation",
      homeowner: "Lisa Rodriguez",
      value: "$12,000",
      status: "Won",
      location: "Round Rock, TX",
    },
  ];

  return (
    <Page>
      <Section
        title="Contractor Dashboard"
        subtitle="Manage your business, track performance, and grow revenue"
      >

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Total Revenue</p>
                  <p className="text-3xl font-bold text-white">{stats.revenue}</p>
                </div>
                <DollarSign className="h-8 w-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Trust (CVS)</p>
                  <p className="text-3xl font-bold text-white">{stats.cvs}</p>
                </div>
                <ShieldCheck className="h-8 w-8 text-ts-orange" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Completed Jobs</p>
                  <p className="text-3xl font-bold text-white">{stats.jobs}</p>
                </div>
                <CheckCircle className="h-8 w-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/60 text-sm">Total Inquiries</p>
                  <p className="text-3xl font-bold text-white">{stats.inquiries}</p>
                </div>
                <Users className="h-8 w-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Recent Inquiries */}
        <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center justify-between">
              <span>Recent Project Inquiries</span>
              <Button
                variant="outline"
                className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20"
              >
                View All
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentInquiries.map((inquiry) => (
                <div
                  key={inquiry.id}
                  className="flex items-center justify-between p-4 bg-tsCard rounded-lg"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-ts-orange-dark/20 rounded-lg flex items-center justify-center">
                      <FileText className="h-6 w-6 text-ts-orange" />
                    </div>
                    <div>
                      <h3 className="text-white font-semibold">{inquiry.project}</h3>
                      <div className="flex items-center gap-2 text-sm text-white/60">
                        <span>{inquiry.homeowner}</span>
                        <span>•</span>
                        <span>{inquiry.location}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-white font-bold">{inquiry.value}</p>
                      <Badge
                        className={
                          inquiry.status === "New"
                            ? "bg-ts-orange-dark"
                            : inquiry.status === "Quoted"
                              ? "bg-yellow-600"
                              : "bg-green-600"
                        }
                      >
                        {inquiry.status}
                      </Badge>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20"
                      onClick={() => (window.location.pathname = "/chat")}
                    >
                      <Phone className="h-4 w-4 mr-2" />
                      Contact
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card
            className="bg-tsCard/50 border-white/10 backdrop-blur-sm cursor-pointer hover:border-ts-orange/30 transition-colors"
            data-tutorial="connections"
          >
            <CardContent className="p-6 text-center">
              <Users className="h-12 w-12 text-ts-orange mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Manage Connections</h3>
              <p className="text-white/60 text-sm mb-4">
                Review and respond to new customer inquiries
              </p>
              <Button
                className="bg-ts-orange-dark hover:bg-ts-orange-dark w-full"
                onClick={() => (window.location.pathname = "/finances")}
              >
                View Connections
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm cursor-pointer hover:border-ts-orange/30 transition-colors">
            <CardContent className="p-6 text-center">
              <ShieldCheck className="h-12 w-12 text-ts-orange mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Customer Recommendations</h3>
              <p className="text-white/60 text-sm mb-4">
                Manage recommendations and build your reputation
              </p>
              <Button
                variant="outline"
                className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20 w-full"
                onClick={() => (window.location.pathname = "/recommendations")}
              >
                View Recommendations
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-tsCard/50 border-white/10 backdrop-blur-sm cursor-pointer hover:border-ts-orange/30 transition-colors">
            <CardContent className="p-6 text-center">
              <Clock className="h-12 w-12 text-blue-400 mx-auto mb-4" />
              <h3 className="text-white font-semibold mb-2">Schedule Jobs</h3>
              <p className="text-white/60 text-sm mb-4">
                Manage your project timeline and appointments
              </p>
              <Button
                variant="outline"
                className="border-ts-orange/30 text-ts-orange hover:bg-ts-orange-dark/20 w-full"
                onClick={() => (window.location.pathname = "/schedule")}
              >
                View Schedule
              </Button>
            </CardContent>
          </Card>
        </div>
      </Section>
    </Page>
  );
}
