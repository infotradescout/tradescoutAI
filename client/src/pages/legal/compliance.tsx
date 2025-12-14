import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { 
  Shield, 
  FileText, 
  Scale, 
  CheckCircle, 
  AlertTriangle,
  Building,
  CreditCard,
  Users,
  Eye,
  Lock,
  Globe
} from "lucide-react";

export default function CompliancePage() {
  const [activeCompliance, setActiveCompliance] = useState("overview");

  const complianceAreas = [
    {
      id: "inform-act",
      title: "INFORM Consumers Act",
      status: "Compliant",
      description: "Federal transparency requirements for high-volume sellers",
      icon: <Shield className="h-5 w-5" />,
      requirements: [
        "Seller identity verification (200+ transactions, $5,000+ revenue)",
        "Bank account information collection",
        "Government-issued ID verification",
        "Tax identification number collection",
        "Annual seller certification process",
        "Buyer disclosure of seller information",
        "Suspicious activity reporting system"
      ]
    },
    {
      id: "sales-tax",
      title: "Marketplace Facilitator Tax Laws",
      status: "Compliant",
      description: "Sales tax collection and remittance across all states",
      icon: <Building className="h-5 w-5" />,
      requirements: [
        "Economic nexus threshold monitoring",
        "Automated sales tax calculation",
        "State registration and licensing",
        "Tax exemption certificate management",
        "Regular remittance to tax authorities",
        "Detailed transaction record keeping",
        "Multi-state compliance management"
      ]
    },
    {
      id: "privacy",
      title: "Privacy Compliance (CCPA/GDPR)",
      status: "Compliant",
      description: "Data protection and privacy rights management",
      icon: <Lock className="h-5 w-5" />,
      requirements: [
        "Comprehensive privacy policy",
        "User consent management",
        "Data subject rights handling",
        "Cookie preference controls",
        "Data breach notification procedures",
        "Third-party vendor compliance",
        "Regular privacy impact assessments"
      ]
    },
    {
      id: "accessibility",
      title: "ADA Web Accessibility",
      status: "In Progress",
      description: "WCAG 2.1 AA compliance for accessibility",
      icon: <Users className="h-5 w-5" />,
      requirements: [
        "WCAG 2.1 AA standard implementation",
        "Screen reader compatibility",
        "Keyboard navigation support",
        "Color contrast compliance",
        "Alternative text for images",
        "Accessible form design",
        "Regular accessibility auditing"
      ]
    },
    {
      id: "payment",
      title: "PCI DSS Compliance",
      status: "Compliant",
      description: "Payment card industry data security standards",
      icon: <CreditCard className="h-5 w-5" />,
      requirements: [
        "Secure payment processing",
        "No card data storage",
        "Third-party processor compliance",
        "Secure data transmission",
        "Regular security assessments",
        "Incident response procedures",
        "Employee security training"
      ]
    },
    {
      id: "content",
      title: "Content Moderation",
      status: "Compliant",
      description: "Platform content policies and enforcement",
      icon: <Eye className="h-5 w-5" />,
      requirements: [
        "Clear community guidelines",
        "Automated content screening",
        "Human moderation review",
        "Appeal process implementation",
        "Illegal content reporting",
        "Copyright infringement handling",
        "User safety protections"
      ]
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Compliant":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      case "In Progress":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "Pending":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      default:
        return "bg-[#0f1419] text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Compliant":
        return <CheckCircle className="h-4 w-4" />;
      case "In Progress":
        return <AlertTriangle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-[#0f1419]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-orange-500 mb-4">
            Legal Compliance Dashboard
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Comprehensive compliance management for federal, state, and local regulations
          </p>
        </div>

        {/* Compliance Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Total Compliance Areas
                  </p>
                  <p className="text-2xl font-bold text-orange-500">
                    {complianceAreas.length}
                  </p>
                </div>
                <Scale className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Fully Compliant
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {complianceAreas.filter(area => area.status === "Compliant").length}
                  </p>
                </div>
                <CheckCircle className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    In Progress
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {complianceAreas.filter(area => area.status === "In Progress").length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs value={activeCompliance} onValueChange={setActiveCompliance}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="overview">Compliance Overview</TabsTrigger>
            <TabsTrigger value="details">Detailed Requirements</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {complianceAreas.map((area) => (
                <Card key={area.id}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        {area.icon}
                        <CardTitle className="text-lg">{area.title}</CardTitle>
                      </div>
                      <Badge className={getStatusColor(area.status)}>
                        <span className="flex items-center space-x-1">
                          {getStatusIcon(area.status)}
                          <span>{area.status}</span>
                        </span>
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p className="text-gray-600 dark:text-gray-300 mb-4">
                      {area.description}
                    </p>
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-orange-500">
                        Key Requirements:
                      </p>
                      <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                        {area.requirements.slice(0, 3).map((req, index) => (
                          <li key={index} className="flex items-start">
                            <CheckCircle className="h-3 w-3 text-green-500 mt-1 mr-2 flex-shrink-0" />
                            {req}
                          </li>
                        ))}
                        {area.requirements.length > 3 && (
                          <li className="text-blue-600 cursor-pointer">
                            +{area.requirements.length - 3} more requirements...
                          </li>
                        )}
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="details" className="space-y-6">
            {complianceAreas.map((area) => (
              <Card key={area.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      {area.icon}
                      <CardTitle className="text-xl">{area.title}</CardTitle>
                    </div>
                    <Badge className={getStatusColor(area.status)}>
                      <span className="flex items-center space-x-1">
                        {getStatusIcon(area.status)}
                        <span>{area.status}</span>
                      </span>
                    </Badge>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300">
                    {area.description}
                  </p>
                </CardHeader>
                <CardContent>
                  <h4 className="font-medium text-orange-500 mb-3">
                    Implementation Requirements:
                  </h4>
                  <div className="space-y-3">
                    {area.requirements.map((req, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-[#0f1419] dark:bg-[#1a2332] rounded-lg">
                        <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                        <span className="text-sm text-gray-700 dark:text-gray-300">
                          {req}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>

        {/* Legal Resources */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="h-5 w-5 mr-2" />
              Legal Resources & Documentation
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <Button variant="outline" className="justify-start" asChild>
                <a href="/legal/privacy-policy">
                  <Lock className="h-4 w-4 mr-2" />
                  Privacy Policy
                </a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/terms">
                  <FileText className="h-4 w-4 mr-2" />
                  Terms of Service
                </a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/legal/accessibility">
                  <Users className="h-4 w-4 mr-2" />
                  Accessibility Statement
                </a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/legal/seller-agreement">
                  <Building className="h-4 w-4 mr-2" />
                  Seller Agreement
                </a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/legal/community-guidelines">
                  <Eye className="h-4 w-4 mr-2" />
                  Community Guidelines
                </a>
              </Button>
              <Button variant="outline" className="justify-start" asChild>
                <a href="/legal/dispute-resolution">
                  <Scale className="h-4 w-4 mr-2" />
                  Dispute Resolution
                </a>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Notice */}
        <Alert className="mt-8">
          <Globe className="h-4 w-4" />
          <AlertDescription>
            This compliance dashboard is updated regularly to reflect current legal requirements. 
            For specific legal advice, please consult with qualified legal counsel. 
            Last updated: August 11, 2025
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
}