import { BriefcaseBusiness, MapPin, MessageSquare, PackageOpen, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { ShareButton } from "@/components/ShareButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buildCommunityPostPath, listCommunityPostImageUrls } from "@shared/communityPostShare";
import {
  buildHandmadeProductPath,
  listHandmadeProductImageUrls,
} from "@shared/handmadeProductShare";
import {
  buildProfileOfferExchangePath,
  buildProfileServiceOfferPath,
  listProfileOfferImageUrls,
} from "@shared/profileOfferShare";

export type CanonicalProfileOfferItem = {
  id: string;
  title: string;
  description?: string | null;
  offerType: "service" | "item";
  price: number;
  currency: string;
  serviceCategory?: string | null;
  itemStockQuantity?: number | null;
  fulfillmentMode?: string;
  metadata?: {
    itemCategory?: string;
    exchangeCategorySlug?: string;
    imageUrls?: string[];
    images?: string[];
  };
};

export type CanonicalHandmadeProductItem = {
  id: string;
  title: string;
  price: string;
  currency?: string | null;
  city?: string | null;
  stateCode?: string | null;
  imageUrls?: string[];
};

export type CanonicalCommunityPostItem = {
  id: string;
  title: string;
  content?: string;
  imageUrls?: string[];
  category?: string | null;
  createdAt?: string | null;
};

export type CanonicalProfileItems = {
  offers?: CanonicalProfileOfferItem[];
  handmadeProducts?: CanonicalHandmadeProductItem[];
  communityPosts?: CanonicalCommunityPostItem[];
};

type PublicProfileItemsProps = {
  items?: CanonicalProfileItems | null;
  profileSections?: {
    services?: boolean;
    marketplaceListings?: boolean;
    communityActivity?: boolean;
  } | null;
  className?: string;
};

function formatMoney(value: unknown, currency = "USD"): string {
  const amount = Number(value);
  const safeCurrency = /^[A-Z]{3}$/.test(currency.toUpperCase()) ? currency.toUpperCase() : "USD";
  if (!Number.isFinite(amount)) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: safeCurrency,
  }).format(amount);
}

export function PublicProfileItems({
  items,
  profileSections,
  className = "",
}: PublicProfileItemsProps) {
  const offers = Array.isArray(items?.offers) ? items.offers : [];
  const handmadeProducts = Array.isArray(items?.handmadeProducts) ? items.handmadeProducts : [];
  const communityPosts = Array.isArray(items?.communityPosts) ? items.communityPosts : [];
  const visibleOffers = offers.filter((offer) =>
    offer.offerType === "service"
      ? profileSections?.services !== false
      : profileSections?.marketplaceListings !== false
  );
  const showOffers = visibleOffers.length > 0;
  const showProducts =
    profileSections?.marketplaceListings !== false && handmadeProducts.length > 0;
  const showPosts = profileSections?.communityActivity !== false && communityPosts.length > 0;
  if (!showOffers && !showProducts && !showPosts) return null;

  return (
    <div className={`space-y-6 ${className}`.trim()} data-testid="canonical-profile-items">
      {showOffers ? (
        <Card className="border-white/10 bg-tsCard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BriefcaseBusiness className="h-5 w-5 text-ts-orange" />
              Offers &amp; services
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {visibleOffers.slice(0, 8).map((offer) => {
              const destination =
                offer.offerType === "service"
                  ? buildProfileServiceOfferPath(offer.id)
                  : buildProfileOfferExchangePath(
                      offer.id,
                      offer.metadata?.exchangeCategorySlug || offer.metadata?.itemCategory
                    );
              if (!destination) return null;
              const image = listProfileOfferImageUrls(offer.metadata)[0];
              return (
                <article
                  key={offer.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
                >
                  {image ? (
                    <img
                      src={image}
                      alt={offer.title}
                      className="aspect-[16/9] w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white break-words">{offer.title}</h3>
                        {offer.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-white/70">
                            {offer.description}
                          </p>
                        ) : null}
                      </div>
                      <Badge variant="outline" className="shrink-0 border-white/20 text-white/80">
                        {offer.offerType === "service" ? "Service" : "Item"}
                      </Badge>
                    </div>
                    <p className="font-semibold text-ts-orange">
                      {formatMoney(offer.price, offer.currency)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={destination}>View</Link>
                      </Button>
                      <ShareButton
                        destination={destination}
                        title={offer.title}
                        text={
                          offer.offerType === "service"
                            ? `View ${offer.title} and continue through TradeScout's protected request flow`
                            : `View ${offer.title} on TradeScout Exchange`
                        }
                        className="border-white/20 text-white"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {showProducts ? (
        <Card className="border-white/10 bg-tsCard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <PackageOpen className="h-5 w-5 text-ts-orange" />
              Handmade products
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {handmadeProducts.slice(0, 8).map((product) => {
              const destination = buildHandmadeProductPath(product.id);
              if (!destination) return null;
              const image = listHandmadeProductImageUrls({
                primaryImageUrl: product.imageUrls?.[0],
                images: product.imageUrls,
              })[0];
              const location = [product.city, product.stateCode].filter(Boolean).join(", ");
              return (
                <article
                  key={product.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
                >
                  {image ? (
                    <img
                      src={image}
                      alt={product.title}
                      className="aspect-[16/9] w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="space-y-3 p-4">
                    <div>
                      <h3 className="font-semibold text-white break-words">{product.title}</h3>
                      {location ? (
                        <p className="mt-1 flex items-center gap-1 text-xs text-white/60">
                          <MapPin className="h-3.5 w-3.5" />
                          {location}
                        </p>
                      ) : null}
                    </div>
                    <p className="font-semibold text-ts-orange">
                      {formatMoney(product.price, product.currency || "USD")}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={destination}>View</Link>
                      </Button>
                      <ShareButton
                        destination={destination}
                        title={product.title}
                        text={`View ${product.title} on TradeScout Handmade`}
                        className="border-white/20 text-white"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {showPosts ? (
        <Card className="border-white/10 bg-tsCard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <MessageSquare className="h-5 w-5 text-ts-orange" />
              Community activity
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {communityPosts.slice(0, 6).map((post) => {
              const destination = buildCommunityPostPath(post.id);
              if (!destination) return null;
              const image = listCommunityPostImageUrls(post.imageUrls)[0];
              return (
                <article
                  key={post.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
                >
                  {image ? (
                    <img
                      src={image}
                      alt={post.title}
                      className="aspect-[16/9] w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="space-y-3 p-4">
                    <div>
                      <h3 className="font-semibold text-white break-words">{post.title}</h3>
                      {post.content ? (
                        <p className="mt-1 line-clamp-2 text-sm text-white/70">{post.content}</p>
                      ) : null}
                      <p className="mt-2 text-xs text-white/50">
                        {post.createdAt
                          ? new Date(post.createdAt).toLocaleDateString()
                          : "Date unavailable"}
                        {post.category ? ` • ${post.category}` : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={destination}>View</Link>
                      </Button>
                      <ShareButton
                        destination={destination}
                        title={post.title}
                        text={post.content || `View ${post.title} on TradeScout`}
                        className="border-white/20 text-white"
                      />
                    </div>
                  </div>
                </article>
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      <div className="flex items-start gap-3 rounded-xl border border-white/10 bg-tsCard/70 p-4 text-sm text-white/70">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ts-orange" />
        <p>
          Shared items are public to view. Contact, job routing, and transactions continue through
          TradeScout&apos;s protected flows.
        </p>
      </div>
    </div>
  );
}
