import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { Link } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { 
  CreditCard, 
  DollarSign, 
  Calendar, 
  User, 
  Building2,
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle,
  XCircle,
  RefreshCw
} from "lucide-react";
import { formatDistance } from "date-fns";

interface PaymentRecord {
  id: string;
  createdAt: string | Date | null;
  status: string;
  totalAmount?: number | string | null;
  description?: string | null;
  isOffPlatform?: boolean;
  [key: string]: any;
}

interface PaymentHistoryResponse {
  contractorPayments: {
    asHomeowner: PaymentRecord[];
    asContractor: PaymentRecord[];
  };
  marketplaceTransactions: {
    asBuyer: PaymentRecord[];
    asSeller: PaymentRecord[];
  };
}

interface PaymentHistoryProps {}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'completed':
      return <CheckCircle className="w-4 h-4 text-tsSuccess" />;
    case 'failed':
      return <XCircle className="w-4 h-4 text-tsError" />;
    case 'processing':
      return <RefreshCw className="w-4 h-4 text-tsWarning animate-spin" />;
    default:
      return <Clock className="w-4 h-4 text-tsWarning" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'completed':
      return 'bg-tsSuccess text-tsSuccess';
    case 'failed':
      return 'bg-tsError text-tsError';
    case 'processing':
      return 'bg-tsWarning text-tsWarning';
    default:
      return 'bg-tsWarning text-tsWarning';
  }
};

