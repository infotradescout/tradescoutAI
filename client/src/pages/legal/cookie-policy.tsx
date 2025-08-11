import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Cookie, Settings, Shield, BarChart3, Target, CheckCircle } from "lucide-react";

export default function CookiePolicy() {
  const [cookiePreferences, setCookiePreferences] = useState({
    necessary: true, // Always enabled
    functional: true,
    analytics: false,
    advertising: false,
    performance: true
  });

  const handlePreferenceChange = (category: string, enabled: boolean) => {
    if (category === 'necessary') return; // Cannot disable necessary cookies
    
    setCookiePreferences(prev => ({
      ...prev,
      [category]: enabled
    }));
  };

  const savePreferences = () => {
    // Save to localStorage and update cookie consent
    localStorage.setItem('cookiePreferences', JSON.stringify(cookiePreferences));
    // Trigger cookie consent update
    window.dispatchEvent(new CustomEvent('cookiePreferencesUpdated', { 
      detail: cookiePreferences 
    }));
    alert('Cookie preferences saved successfully!');
  };

  const acceptAllCookies = () => {
    const allEnabled = {
      necessary: true,
      functional: true,
      analytics: true,
      advertising: true,
      performance: true
    };
    setCookiePreferences(allEnabled);
    localStorage.setItem('cookiePreferences', JSON.stringify(allEnabled));
    window.dispatchEvent(new CustomEvent('cookiePreferencesUpdated', { 
      detail: allEnabled 
    }));
    alert('All cookies accepted!');
  };

  const rejectOptionalCookies = () => {
    const necessaryOnly = {
      necessary: true,
      functional: false,
      analytics: false,
      advertising: false,
      performance: false
    };
    setCookiePreferences(necessaryOnly);
    localStorage.setItem('cookiePreferences', JSON.stringify(necessaryOnly));
    window.dispatchEvent(new CustomEvent('cookiePreferencesUpdated', { 
      detail: necessaryOnly 
    }));
    alert('Optional cookies rejected!');
  };

  const cookieCategories = [
    {
      id: 'necessary',
      name: 'Strictly Necessary Cookies',
      icon: <Shield className="h-5 w-5" />,
      description: 'These cookies are essential for the website to function and cannot be disabled.',
      purpose: 'Authentication, security, form submissions, shopping cart functionality',
      examples: [
        'User authentication tokens',
        'CSRF protection tokens',
        'Session management',
        'Security settings',
        'Form data preservation'
      ],
      retention: 'Session duration or up to 30 days',
      canDisable: false
    },
    {
      id: 'functional',
      name: 'Functional Cookies',
      icon: <Settings className="h-5 w-5" />,
      description: 'These cookies enable enhanced functionality and personalization.',
      purpose: 'User preferences, language settings, accessibility options',
      examples: [
        'Language preferences',
        'Theme settings (dark/light mode)',
        'Accessibility preferences',
        'Region/location settings',
        'Notification preferences'
      ],
      retention: 'Up to 1 year',
      canDisable: true
    },
    {
      id: 'analytics',
      name: 'Analytics Cookies',
      icon: <BarChart3 className="h-5 w-5" />,
      description: 'These cookies help us understand how visitors interact with our website.',
      purpose: 'Traffic analysis, user behavior, performance monitoring',
      examples: [
        'Google Analytics',
        'Page view tracking',
        'User journey analysis',
        'Feature usage statistics',
        'Error reporting'
      ],
      retention: 'Up to 2 years',
      canDisable: true
    },
    {
      id: 'advertising',
      name: 'Advertising Cookies',
      icon: <Target className="h-5 w-5" />,
      description: 'These cookies are used to deliver relevant advertisements.',
      purpose: 'Targeted advertising, ad performance measurement',
      examples: [
        'Ad targeting data',
        'Conversion tracking',
        'Retargeting pixels',
        'Social media advertising',
        'Third-party ad networks'
      ],
      retention: 'Up to 1 year',
      canDisable: true
    },
    {
      id: 'performance',
      name: 'Performance Cookies',
      icon: <CheckCircle className="h-5 w-5" />,
      description: 'These cookies help improve website performance and user experience.',
      purpose: 'Load balancing, caching, performance optimization',
      examples: [
        'CDN optimization',
        'Load balancing',
        'Performance monitoring',
        'Caching preferences',
        'Resource optimization'
      ],
      retention: 'Up to 6 months',
      canDisable: true
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Card>
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <Cookie className="h-12 w-12 text-orange-500" />
            </div>
            <CardTitle className="text-3xl font-bold">Cookie Policy & Preferences</CardTitle>
            <p className="text-gray-600 dark:text-gray-300">
              Manage your cookie preferences and learn about how we use cookies
            </p>
          </CardHeader>
          <CardContent>
            
            <Alert className="mb-6">
              <Shield className="h-4 w-4" />
              <AlertDescription>
                We use cookies to enhance your browsing experience, provide personalized content, 
                and analyze our traffic. You can customize your preferences below.
              </AlertDescription>
            </Alert>

            <Tabs defaultValue="preferences" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="preferences">Cookie Preferences</TabsTrigger>
                <TabsTrigger value="policy">Cookie Policy</TabsTrigger>
              </TabsList>

              <TabsContent value="preferences" className="space-y-6">
                <div className="flex gap-4 mb-6">
                  <Button onClick={acceptAllCookies} className="flex-1">
                    Accept All Cookies
                  </Button>
                  <Button onClick={rejectOptionalCookies} variant="outline" className="flex-1">
                    Reject Optional Cookies
                  </Button>
                </div>

                <div className="space-y-6">
                  {cookieCategories.map((category) => (
                    <Card key={category.id} className="border-2">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center space-x-3">
                            {category.icon}
                            <h3 className="text-lg font-semibold">{category.name}</h3>
                          </div>
                          <Switch
                            checked={cookiePreferences[category.id as keyof typeof cookiePreferences]}
                            onCheckedChange={(checked) => handlePreferenceChange(category.id, checked)}
                            disabled={!category.canDisable}
                          />
                        </div>
                        
                        <p className="text-gray-600 dark:text-gray-300 mb-4">
                          {category.description}
                        </p>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium mb-2">Purpose:</p>
                            <p className="text-gray-600 dark:text-gray-300">{category.purpose}</p>
                          </div>
                          <div>
                            <p className="font-medium mb-2">Data Retention:</p>
                            <p className="text-gray-600 dark:text-gray-300">{category.retention}</p>
                          </div>
                        </div>
                        
                        <div className="mt-4">
                          <p className="font-medium mb-2">Examples:</p>
                          <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
                            {category.examples.map((example, index) => (
                              <li key={index} className="flex items-start">
                                <span className="mr-2">•</span>
                                {example}
                              </li>
                            ))}
                          </ul>
                        </div>
                        
                        {!category.canDisable && (
                          <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                            <p className="text-sm text-yellow-800 dark:text-yellow-200">
                              These cookies are essential for website functionality and cannot be disabled.
                            </p>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <div className="flex justify-center">
                  <Button onClick={savePreferences} size="lg">
                    Save Cookie Preferences
                  </Button>
                </div>
              </TabsContent>

              <TabsContent value="policy" className="prose max-w-none dark:prose-invert">
                <div className="space-y-6">
                  <section>
                    <h2 className="text-2xl font-semibold mb-4">What are Cookies?</h2>
                    <p className="mb-4">
                      Cookies are small text files stored on your device when you visit our website. 
                      They help us provide you with a better experience by remembering your preferences 
                      and understanding how you use our site.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-2xl font-semibold mb-4">How We Use Cookies</h2>
                    <p className="mb-4">We use cookies for several purposes:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                      <li><strong>Essential Functionality:</strong> To provide core website features</li>
                      <li><strong>User Experience:</strong> To remember your preferences and settings</li>
                      <li><strong>Analytics:</strong> To understand how our website is used</li>
                      <li><strong>Performance:</strong> To optimize website speed and functionality</li>
                      <li><strong>Marketing:</strong> To show relevant advertisements (with consent)</li>
                    </ul>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-2xl font-semibold mb-4">Third-Party Cookies</h2>
                    <p className="mb-4">
                      We may use third-party services that set their own cookies. These include:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                      <li><strong>Google Analytics:</strong> For website traffic analysis</li>
                      <li><strong>Payment Processors:</strong> For secure payment processing</li>
                      <li><strong>Social Media:</strong> For social sharing functionality</li>
                      <li><strong>Advertising Networks:</strong> For targeted advertising</li>
                    </ul>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-2xl font-semibold mb-4">Managing Cookies</h2>
                    <p className="mb-4">You can control cookies through:</p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                      <li><strong>This Page:</strong> Use our cookie preference center above</li>
                      <li><strong>Browser Settings:</strong> Most browsers allow you to refuse cookies</li>
                      <li><strong>Third-Party Tools:</strong> Use privacy tools and browser extensions</li>
                    </ul>
                    
                    <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg mt-4">
                      <p className="text-sm">
                        <strong>Note:</strong> Disabling certain cookies may impact website functionality 
                        and your user experience.
                      </p>
                    </div>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-2xl font-semibold mb-4">Legal Basis</h2>
                    <p className="mb-4">
                      We process cookies based on:
                    </p>
                    <ul className="list-disc pl-6 mb-4 space-y-2">
                      <li><strong>Legitimate Interest:</strong> For necessary cookies required for website operation</li>
                      <li><strong>Consent:</strong> For optional cookies like analytics and advertising</li>
                      <li><strong>Contract Performance:</strong> For cookies needed to fulfill our services</li>
                    </ul>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-2xl font-semibold mb-4">Updates to Cookie Policy</h2>
                    <p className="mb-4">
                      We may update this cookie policy periodically to reflect changes in our practices 
                      or applicable laws. We will notify you of any material changes.
                    </p>
                  </section>

                  <Separator />

                  <section>
                    <h2 className="text-2xl font-semibold mb-4">Contact Us</h2>
                    <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
                      <p className="mb-2">
                        If you have questions about our use of cookies, please contact us:
                      </p>
                      <p className="mb-2"><strong>Email:</strong> privacy@tradescout.com</p>
                      <p className="mb-2"><strong>Address:</strong> [Your Business Address]</p>
                      <p><strong>Phone:</strong> [Your Phone Number]</p>
                    </div>
                  </section>
                </div>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}