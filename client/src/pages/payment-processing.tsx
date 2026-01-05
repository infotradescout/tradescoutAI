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
        return <CheckCircle2 className="h-4 w-4 text-tsSuccess" />;
      case 'pending':
        return <Clock className="h-4 w-4 text-tsWarning" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-tsError" />;
      default:
        return <AlertTriangle className="h-4 w-4 text-tsTextMuted" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'text-tsSuccess';
      case 'pending':
        return 'text-tsWarning';
      case 'failed':
        return 'text-tsError';
      default:
        return 'text-tsTextMuted';
    }
  };

  return (
    <div className="h-full bg-background text-foreground">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <CreditCard className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-foreground">Payment & Billing</h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Manage your subscription, billing information, and payment history
          </p>
        </div>
        <Tabs defaultValue="plans" className="space-y-8">
          <TabsList className="bg-muted border-border mx-auto">
            <TabsTrigger value="plans" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Subscription Plans</TabsTrigger>
            <TabsTrigger value="payment" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Payment Method</TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Payment History</TabsTrigger>
            <TabsTrigger value="billing" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Billing Info</TabsTrigger>
          </TabsList>
          <TabsContent value="plans" className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`bg-tsCard border-tsBorder backdrop-blur-sm cursor-pointer transition-all hover:border-tsWarning ${
                    selectedPlan === plan.id ? 'ring-2 ring-tsWarning border-tsWarning' : ''
                  } ${plan.recommended ? 'relative' : ''}`}
                  onClick={() => setSelectedPlan(plan.id)}
                >
                  {plan.recommended && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <Badge className="bg-tsWarning text-tsText px-4 py-1">RECOMMENDED</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center">
                    <CardTitle className="text-tsText text-xl">{plan.name}</CardTitle>
                    <div className="text-center">
                      <span className="text-4xl font-bold text-tsWarning">
                        ${plan.price}
                      </span>
                      <span className="text-tsTextSecondary">/{plan.period}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-tsSuccess" />
                          <span className="text-tsTextSecondary text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                    <Button 
                      className={`w-full ${
                        selectedPlan === plan.id 
                          ? 'bg-tsWarning hover:bg-tsWarning/80' 
                          : 'bg-tsCard hover:bg-tsCardMuted'
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
              <Card className="bg-tsCard border-tsBorder backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-tsText flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Secure Payment Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber" className="text-tsText">Card Number</Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        className="bg-tsCardMuted border-tsBorder text-tsText"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expiry" className="text-tsText">Expiry Date</Label>
                        <Input
                          id="expiry"
                          placeholder="MM/YY"
                          className="bg-tsCardMuted border-tsBorder text-tsText"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="cvv" className="text-tsText">CVV</Label>
                        <Input
                          id="cvv"
                          placeholder="123"
                          className="bg-tsCardMuted border-tsBorder text-tsText"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="nameOnCard" className="text-tsText">Name on Card</Label>
                      <Input
                        id="nameOnCard"
                        placeholder="John Smith"
                        className="bg-tsCardMuted border-tsBorder text-tsText"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-tsText">Billing Address</Label>
                      <div className="space-y-3">
                        <Input
                          placeholder="Street Address"
                          className="bg-tsCardMuted border-tsBorder text-tsText"
                        />
                        <div className="grid grid-cols-2 gap-4">
                          <Input
                            placeholder="City"
                            className="bg-tsCardMuted border-tsBorder text-tsText"
                          />
                          <Input
                            placeholder="ZIP Code"
                            className="bg-tsCardMuted border-tsBorder text-tsText"
                          />
                        </div>
                        <Select>
                          <SelectTrigger className="bg-tsCardMuted border-tsBorder text-tsText">
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
                  <div className="bg-tsCardMuted p-4 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Shield className="h-4 w-4 text-tsSuccess" />
                      <span className="text-tsText font-medium">Secure Payment Processing</span>
                    </div>
                    <p className="text-tsTextSecondary text-sm">
                      Your payment information is encrypted and securely processed through Stripe. 
                      We never store your complete credit card details.
                    </p>
                  </div>
                  <Button 
                    className="w-full bg-tsWarning hover:bg-tsWarning/80"
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
            <Card className="bg-tsCard border-tsBorder backdrop-blur-sm">
              <CardHeader>
                <CardTitle className="text-tsText flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  Recent Transactions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentTransactions.map((transaction) => (
                    <div key={transaction.id} className="flex items-center justify-between p-4 bg-tsCardMuted rounded-lg">
                      <div className="flex items-center gap-4">
                        {getStatusIcon(transaction.status)}
                        <div>
                          <h3 className="text-tsText font-medium">{transaction.description}</h3>
                          <p className="text-tsTextSecondary text-sm">
                            {new Date(transaction.date).toLocaleDateString()} • {transaction.method}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-tsText font-bold">${transaction.amount}</p>
                        <p className={`text-sm ${getStatusColor(transaction.status)}`}>{transaction.status.toUpperCase()}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="billing" className="space-y-6">
            <div className="max-w-2xl mx-auto">
              <Card className="bg-tsCard border-tsBorder backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-tsText">Billing Information</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="billingEmail" className="text-tsText">Billing Email</Label>
                        <Input
                          id="billingEmail"
                          type="email"
                          placeholder="john@company.com"
                          className="bg-tsCardMuted border-tsBorder text-tsText"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="companyName" className="text-tsText">Company Name (Optional)</Label>
                        <Input
                          id="companyName"
                          placeholder="Your Company LLC"
                          className="bg-tsCardMuted border-tsBorder text-tsText"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="taxId" className="text-tsText">Tax ID / EIN (Optional)</Label>
                      <Input
                        id="taxId"
                        placeholder="12-3456789"
                        className="bg-tsCardMuted border-tsBorder text-tsText"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label className="text-tsText">Billing Address</Label>
                      <div className="space-y-3">
                        <Input
                          placeholder="Street Address"
                          className="bg-tsCardMuted border-tsBorder text-tsText"
                        />
                        <div className="grid grid-cols-3 gap-4">
                          <Input
                            placeholder="City"
                            className="bg-tsCardMuted border-tsBorder text-tsText"
                          />
                          <Input
                            placeholder="State"
                            className="bg-tsCardMuted border-tsBorder text-tsText"
                          />
                          <Input
                            placeholder="ZIP Code"
                            className="bg-tsCardMuted border-tsBorder text-tsText"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button className="w-full bg-tsWarning hover:bg-tsWarning/80">
                    <DollarSign className="h-4 w-4 mr-2" />
                    Update Billing Information
                  </Button>
                </CardContent>
              </Card>
              <Card className="bg-tsCard border-tsBorder backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-tsText">Current Subscription</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between p-4 bg-tsCardMuted rounded-lg">
                    <div>
                      <h3 className="text-tsText font-medium">Accelerator Program</h3>
                      <p className="text-tsTextSecondary text-sm">Next billing: April 20, 2024</p>
                    </div>
                    <div className="text-right">
                      <p className="text-tsText font-bold">$199.99/month</p>
                      <Badge className="bg-tsSuccess">Active</Badge>
                    </div>
                  </div>
                  <div className="mt-4 flex gap-3">
                    <Button variant="outline" className="flex-1 border-tsWarning text-tsWarning hover:bg-tsWarning/20">
                      Change Plan
                    </Button>
                    <Button variant="outline" className="flex-1 border-tsError text-tsError hover:bg-tsError/20">
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