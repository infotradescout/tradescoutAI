/**
 * ExchangeSellerDashboard.tsx
 *
 * Seller-only dashboard at /exchange/seller-dashboard
 * Three tabs:
 *   1. My Listings  — view all listings, mark-sold, link to detail
 *   2. Inquiries    — all incoming inquiries grouped by listing
 *   3. Conversations — open message threads with buyers
 */
import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { SEOHelmet } from "@/components/SEOHelmet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  Heart,
  MessageSquare,
  Package,
  Plus,
  Tag,
  Clock,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ChevronRight,
} from "lucide-react";
import { getExchangeCategorySlugFromMarketplaceCategoryName } from "@shared/exchangeListingRules";

// ─── Types ────────────────────────────────────────────────────────────────────
type Listing = {
  id: string;
  title: string;
  price: string | number;
  status: string;
  images: string[];
  viewCount: number;
  favoriteCount: number;
  contactCount: number;
  createdAt: string;
  category?: string;
  categoryName?: string;
  categorySlug?: string;
};

type Inquiry = {
  id: string;
  listingId: string;
  buyerId: string;
  message: string;
  offerAmount?: string | null;
  status: string;
  createdAt: string;
  listingTitle?: string;
};

type Conversation = {
  id: string;
  listingId: string;
  buyerId: string;
  sellerId: string;
  status: string;
  lastMessageAt: string;
  isReadBySeller: boolean;
  listing?: { id: string; title: string; price: string; images: string[]; status: string };
  buyer?: {
    id: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  };
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function statusBadge(status: string) {
  const map: Record<
    string,
    { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
  > = {
    active: { label: "Active", variant: "default" },
    draft: { label: "Draft", variant: "secondary" },
    pending_approval: { label: "Pending Review", variant: "outline" },
    sold: { label: "Sold", variant: "secondary" },
    expired: { label: "Expired", variant: "outline" },
    removed: { label: "Removed", variant: "destructive" },
    flagged: { label: "Flagged", variant: "destructive" },
    rejected: { label: "Rejected", variant: "destructive" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function inquiryStatusBadge(status: string) {
  const map: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800",
    replied: "bg-blue-100 text-blue-800",
    accepted: "bg-green-100 text-green-800",
    declined: "bg-red-100 text-red-800",
    completed: "bg-gray-100 text-gray-700",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded text-xs font-medium ${map[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

function formatPrice(price: string | number | null | undefined): string {
  const n = Number(price ?? 0);
  return isNaN(n) ? "—" : `$${n.toLocaleString()}`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function ListingCard({
  listing,
  onMarkSold,
  markSoldLoading,
}: {
  listing: Listing;
  onMarkSold: (id: string) => void;
  markSoldLoading: boolean;
}) {
  const thumb =
    Array.isArray(listing.images) && listing.images.length > 0 ? listing.images[0] : null;

  const slug = listing.categorySlug ?? null;
  const detailUrl = slug ? `/exchange/${slug}/${listing.id}` : null;

  return (
    <Card className="overflow-hidden">
      <div className="flex gap-3 p-4">
        {/* Thumbnail */}
        <div className="w-20 h-20 flex-shrink-0 rounded-md overflow-hidden bg-gray-100">
          {thumb ? (
            <img src={thumb} alt={listing.title} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-gray-400">
              <Package className="w-8 h-8" />
            </div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{listing.title}</p>
              <p className="text-base font-bold text-green-700 mt-0.5">
                {formatPrice(listing.price)}
              </p>
            </div>
            {statusBadge(listing.status)}
          </div>

          {/* Stats */}
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3" />
              {listing.viewCount ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" />
              {listing.favoriteCount ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <MessageSquare className="w-3 h-3" />
              {listing.contactCount ?? 0}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {timeAgo(listing.createdAt)}
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {detailUrl && (
              <Link href={detailUrl}>
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  View <ChevronRight className="w-3 h-3 ml-1" />
                </Button>
              </Link>
            )}
            {listing.status === "active" && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-green-300 text-green-700 hover:bg-green-50"
                  >
                    <CheckCircle2 className="w-3 h-3 mr-1" /> Mark Sold
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Mark as Sold?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will mark <strong>{listing.title}</strong> as sold and remove it from
                      active listings. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => onMarkSold(listing.id)}
                      disabled={markSoldLoading}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {markSoldLoading ? "Updating…" : "Yes, Mark Sold"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function InquiryRow({ inquiry }: { inquiry: Inquiry }) {
  return (
    <div className="py-3 border-b last:border-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {inquiry.listingTitle && (
            <p className="text-xs text-muted-foreground mb-0.5 truncate">
              Re: <span className="font-medium text-foreground">{inquiry.listingTitle}</span>
            </p>
          )}
          <p className="text-sm line-clamp-2">{inquiry.message}</p>
          {inquiry.offerAmount && (
            <p className="text-xs text-green-700 font-semibold mt-0.5">
              Offer: {formatPrice(inquiry.offerAmount)}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          {inquiryStatusBadge(inquiry.status)}
          <span className="text-xs text-muted-foreground">{timeAgo(inquiry.createdAt)}</span>
        </div>
      </div>
    </div>
  );
}

function ConversationRow({ conv, currentUserId }: { conv: Conversation; currentUserId: string }) {
  const other = conv.buyer;
  const otherName = other
    ? [other.firstName, other.lastName].filter(Boolean).join(" ") || "Buyer"
    : "Buyer";
  const thumb = conv.listing?.images?.[0] ?? null;
  const unread = !conv.isReadBySeller && conv.sellerId === currentUserId;

  return (
    <Link href={`/messages?thread=${conv.id}&type=marketplace`}>
      <div
        className={`flex items-center gap-3 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/30 px-2 -mx-2 rounded transition-colors ${unread ? "bg-orange-50" : ""}`}
      >
        {thumb ? (
          <img src={thumb} alt="" className="w-12 h-12 rounded object-cover flex-shrink-0" />
        ) : (
          <div className="w-12 h-12 rounded bg-gray-100 flex items-center justify-center flex-shrink-0">
            <Package className="w-5 h-5 text-gray-400" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={`text-sm font-medium truncate ${unread ? "font-bold" : ""}`}>
              {otherName}
            </p>
            <span className="text-xs text-muted-foreground flex-shrink-0 ml-2">
              {timeAgo(conv.lastMessageAt)}
            </span>
          </div>
          {conv.listing?.title && (
            <p className="text-xs text-muted-foreground truncate">{conv.listing.title}</p>
          )}
          {unread && <span className="inline-block mt-0.5 w-2 h-2 rounded-full bg-orange-500" />}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      </div>
    </Link>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function ExchangeSellerDashboard() {
  const { user, isAuthenticated } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [markSoldId, setMarkSoldId] = useState<string | null>(null);

  // Redirect unauthenticated users
  if (!isAuthenticated) {
    navigate("/auth");
    return null;
  }

  // ── Data fetching ────────────────────────────────────────────────────────
  const { data: listings = [], isLoading: listingsLoading } = useQuery<Listing[]>({
    queryKey: ["/api/marketplace/my-listings"],
    queryFn: () => apiRequest("GET", "/api/marketplace/my-listings").then((r) => r.json()),
  });

  const { data: inquiries = [], isLoading: inquiriesLoading } = useQuery<Inquiry[]>({
    queryKey: ["/api/marketplace/inquiries/received"],
    queryFn: () => apiRequest("GET", "/api/marketplace/inquiries/received").then((r) => r.json()),
  });

  const { data: conversations = [], isLoading: convsLoading } = useQuery<Conversation[]>({
    queryKey: ["/api/marketplace/conversations"],
    queryFn: () => apiRequest("GET", "/api/marketplace/conversations").then((r) => r.json()),
  });

  // Enrich inquiries with listing titles
  const listingMap = new Map(listings.map((l) => [l.id, l]));
  const enrichedInquiries: Inquiry[] = inquiries.map((inq) => ({
    ...inq,
    listingTitle: listingMap.get(inq.listingId)?.title ?? undefined,
  }));

  // ── Mark sold mutation ───────────────────────────────────────────────────
  const markSoldMutation = useMutation({
    mutationFn: (listingId: string) =>
      apiRequest("POST", `/api/marketplace/listings/${listingId}/mark-sold`).then((r) => r.json()),
    onSuccess: () => {
      toast({
        title: "Listing marked as sold",
        description: "It has been removed from active listings.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/marketplace/my-listings"] });
      setMarkSoldId(null);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to mark as sold",
        description: formatUserFacingErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  // ── Stats ────────────────────────────────────────────────────────────────
  const activeCount = listings.filter((l) => l.status === "active").length;
  const soldCount = listings.filter((l) => l.status === "sold").length;
  const pendingCount = listings.filter((l) => l.status === "pending_approval").length;
  const pendingInquiries = inquiries.filter((i) => i.status === "pending").length;
  const unreadConvs = (conversations as Conversation[]).filter(
    (c) => !c.isReadBySeller && c.sellerId === (user as any)?.id
  ).length;

  return (
    <>
      <SEOHelmet
        title="Seller Dashboard | TradeScout Exchange"
        description="Manage your Exchange listings, view buyer inquiries, and respond to messages."
        noIndex
      />

      <div className="max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link href="/exchange">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ArrowLeft className="w-4 h-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-xl font-bold">Seller Dashboard</h1>
            <p className="text-sm text-muted-foreground">Manage your Exchange listings</p>
          </div>
          <div className="ml-auto">
            <Link href="/exchange">
              <Button size="sm" className="h-8">
                <Plus className="w-4 h-4 mr-1" /> New Listing
              </Button>
            </Link>
          </div>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-green-700">{activeCount}</p>
              <p className="text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-orange-600">{pendingInquiries}</p>
              <p className="text-xs text-muted-foreground">New Inquiries</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-blue-600">{unreadConvs}</p>
              <p className="text-xs text-muted-foreground">Unread Msgs</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="listings">
          <TabsList className="w-full mb-4">
            <TabsTrigger value="listings" className="flex-1">
              Listings
              {pendingCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-4 px-1 text-xs">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="inquiries" className="flex-1">
              Inquiries
              {pendingInquiries > 0 && (
                <Badge className="ml-1.5 h-4 px-1 text-xs bg-orange-500">{pendingInquiries}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="messages" className="flex-1">
              Messages
              {unreadConvs > 0 && (
                <Badge className="ml-1.5 h-4 px-1 text-xs bg-orange-500">{unreadConvs}</Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ── My Listings ── */}
          <TabsContent value="listings">
            {listingsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
                ))}
              </div>
            ) : listings.length === 0 ? (
              <div className="text-center py-12">
                <Package className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No listings yet</p>
                <p className="text-sm text-muted-foreground mb-4">
                  Post your first item on the Exchange to get started.
                </p>
                <Link href="/exchange">
                  <Button>
                    <Plus className="w-4 h-4 mr-2" /> Create Listing
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {listings.map((listing) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    onMarkSold={(id) => markSoldMutation.mutate(id)}
                    markSoldLoading={markSoldMutation.isPending}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          {/* ── Inquiries ── */}
          <TabsContent value="inquiries">
            {inquiriesLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : enrichedInquiries.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No inquiries yet</p>
                <p className="text-sm text-muted-foreground">
                  Buyer messages will appear here once your listings go live.
                </p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-4">
                  {enrichedInquiries.map((inq) => (
                    <InquiryRow key={inq.id} inquiry={inq} />
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* ── Conversations ── */}
          <TabsContent value="messages">
            {convsLoading ? (
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-16 rounded bg-muted animate-pulse" />
                ))}
              </div>
            ) : conversations.length === 0 ? (
              <div className="text-center py-12">
                <MessageSquare className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                <p className="font-medium">No conversations yet</p>
                <p className="text-sm text-muted-foreground">
                  When a buyer starts a chat, it will appear here.
                </p>
              </div>
            ) : (
              <Card>
                <CardContent className="p-4">
                  {(conversations as Conversation[]).map((conv) => (
                    <ConversationRow
                      key={conv.id}
                      conv={conv}
                      currentUserId={(user as any)?.id ?? ""}
                    />
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}
