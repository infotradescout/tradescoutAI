import { memo, useState } from 'react';
import { CreditCard, DollarSign, Shield, CheckCircle2, XCircle, Clock, AlertTriangle, ArrowRight, Receipt } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';

const PaymentProcessing = memo(function PaymentProcessing() {
  const [selectedPlan, setSelectedPlan] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const plans = [
    {
      id: 'basic',
      name: 'Basic',
      price: 0,
      period: 'month',
      features: [
        'View contractor profiles',
        'Submit up to 3 project requests',
        'Basic messaging',
        'Community access'
      ],
      recommended: false
    },
    {
      id: 'premium',
      name: 'Premium',
      price: 29.99,
      period: 'month',
      features: [
        'Unlimited project requests',
        'Priority contractor matching',
        'Advanced messaging',
        'Project management tools',
        '24/7 support'
      ],
      recommended: true
    },
    {
      id: 'accelerator',
      name: 'Accelerator',
      price: 199.99,
      period: 'month',
      features: [
        'All Premium features',
        'Lead priority access',
        'Business coaching',
        'Exclusive networking',
        'Advanced analytics',
        'Custom branding'
      ],
      recommended: false
    }
  ];

  const recentTransactions = [
    {
      id: 1,
      type: 'subscription',
      description: 'Accelerator Program - Monthly',
      amount: 199.99,
      status: 'completed',
      date: '2024-03-20T10:30:00Z',
      method: 'Visa •••• 4242'
    },
    {
      id: 2,
      type: 'lead_credit',
      description: 'Lead Credits Bundle (10x)',
      amount: 49.99,
      status: 'completed',
      date: '2024-03-18T14:15:00Z',
      method: 'MasterCard •••• 8888'
    },
    {
      id: 3,
      type: 'boost',
      description: 'Profile Boost - 7 Days',
      amount: 19.99,
      status: 'pending',
      date: '2024-03-17T09:45:00Z',
      method: 'Visa •••• 4242'
    }
  ];

  const handlePayment = async () => {
    if (!selectedPlan || !paymentMethod) {
      toast({
        title: "Missing Information",
        description: "Please select a plan and payment method to continue.",
        variant: "destructive",
      });
      return;
    }

    setProcessing(true);
    
    // Simulate payment processing
    setTimeout(() => {
      setProcessing(false);
      toast({
        title: "Payment Successful!",
        description: "Your subscription has been activated successfully.",
      });
    }, 3000);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="h-4 w-4 text-green-400" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-400" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-400" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-green-400';
      case 'pending':
        return 'text-yellow-400';
      case 'failed':
        return 'text-red-400';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="min-h-screen bg-navy-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <CreditCard className="h-8 w-8 text-orange-400" />
            <h1 className="text-4xl font-bold text-white">Payment & Billing</h1>
          </div>
          <p className="text-gray-300 text-lg max-w-2xl mx-auto">
            Manage your subscription, billing information, and payment history
          </p>
        </div>

        <Tabs defaultValue="plans" className="space-y-8">
          <TabsList className="bg-navy-800 border-navy-600 mx-auto">
            <TabsTrigger value="plans" className="data-[state=active]:bg-orange-600">Subscription Plans</TabsTrigger>
            <TabsTrigger value="payment" className="data-[state=active]:bg-orange-600">Payment Method</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-orange-600">Payment History</TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-orange-600">Billing Info</TabsTrigger>
          </TabsList>

          <TabsContent value="plans" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`bg-navy-800/50 border-navy-600 backdrop-blur-sm cursor-pointer transition-all hover:border-orange-600 ${
                    selectedPlan === plan.id ? 'ring-2 ring-orange-600 border-orange-600' : ''
                  } ${plan.recommended ? 'relative' : ''}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-orange-600 text-white px-4 py-1">RECOMMENDED</Badge>
                    </div>
                  )}
                  
                  <CardHeader className="text-center">
                    <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                    <div className="text-center">
                      <span className="text-4xl font-bold text-orange-400">
                        ${plan.price}
                      </span>
                      <span className="text-gray-400">/{plan.period}</span>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                          <span className="text-gray-300 text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                    
                    <Button 
                      className={`w-full ${
                        selectedPlan === plan.id 
                          ? 'bg-orange-600 hover:bg-orange-700' 
                          : 'bg-navy-700 hover:bg-navy-600'
                      }`}
                      onClick={() => setSelectedPlan(plan.id)}
                    >
                      {selectedPlan === plan.id ? 'Selected' : 'Select Plan'}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="payment" className="space-y-8">
            <div className="max-w-2xl mx-auto">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Secure Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber" className="text-white">Card Number</Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        className="bg-navy-700 border-navy-600 text-white"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry" className="text-white">Expiry Date</Label>
                        <Input
                          id="expiry"
                          placeholder="MM/YY"
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvv" className="text-white">CVV</Label>
                        <Input
                          id="cvv"
                          placeholder="123"
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="nameOnCard" className="text-white">Name on Card</Label>
                      <Input
                        id="nameOnCard"
                        placeholder="John Smith"
                        className="bg-navy-700 border-navy-600 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white">Billing Address</Label>
                      <div className="space-y-3">
                        <Input
                          placeholder="Street Address"
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            placeholder="City"
                            className="bg-navy-700 border-navy-600 text-white"
                          />
                          <Input
                            placeholder="ZIP Code"
                            className="bg-navy-700 border-navy-600 text-white"
                          />
                        </div>
                        <Select>
                          <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                            <SelectValue placeholder="State" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ca">California</SelectItem>
                            <SelectItem value="ny">New York</SelectItem>
                            <SelectItem value="tx">Texas</SelectItem>
                            <SelectItem value="fl">Florida</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-navy-700 p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-green-400" />
                      <span className="text-white font-medium">Secure Payment Processing</span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      Your payment information is encrypted and securely processed through Stripe. 
                      We never store your complete credit card details.
                    </p>
                  </div>

                  <Button 
                    className="w-full bg-orange-600 hover:bg-orange-700"
                    onClick={handlePayment}
                    disabled={processing}
                  >
                    {processing ? (
                      <>
                        <Clock className="h-4 w-4 mr-2 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <CreditCard className="h-4 w-4 mr-2" />
                        Save Payment Method
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="history" className="space-y-6">
            <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(transaction.status)}
                        <div>
                          <h3 className="text-white font-medium">{transaction.description}</h3>
                          <p className="text-gray-400 text-sm">
                            {new Date(transaction.date).toLocaleDateString()} • {transaction.method}
                          </p>
                        </div>
                      </div>
                      
                      <div className="text-right">
                        <p className="text-white font-bold">${transaction.amount}</p>
                        <p className={`text-sm ${getStatusColor(transaction.status)}`}>
                          {transaction.status.toUpperCase()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="billing" className="space-y-6">
            <div className="max-w-2xl mx-auto">
              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Billing Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="billingEmail" className="text-white">Billing Email</Label>
                        <Input
                          id="billingEmail"
                          type="email"
                          placeholder="john@company.com"
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyName" className="text-white">Company Name (Optional)</Label>
                        <Input
                          id="companyName"
                          placeholder="Your Company LLC"
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="taxId" className="text-white">Tax ID / EIN (Optional)</Label>
                      <Input
                        id="taxId"
                        placeholder="12-3456789"
                        className="bg-navy-700 border-navy-600 text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-white">Billing Address</Label>
                      <div className="space-y-3">
                        <Input
                          placeholder="Street Address"
                          className="bg-navy-700 border-navy-600 text-white"
                        />
                        <div className="grid grid-cols-3 gap-4">
                          <Input
                            placeholder="City"
                            className="bg-navy-700 border-navy-600 text-white"
                          />
                          <Input
                            placeholder="State"
                            className="bg-navy-700 border-navy-600 text-white"
                          />
                          <Input
                            placeholder="ZIP Code"
                            className="bg-navy-700 border-navy-600 text-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <Button className="w-full bg-orange-600 hover:bg-orange-700">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Update Billing Information
                  </Button>
                </CardContent>
              </Card>

              <Card className="bg-navy-800/50 border-navy-600 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-white">Current Subscription</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-navy-700 rounded-lg">
                    <div>
                      <h3 className="text-white font-medium">Accelerator Program</h3>
                      <p className="text-gray-400 text-sm">Next billing: April 20, 2024</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">$199.99/month</p>
                      <Badge className="bg-green-600">Active</Badge>
                    </div>
                  </div>
                  
                  <div className="mt-4 flex gap-3">
                    <Button variant="outline" className="flex-1 border-orange-600 text-orange-400 hover:bg-orange-600/20">
                      Change Plan
                    </Button>
                    <Button variant="outline" className="flex-1 border-red-600 text-red-400 hover:bg-red-600/20">
                      Cancel Subscription
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

export default PaymentProcessing;