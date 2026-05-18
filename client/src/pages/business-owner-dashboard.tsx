import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Briefcase,
  DollarSign,
  Users,
  TrendingUp,
  Calendar,
  FileText,
  Building,
  Plus,
  BarChart3,
  Store,
  ShoppingBag,
  ReceiptText,
} from "lucide-react";

export default function BusinessOwnerDashboard() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center">
          <Store className="h-8 w-8 text-purple-500 mr-3" />
          Business Owner Dashboard
        </h1>
        <p className="text-white/60 mt-2">Manage your business operations and growth initiatives</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Monthly Revenue</p>
                <p className="text-2xl font-bold text-white">$45,250</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Active Projects</p>
                <p className="text-2xl font-bold text-white">12</p>
              </div>
              <Briefcase className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Team Members</p>
                <p className="text-2xl font-bold text-white">28</p>
              </div>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-tsCard border-white/10">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white/60">Growth Rate</p>
                <p className="text-2xl font-bold text-white">+15.3%</p>
              </div>
              <TrendingUp className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Content */}
        <div className="lg:col-span-2">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white flex items-center">
                <BarChart3 className="h-5 w-5 mr-2" />
                Business Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div>
                  <h3 className="text-white font-semibold mb-3">Business demand surfaces</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link href="/business-directory">
                      <Button className="bg-purple-500 hover:bg-purple-600 text-white justify-start w-full">
                        <Building className="h-4 w-4 mr-2" />
                        Browse Businesses
                      </Button>
                    </Link>
                    <Link href="/direct-connect">
                      <Button
                        variant="outline"
                        className="border-white/15 text-white/70 justify-start w-full"
                      >
                        <Users className="h-4 w-4 mr-2" />
                        Direct Connect
                      </Button>
                    </Link>
                  </div>
                </div>

                <div>
                  <h3 className="text-white font-semibold mb-3">Business Tools</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Link href="/offer-services">
                      <Button
                        variant="outline"
                        className="border-white/15 text-white/70 justify-start w-full"
                      >
                        <ShoppingBag className="h-4 w-4 mr-2" />
                        Services & Items
                      </Button>
                    </Link>
                    <Link href="/finances/records">
                      <Button
                        variant="outline"
                        className="border-white/15 text-white/70 justify-start w-full"
                      >
                        <ReceiptText className="h-4 w-4 mr-2" />
                        Books & Records
                      </Button>
                    </Link>
                    <Link href="/utilities/supply-run">
                      <Button
                        variant="outline"
                        className="border-white/15 text-white/70 justify-start w-full"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Estimates & Materials
                      </Button>
                    </Link>
                    <Link href="/business-listing">
                      <Button
                        variant="outline"
                        className="border-white/15 text-white/70 justify-start w-full"
                      >
                        <Calendar className="h-4 w-4 mr-2" />
                        Profile & Availability
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="bg-tsCard border-white/10">
            <CardHeader>
              <CardTitle className="text-white">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <Link href="/business-listing">
                  <Button className="w-full bg-purple-500 hover:bg-purple-600 text-white justify-start">
                    <Plus className="h-4 w-4 mr-2" />
                    Create Business Profile
                  </Button>
                </Link>
                <Link href="/offer-services">
                  <Button
                    variant="outline"
                    className="w-full border-white/15 text-white/70 justify-start"
                  >
                    <ShoppingBag className="h-4 w-4 mr-2" />
                    Add Offer
                  </Button>
                </Link>
                <Link href="/analytics">
                  <Button
                    variant="outline"
                    className="w-full border-white/15 text-white/70 justify-start"
                  >
                    <BarChart3 className="h-4 w-4 mr-2" />
                    View Analytics
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
