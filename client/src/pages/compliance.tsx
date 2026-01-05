import { memo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Shield, CheckCircle, AlertTriangle, FileText, Scale, Globe, Eye, Lock } from 'lucide-react';

const Compliance = memo(function Compliance() {
  const complianceAreas = [
    {
      id: 'privacy',
      title: 'Privacy & Data Protection',
      status: 'compliant',
      icon: Lock,
      regulations: ['GDPR', 'CCPA', 'PIPEDA'],
      description: 'Comprehensive privacy controls and data protection measures'
    },
    {
      id: 'accessibility',
      title: 'Digital Accessibility',
      status: 'compliant',
      icon: Eye,
      regulations: ['ADA', 'WCAG 2.1', 'Section 508'],
      description: 'Ensuring platform accessibility for all users'
    },
    {
      id: 'business',
      title: 'Business Compliance',
      status: 'compliant',
      icon: Scale,
      regulations: ['State Licensing', 'Business Registration', 'Tax Compliance'],
      description: 'Meeting all business and contractor licensing requirements'
    },
    {
      id: 'international',
      title: 'International Standards',
      status: 'in-progress',
      icon: Globe,
      regulations: ['ISO 27001', 'SOC 2', 'PCI DSS'],
      description: 'Implementing international security and quality standards'
    }
  ];

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'compliant': return 'text-tsSuccess bg-tsSuccess/10 border-tsSuccess/20';
      case 'in-progress': return 'text-tsWarning bg-tsWarning/10 border-tsWarning/20';
      case 'attention': return 'text-tsError bg-tsError/10 border-tsError/20';
      default: return 'text-tsTextMuted bg-tsTextMuted/10 border-tsBorderMuted';
    }
  };

  const privacyFeatures = [
    'End-to-end encryption for sensitive data',
    'GDPR-compliant data processing',
    'User consent management',
    'Right to erasure (Right to be forgotten)',
    'Data portability options',
    'Privacy by design architecture',
    'Regular security audits',
    'Incident response procedures'
  ];

  const accessibilityFeatures = [
    'Screen reader compatibility',
    'Keyboard navigation support',
    'High contrast mode',
    'Text-to-speech functionality',
    'Alternative text for images',
    'Closed captioning for videos',
    'Adjustable font sizes',
    'Color blind friendly design'
  ];

  return (
    <div className="h-full bg-background p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-foreground mb-4">Compliance Dashboard</h1>
          <p className="text-xl text-gray-300">
            Comprehensive compliance monitoring and regulatory adherence
          </p>
        </div>

        {/* Compliance Overview */}
        <Card className="bg-tsCard border-tsBorder mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              Compliance Status Overview
            </CardTitle>
            <CardDescription className="text-tsTextMuted">
              Real-time monitoring of regulatory compliance across all areas
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {complianceAreas.map((area) => {
                const Icon = area.icon;
                return (
                  <div key={area.id} className={`p-4 rounded-lg border ${getStatusColor(area.status)}`}>
                    <div className="flex items-center gap-2 mb-3">
                      <Icon className="w-5 h-5" />
                      <Badge variant="outline" className={getStatusColor(area.status)}>
                        {area.status.replace('-', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <h3 className="font-semibold text-white mb-2">{area.title}</h3>
                    <p className="text-sm text-tsTextMuted mb-3">{area.description}</p>
                    <div className="space-y-1">
                      {area.regulations.map((reg, index) => (
                        <Badge key={index} variant="secondary" className="text-xs mr-1">
                          {reg}
                        </Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Detailed Compliance Information */}
        <Tabs defaultValue="privacy" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-tsCard">
            <TabsTrigger value="privacy" className="data-[state=active]:bg-orange-600">Privacy</TabsTrigger>
            <TabsTrigger value="accessibility" className="data-[state=active]:bg-orange-600">Accessibility</TabsTrigger>
            <TabsTrigger value="business" className="data-[state=active]:bg-orange-600">Business</TabsTrigger>
            <TabsTrigger value="certifications" className="data-[state=active]:bg-orange-600">Certifications</TabsTrigger>
          </TabsList>

          <TabsContent value="privacy">
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Lock className="w-5 h-5 text-tsSuccess" />
                  Privacy & Data Protection Compliance
                </CardTitle>
                <CardDescription className="text-tsTextMuted">
                  GDPR, CCPA, and global privacy regulation compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-tsSuccess/10 border border-tsSuccess/20 rounded-lg text-center">
                      <h3 className="font-semibold text-tsSuccess mb-2">GDPR Compliant</h3>
                      <p className="text-sm text-tsTextMuted">European data protection standards</p>
                    </div>
                    <div className="p-4 bg-tsSuccess/10 border border-tsSuccess/20 rounded-lg text-center">
                      <h3 className="font-semibold text-tsSuccess mb-2">CCPA Compliant</h3>
                      <p className="text-sm text-tsTextMuted">California privacy rights</p>
                    </div>
                    <div className="p-4 bg-tsSuccess/10 border border-tsSuccess/20 rounded-lg text-center">
                      <h3 className="font-semibold text-tsSuccess mb-2">SOC 2 Type II</h3>
                      <p className="text-sm text-tsTextMuted">Security and availability controls</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-white mb-4">Privacy Features Implemented</h4>
                      <ul className="space-y-2">
                        {privacyFeatures.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-tsTextMuted">
                            <CheckCircle className="w-4 h-4 text-tsSuccess flex-shrink-0" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-white mb-4">User Rights & Controls</h4>
                      <div className="space-y-3">
                        <div className="p-3 bg-slate-700/30 rounded-lg">
                          <h5 className="font-medium text-white">Data Access Request</h5>
                          <p className="text-sm text-tsTextMuted">Users can request copies of their personal data</p>
                          <Button size="sm" variant="outline" className="mt-2">
                            Request Data
                          </Button>
                        </div>
                        <div className="p-3 bg-slate-700/30 rounded-lg">
                          <h5 className="font-medium text-white">Data Deletion</h5>
                          <p className="text-sm text-tsTextMuted">Users can request deletion of their account and data</p>
                          <Button size="sm" variant="outline" className="mt-2">
                            Delete Account
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="accessibility">
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-blue-400" />
                  Digital Accessibility Compliance
                </CardTitle>
                <CardDescription className="text-tsTextMuted">
                  ADA, WCAG 2.1, and Section 508 accessibility standards
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="p-4 bg-tsAccent/10 border border-tsAccent/20 rounded-lg text-center">
                      <h3 className="font-semibold text-tsAccent mb-2">WCAG 2.1 AA</h3>
                      <p className="text-sm text-tsTextMuted">Web accessibility guidelines</p>
                    </div>
                    <div className="p-4 bg-tsAccent/10 border border-tsAccent/20 rounded-lg text-center">
                      <h3 className="font-semibold text-tsAccent mb-2">Section 508</h3>
                      <p className="text-sm text-tsTextMuted">Federal accessibility standards</p>
                    </div>
                    <div className="p-4 bg-tsAccent/10 border border-tsAccent/20 rounded-lg text-center">
                      <h3 className="font-semibold text-tsAccent mb-2">ADA Compliant</h3>
                      <p className="text-sm text-tsTextMuted">Americans with Disabilities Act</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="font-semibold text-white mb-4">Accessibility Features</h4>
                      <ul className="space-y-2">
                        {accessibilityFeatures.map((feature, index) => (
                          <li key={index} className="flex items-center gap-2 text-tsTextMuted">
                            <CheckCircle className="w-4 h-4 text-blue-400 flex-shrink-0" />
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div>
                      <h4 className="font-semibold text-white mb-4">Accessibility Tools</h4>
                      <div className="space-y-3">
                        <Button variant="outline" className="w-full justify-start">
                          <Eye className="w-4 h-4 mr-2" />
                          Toggle High Contrast Mode
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          <FileText className="w-4 h-4 mr-2" />
                          Enable Text-to-Speech
                        </Button>
                        <Button variant="outline" className="w-full justify-start">
                          <Scale className="w-4 h-4 mr-2" />
                          Adjust Font Size
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="business">
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Scale className="w-5 h-5 text-purple-400" />
                  Business & Legal Compliance
                </CardTitle>
                <CardDescription className="text-tsTextMuted">
                  Business licensing, tax compliance, and regulatory requirements
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div className="p-4 bg-tsAccentSecondary/10 border border-tsAccentSecondary/20 rounded-lg">
                      <h3 className="font-semibold text-tsAccentSecondary mb-2">Business Registration</h3>
                      <p className="text-sm text-tsTextMuted mb-2">Valid in all 50 states</p>
                      <Badge className="bg-tsSuccess">Active</Badge>
                    </div>
                    <div className="p-4 bg-tsAccentSecondary/10 border border-tsAccentSecondary/20 rounded-lg">
                      <h3 className="font-semibold text-tsAccentSecondary mb-2">Tax Compliance</h3>
                      <p className="text-sm text-tsTextMuted mb-2">Federal and state tax obligations</p>
                      <Badge className="bg-tsSuccess">Current</Badge>
                    </div>
                    <div className="p-4 bg-tsAccentSecondary/10 border border-tsAccentSecondary/20 rounded-lg">
                      <h3 className="font-semibold text-tsAccentSecondary mb-2">Insurance Coverage</h3>
                      <p className="text-sm text-tsTextMuted mb-2">Professional liability insurance</p>
                      <Badge className="bg-tsSuccess">Protected</Badge>
                    </div>
                  </div>

                  <div className="p-4 bg-tsWarning/10 border border-tsWarning/20 rounded-lg">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-tsWarning mt-0.5" />
                      <div>
                        <h4 className="font-medium text-tsWarning mb-2">Ongoing Compliance Monitoring</h4>
                        <p className="text-sm text-tsTextMuted mb-3">
                          We continuously monitor regulatory changes and update our compliance measures accordingly.
                        </p>
                        <ul className="space-y-1 text-sm text-tsTextMuted">
                          <li>• Quarterly compliance audits</li>
                          <li>• Regulatory change notifications</li>
                          <li>• Automated compliance checks</li>
                          <li>• Regular legal review processes</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="certifications">
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Shield className="w-5 h-5 text-orange-400" />
                  Security Certifications & Standards
                </CardTitle>
                <CardDescription className="text-tsTextMuted">
                  Industry certifications and security standards compliance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h4 className="font-semibold text-white">Current Certifications</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-tsSuccess/10 border border-tsSuccess/20 rounded-lg">
                          <div>
                            <h5 className="font-medium text-tsSuccess">SOC 2 Type II</h5>
                            <p className="text-xs text-tsTextMuted">Expires: December 2024</p>
                          </div>
                          <Badge className="bg-tsSuccess">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-tsSuccess/10 border border-tsSuccess/20 rounded-lg">
                          <div>
                            <h5 className="font-medium text-tsSuccess">PCI DSS Level 1</h5>
                            <p className="text-xs text-tsTextMuted">Expires: March 2025</p>
                          </div>
                          <Badge className="bg-tsSuccess">Active</Badge>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-semibold text-white">In Progress</h4>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-tsWarning/10 border border-tsWarning/20 rounded-lg">
                          <div>
                            <h5 className="font-medium text-tsWarning">ISO 27001</h5>
                            <p className="text-xs text-tsTextMuted">Expected: Q2 2024</p>
                          </div>
                          <Badge className="bg-tsWarning">Pending</Badge>
                        </div>
                        <div className="flex items-center justify-between p-3 bg-tsWarning/10 border border-tsWarning/20 rounded-lg">
                          <div>
                            <h5 className="font-medium text-tsWarning">FedRAMP</h5>
                            <p className="text-xs text-tsTextMuted">Expected: Q3 2024</p>
                          </div>
                          <Badge className="bg-tsWarning">Pending</Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-tsBorder pt-6">
                    <h4 className="font-semibold text-white mb-4">Security Measures</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      <div className="p-3 bg-tsCardMuted rounded-lg">
                        <h5 className="font-medium text-tsText text-sm mb-1">Data Encryption</h5>
                        <p className="text-xs text-tsTextMuted">AES-256 encryption at rest and in transit</p>
                      </div>
                      <div className="p-3 bg-tsCardMuted rounded-lg">
                        <h5 className="font-medium text-tsText text-sm mb-1">Access Control</h5>
                        <p className="text-xs text-tsTextMuted">Multi-factor authentication and RBAC</p>
                      </div>
                      <div className="p-3 bg-tsCardMuted rounded-lg">
                        <h5 className="font-medium text-tsText text-sm mb-1">Monitoring</h5>
                        <p className="text-xs text-tsTextMuted">24/7 security monitoring and alerting</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
});

export default Compliance;