export default function PaymentHistory() {
    const { user } = useAuth();
    const isCommunityFirst = Boolean((user as any)?.communityFirst);
  const [filterType, setFilterType] = useState('all');
  
  const { data: paymentHistory, isLoading } = useQuery<PaymentHistoryResponse>({
    queryKey: ["/api/payments/history", { type: filterType }],
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const contractorPayments = paymentHistory?.contractorPayments || { asHomeowner: [], asContractor: [] };
  const marketplaceTransactions = paymentHistory?.marketplaceTransactions || { asBuyer: [], asSeller: [] };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold text-tsText">Payment History</h1>
          <p className="text-tsTextSecondary">
            Track all your payments and transactions
          </p>
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-48 bg-tsCard border-tsBorder text-tsText">
            <SelectValue placeholder="Filter payments" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            <SelectItem value="contractor">Contractor Services</SelectItem>
            <SelectItem value="marketplace">Marketplace Transactions</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4 bg-tsCard border-tsBorder">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="contractor">Contractor Payments</TabsTrigger>
          <TabsTrigger value="marketplace">Marketplace</TabsTrigger>
          <TabsTrigger value="receipts">Receipts</TabsTrigger>
        </TabsList>
        <TabsContent value="overview" className="space-y-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-tsText">Total Payments</CardTitle>
                <DollarSign className="h-4 w-4 text-tsTextMuted" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-tsText">
                  ${(
                    [...contractorPayments.asHomeowner, ...contractorPayments.asContractor]
                      .filter(p => p.status === 'completed')
                      .reduce((sum, p) => sum + Number(p.totalAmount || 0), 0) +
                    [...marketplaceTransactions.asBuyer, ...marketplaceTransactions.asSeller]
                      .filter(t => t.status === 'completed')
                      .reduce((sum, t) => sum + Number(t.totalAmount || 0), 0)
                  ).toFixed(2)}
                </div>
                <p className="text-xs text-tsTextMuted">
                  Completed transactions
                </p>
              </CardContent>
            </Card>
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-tsText">Contractor Services</CardTitle>
                <Building2 className="h-4 w-4 text-tsTextMuted" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-tsText">
                  {[...contractorPayments.asHomeowner, ...contractorPayments.asContractor].length}
                </div>
                <p className="text-xs text-tsTextMuted">
                  Service payments
                </p>
              </CardContent>
            </Card>
            <Card className="bg-tsCard border-tsBorder">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-tsText">Marketplace</CardTitle>
                <CreditCard className="h-4 w-4 text-tsTextMuted" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-tsText">
                  {[...marketplaceTransactions.asBuyer, ...marketplaceTransactions.asSeller].length}
                </div>
                <p className="text-xs text-tsTextMuted">
                  Item transactions
                </p>
              </CardContent>
            </Card>
          </div>
          {/* Recent Activity */}
          <Card className="bg-tsCard border-tsBorder">
            <CardHeader>
              <CardTitle className="text-tsText">Recent Activity</CardTitle>
              <CardDescription className="text-tsTextMuted">Your latest payment transactions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Combine and sort all recent transactions */}
                {[
                  ...contractorPayments.asHomeowner.map((p: any) => ({
                    ...p, 
                    type: 'contractor', 
                    role: 'homeowner',
                    title: `Contractor Service Payment`,
                    subtitle: `Payment to contractor`
                  })),
                  ...contractorPayments.asContractor.map((p: any) => ({
                    ...p, 
                    type: 'contractor', 
                    role: 'contractor',
                    title: `Service Payment Received`,
                    subtitle: `Payment from homeowner`
                  })),
                  ...marketplaceTransactions.asBuyer.map((t: any) => ({
                    ...t, 
                    type: 'marketplace', 
                    role: 'buyer',
                    title: `Marketplace Purchase`,
                    subtitle: `Item purchase`
                  })),
                  ...marketplaceTransactions.asSeller.map((t: any) => ({
                    ...t, 
                    type: 'marketplace', 
                    role: 'seller',
                    title: `Marketplace Sale`,
                    subtitle: `Item sold`
                  }))
                ]
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10)
                .map((transaction, index) => (
                  <div key={`${transaction.type}-${transaction.id}-${index}`} 
                       className="flex items-center space-x-4 p-4 border-tsBorder border rounded-lg hover:bg-tsCardMuted transition-colors">
                    <div className="flex-shrink-0">
                      {transaction.role === 'homeowner' || transaction.role === 'buyer' ? (
                        <ArrowUpRight className="w-5 h-5 text-tsError" />
                      ) : (
                        <ArrowDownLeft className="w-5 h-5 text-tsSuccess" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-tsText">
                        {transaction.title}
                      </p>
                      <p className="text-sm text-tsTextMuted">
                        {transaction.subtitle}
                      </p>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="text-right">
                        <p className="text-sm font-medium text-tsText">
                          ${Number(transaction.totalAmount || 0).toFixed(2)}
                        </p>
                        <p className="text-xs text-tsTextMuted">
                          {formatDistance(new Date(transaction.createdAt), new Date(), { addSuffix: true })}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {getStatusIcon(transaction.status)}
                      </div>
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </div>
                  </div>
                ))}

                {[...contractorPayments.asHomeowner, ...contractorPayments.asContractor, ...marketplaceTransactions.asBuyer, ...marketplaceTransactions.asSeller].length === 0 && (
                  <div className="text-center py-8">
                    <CreditCard className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-orange-500 mb-2">
                      {isCommunityFirst ? "No payments on record" : "No payments yet"}
                    </h3>
                    <p className="text-gray-600 dark:text-gray-300 text-sm max-w-md mx-auto">
                      {isCommunityFirst
                        ? "You don’t need to force a transaction just to fill this page. When money actually moves through TradeScout, it will show up here automatically."
                        : "Your payment history will appear here once you make your first transaction."}
                    </p>
                    {isCommunityFirst && (
                      <div className="mt-4 flex items-center justify-center gap-3 text-sm">
                        <Link href="/community">
                          <a className="text-sky-400 hover:text-sky-300">See what’s happening nearby</a>
                        </Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contractor" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payments Made (As Homeowner) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-red-500" />
                  Payments Made
                </CardTitle>
                <CardDescription>
                  Payments you've made to contractors
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {contractorPayments.asHomeowner?.map((payment: any) => (
                  <div key={payment.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">
                          Service Payment
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDistance(new Date(payment.createdAt), new Date(), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge className={getStatusColor(payment.status)}>
                        {payment.status}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">
                        ${Number(payment.totalAmount || 0).toFixed(2)}
                      </span>
                      <div className="text-right text-xs text-gray-500">
                        {payment.isOffPlatform ? 'Off-platform' : 'Platform payment'}
                      </div>
                    </div>
                    
                    {payment.description && (
                      <p className="text-sm text-gray-600 mt-2">
                        {payment.description}
                      </p>
                    )}
                  </div>
                ))}

                {contractorPayments.asHomeowner?.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No payments made to contractors yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Payments Received (As Contractor) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5 text-green-500" />
                  Payments Received
                </CardTitle>
                <CardDescription>
                  Payments you've received from homeowners
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {contractorPayments.asContractor?.map((payment: any) => (
                  <div key={payment.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">
                          Service Payment
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDistance(new Date(payment.createdAt), new Date(), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge className={getStatusColor(payment.status)}>
                        {payment.status}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-green-600">
                        +${Number(payment.totalAmount || 0).toFixed(2)}
                      </span>
                      <div className="text-right text-xs text-gray-500">
                        {payment.isOffPlatform ? 'Off-platform' : 'Platform payment'}
                      </div>
                    </div>
                    
                    {payment.description && (
                      <p className="text-sm text-gray-600 mt-2">
                        {payment.description}
                      </p>
                    )}
                  </div>
                ))}

                {contractorPayments.asContractor?.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No payments received from homeowners yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="marketplace" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Purchases (As Buyer) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowUpRight className="w-5 h-5 text-red-500" />
                  Purchases
                </CardTitle>
                <CardDescription>
                  Items you've purchased
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {marketplaceTransactions.asBuyer?.map((transaction: any) => (
                  <div key={transaction.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">
                          Marketplace Purchase
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDistance(new Date(transaction.createdAt), new Date(), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold">
                        ${Number(transaction.totalAmount || 0).toFixed(2)}
                      </span>
                      <div className="text-right text-xs text-gray-500">
                        {transaction.isOffPlatform ? 'Off-platform' : 'Platform payment'}
                      </div>
                    </div>
                  </div>
                ))}

                {marketplaceTransactions.asBuyer?.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No marketplace purchases yet
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Sales (As Seller) */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowDownLeft className="w-5 h-5 text-green-500" />
                  Sales
                </CardTitle>
                <CardDescription>
                  Items you've sold
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {marketplaceTransactions.asSeller?.map((transaction: any) => (
                  <div key={transaction.id} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">
                          Marketplace Sale
                        </p>
                        <p className="text-sm text-gray-500">
                          {formatDistance(new Date(transaction.createdAt), new Date(), { addSuffix: true })}
                        </p>
                      </div>
                      <Badge className={getStatusColor(transaction.status)}>
                        {transaction.status}
                      </Badge>
                    </div>
                    
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-green-600">
                        +${Number(transaction.totalAmount || 0).toFixed(2)}
                      </span>
                      <div className="text-right text-xs text-gray-500">
                        {transaction.isOffPlatform ? 'Off-platform' : 'Platform payment'}
                      </div>
                    </div>
                  </div>
                ))}

                {marketplaceTransactions.asSeller?.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No marketplace sales yet
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="receipts" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Download Receipts</CardTitle>
              <CardDescription>
                Generate and download receipts for your transactions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-orange-500 mb-2">
                  Receipt Generation
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4">
                  Select a date range to generate and download receipts for your transactions.
                </p>
                <Button disabled>
                  Coming Soon
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}