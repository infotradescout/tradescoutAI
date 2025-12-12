import { memo, useState } from 'react';
import { Rocket, Crown, CheckCircle2, AlertTriangle, FileText, Upload, Users2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';

const ApplyAccelerator = memo(function ApplyAccelerator() {
  const [currentStep, setCurrentStep] = useState(1);
  const [applicationData, setApplicationData] = useState({
    personalInfo: {},
    businessInfo: {},
    experience: {},
    goals: {},
    requirements: {}
  });
  const { toast } = useToast();

  const totalSteps = 5;
  const progress = (currentStep / totalSteps) * 100;

  const businessTypes = [
    'General Contractor',
    'Electrical',
    'Plumbing', 
    'HVAC',
    'Roofing',
    'Flooring',
    'Painting',
    'Landscaping',
    'Kitchen/Bath Remodeling',
    'Other'
  ];

  const experienceLevels = [
    'Less than 1 year',
    '1-3 years',
    '3-5 years',
    '5-10 years',
    '10+ years'
  ];

  const teamSizes = [
    'Solo (just me)',
    '2-5 employees',
    '6-15 employees',
    '16-50 employees',
    '50+ employees'
  ];

  const annualRevenue = [
    'Less than $100K',
    '$100K - $250K',
    '$250K - $500K',
    '$500K - $1M',
    '$1M - $5M',
    '$5M+'
  ];

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmitApplication = () => {
    toast({
      title: "Application Submitted!",
      description: "Your Accelerator Program application has been submitted for review. You'll hear back within 2-3 business days.",
    });
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Personal Information</h2>
              <p className="text-gray-400">Tell us about yourself and your background</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-white">First Name *</Label>
                <Input
                  id="firstName"
                  placeholder="John"
                  className="bg-navy-700 border-navy-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-white">Last Name *</Label>
                <Input
                  id="lastName"
                  placeholder="Smith"
                  className="bg-navy-700 border-navy-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className="text-white">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="john@example.com"
                  className="bg-navy-700 border-navy-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone" className="text-white">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="(555) 123-4567"
                  className="bg-navy-700 border-navy-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="location" className="text-white">Primary Service Location *</Label>
                <Input
                  id="location"
                  placeholder="Los Angeles, CA"
                  className="bg-navy-700 border-navy-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="licenseNumber" className="text-white">License Number</Label>
                <Input
                  id="licenseNumber"
                  placeholder="C-36-123456"
                  className="bg-navy-700 border-navy-600 text-white"
                />
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Business Information</h2>
              <p className="text-gray-400">Details about your contracting business</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label htmlFor="businessName" className="text-white">Business Name *</Label>
                <Input
                  id="businessName"
                  placeholder="Smith Construction LLC"
                  className="bg-navy-700 border-navy-600 text-white"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-white">Business Type *</Label>
                <Select>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Select business type" />
                  </SelectTrigger>
                  <SelectContent>
                    {businessTypes.map((type) => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Years in Business *</Label>
                <Select>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Select experience level" />
                  </SelectTrigger>
                  <SelectContent>
                    {experienceLevels.map((level) => (
                      <SelectItem key={level} value={level}>{level}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Team Size *</Label>
                <Select>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Select team size" />
                  </SelectTrigger>
                  <SelectContent>
                    {teamSizes.map((size) => (
                      <SelectItem key={size} value={size}>{size}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-white">Annual Revenue *</Label>
                <Select>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Select revenue range" />
                  </SelectTrigger>
                  <SelectContent>
                    {annualRevenue.map((revenue) => (
                      <SelectItem key={revenue} value={revenue}>{revenue}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="website" className="text-white">Website (Optional)</Label>
                <Input
                  id="website"
                  placeholder="https://www.yourwebsite.com"
                  className="bg-navy-700 border-navy-600 text-white"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="businessDescription" className="text-white">Business Description *</Label>
              <Textarea
                id="businessDescription"
                placeholder="Describe your business, services offered, target customers, and what makes you unique..."
                className="bg-navy-700 border-navy-600 text-white"
                rows={4}
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Experience & Challenges</h2>
              <p className="text-gray-400">Help us understand your current situation</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="currentChallenges" className="text-white">What are your biggest business challenges? *</Label>
                <Textarea
                  id="currentChallenges"
                  placeholder="e.g., Finding qualified leads, managing projects, handling payments, scaling operations..."
                  className="bg-navy-700 border-navy-600 text-white"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="marketingEfforts" className="text-white">How do you currently find new customers? *</Label>
                <Textarea
                  id="marketingEfforts"
                  placeholder="e.g., Word of mouth, online ads, social media, referrals, trade shows..."
                  className="bg-navy-700 border-navy-600 text-white"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="projectManagement" className="text-white">How do you manage projects and communicate with clients?</Label>
                <Textarea
                  id="projectManagement"
                  placeholder="e.g., Email, phone calls, project management software, in-person meetings..."
                  className="bg-navy-700 border-navy-600 text-white"
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="differentiation" className="text-white">What sets you apart from competitors? *</Label>
                <Textarea
                  id="differentiation"
                  placeholder="e.g., Quality craftsmanship, customer service, specialized expertise, pricing..."
                  className="bg-navy-700 border-navy-600 text-white"
                  rows={3}
                />
              </div>
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Goals & Expectations</h2>
              <p className="text-gray-400">Share your vision for business growth</p>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="businessGoals" className="text-white">What are your main business goals for the next 12 months? *</Label>
                <Textarea
                  id="businessGoals"
                  placeholder="e.g., Increase revenue by 50%, hire 3 new employees, expand to 2 new counties..."
                  className="bg-navy-700 border-navy-600 text-white"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="acceleratorExpectations" className="text-white">What do you hope to gain from the Accelerator Program? *</Label>
                <Textarea
                  id="acceleratorExpectations"
                  placeholder="e.g., More qualified leads, better project management, networking opportunities, business coaching..."
                  className="bg-navy-700 border-navy-600 text-white"
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timeCommitment" className="text-white">How much time can you dedicate to program activities weekly? *</Label>
                <Select>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Select time commitment" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2-5">2-5 hours per week</SelectItem>
                    <SelectItem value="5-10">5-10 hours per week</SelectItem>
                    <SelectItem value="10-15">10-15 hours per week</SelectItem>
                    <SelectItem value="15+">15+ hours per week</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="investmentLevel" className="text-white">What's your budget for business growth initiatives? *</Label>
                <Select>
                  <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                    <SelectValue placeholder="Select investment level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="under-1k">Under $1,000/month</SelectItem>
                    <SelectItem value="1k-5k">$1,000 - $5,000/month</SelectItem>
                    <SelectItem value="5k-10k">$5,000 - $10,000/month</SelectItem>
                    <SelectItem value="10k+">$10,000+/month</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-white mb-2">Review & Submit</h2>
              <p className="text-gray-400">Confirm your application details</p>
            </div>

            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <h3 className="text-white font-medium mb-4">Application Requirements</h3>
                <div className="space-y-3">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="agreement1" />
                    <label htmlFor="agreement1" className="text-gray-300 text-sm">
                      I commit to actively participating in all program activities and training sessions
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="agreement2" />
                    <label htmlFor="agreement2" className="text-gray-300 text-sm">
                      I understand this is a 6-month commitment with monthly assessments
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="agreement3" />
                    <label htmlFor="agreement3" className="text-gray-300 text-sm">
                      I agree to provide feedback and testimonials about my experience
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="agreement4" />
                    <label htmlFor="agreement4" className="text-gray-300 text-sm">
                      I understand the program cost is $497/month and agree to the payment terms
                    </label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-navy-700 border-navy-600">
              <CardContent className="p-6">
                <h3 className="text-white font-medium mb-4">What Happens Next?</h3>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">1</div>
                    <div>
                      <p className="text-white font-medium">Application Review</p>
                      <p className="text-gray-400 text-sm">Our team reviews your application within 2-3 business days</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">2</div>
                    <div>
                      <p className="text-white font-medium">Interview Call</p>
                      <p className="text-gray-400 text-sm">If approved, we'll schedule a 30-minute interview call</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="bg-orange-600 text-white rounded-full w-6 h-6 flex items-center justify-center text-sm font-bold">3</div>
                    <div>
                      <p className="text-white font-medium">Program Start</p>
                      <p className="text-gray-400 text-sm">Welcome to the Accelerator Program and kick-off session</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="bg-navy-700 p-4 rounded-lg">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5" />
                <div>
                  <p className="text-white font-medium">Important Note</p>
                  <p className="text-gray-400 text-sm">
                    The Accelerator Program is limited to 25 contractors per cohort. Applications are reviewed on a first-come, first-served basis for qualified candidates.
                  </p>
                </div>
              </div>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Accelerator Program Application</h1>
          </div>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Join an exclusive group of contractors committed to rapid business growth and success
          </p>
        </div>

        {/* Progress Bar */}
        <div className="max-w-2xl mx-auto mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Step {currentStep} of {totalSteps}</span>
            <span className="text-gray-400 text-sm">{Math.round(progress)}% Complete</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>

        {/* Application Form */}
        <div className="max-w-4xl mx-auto">
          <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
            <CardContent className="p-8">
              {renderStepContent()}

              {/* Navigation Buttons */}
              <div className="flex justify-between mt-8">
                <Button
                  variant="outline"
                  onClick={handlePrevious}
                  disabled={currentStep === 1}
                  className="border-navy-600 text-white hover:bg-navy-700"
                >
                  Previous
                </Button>

                {currentStep === totalSteps ? (
                  <Button
                    onClick={handleSubmitApplication}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Rocket className="h-4 w-4 mr-2" />
                    Submit Application
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    Next Step
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Program Benefits Sidebar */}
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <TrendingUp className="h-8 w-8 text-green-400 mx-auto mb-3" />
                <h3 className="text-white font-medium mb-2">Lead Priority</h3>
                <p className="text-gray-400 text-sm">Get first access to high-value leads in your area</p>
              </CardContent>
            </Card>

            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <Users2 className="h-8 w-8 text-blue-400 mx-auto mb-3" />
                <h3 className="text-white font-medium mb-2">Expert Coaching</h3>
                <p className="text-gray-400 text-sm">Monthly 1-on-1 sessions with business growth experts</p>
              </CardContent>
            </Card>

            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardContent className="p-6 text-center">
                <Crown className="h-8 w-8 text-purple-400 mx-auto mb-3" />
                <h3 className="text-white font-medium mb-2">Exclusive Network</h3>
                <p className="text-gray-400 text-sm">Connect with top contractors and industry leaders</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
});

export default ApplyAccelerator;