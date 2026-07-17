import {
  BadgePercent,
  BriefcaseBusiness,
  House,
  MapPin,
  MessageSquare,
  PackageOpen,
  ShieldCheck,
  ShoppingBag,
} from "lucide-react";
import { Link } from "wouter";
import { ShareButton } from "@/components/ShareButton";
import { PublicProfileProductCard } from "@/components/profile/PublicProfileProductCard";
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
import type { PublicBusinessListingCard } from "@shared/publicBusinessListing";
import type { PublicHomeScoutListingCard } from "@shared/homeScoutListingShare";
import type { PublicContractorPromoCard } from "@shared/contractorPromoShare";

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
  marketplaceListings?: PublicBusinessListingCard[];
  homeScoutListings?: PublicHomeScoutListingCard[];
  contractorPromos?: PublicContractorPromoCard[];
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
  if (!Number.isFinite(amount)) return "Ask for price";
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
  const marketplaceListings = Array.isArray(items?.marketplaceListings)
    ? items.marketplaceListings
    : [];
  const homeScoutListings = Array.isArray(items?.homeScoutListings) ? items.homeScoutListings : [];
  const contractorPromos = Array.isArray(items?.contractorPromos) ? items.contractorPromos : [];
  const communityPosts = Array.isArray(items?.communityPosts) ? items.communityPosts : [];
  const serviceOffers = offers.filter(
    (offer) => offer.offerType === "service" && profileSections?.services !== false
  );
  const productOffers = offers.filter(
    (offer) => offer.offerType === "item" && profileSections?.marketplaceListings !== false
  );
  const showServiceOffers = serviceOffers.length > 0;
  const showProfileProducts = productOffers.length > 0;
  const showHandmadeProducts =
    profileSections?.marketplaceListings !== false && handmadeProducts.length > 0;
  const showMarketplaceListings =
    profileSections?.marketplaceListings !== false && marketplaceListings.length > 0;
  const showHomeScoutListings =
    profileSections?.marketplaceListings !== false && homeScoutListings.length > 0;
  const showContractorPromos = profileSections?.services !== false && contractorPromos.length > 0;
  const showPosts = profileSections?.communityActivity !== false && communityPosts.length > 0;
  if (
    !showServiceOffers &&
    !showProfileProducts &&
    !showHandmadeProducts &&
    !showMarketplaceListings &&
    !showHomeScoutListings &&
    !showContractorPromos &&
    !showPosts
  )
    return null;

  return (
    <div className={`space-y-6 ${className}`.trim()} data-testid="canonical-profile-items">
      {showContractorPromos ? (
        <Card className="border-white/10 bg-tsCard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BadgePercent className="h-5 w-5 text-ts-orange" />
              Promotions
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {contractorPromos.slice(0, 6).map((promo) => (
              <article
                key={promo.slug}
                className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
              >
                {promo.imageUrl ? (
                  <img
                    src={promo.imageUrl}
                    alt={promo.title}
                    className="aspect-[16/9] w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                <div className="space-y-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-white break-words">{promo.title}</h3>
                      {promo.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-white/70">
                          {promo.description}
                        </p>
                      ) : null}
                    </div>
                    <Badge variant="outline" className="shrink-0 border-white/20 text-white/80">
                      {promo.discountLabel}
                    </Badge>
                  </div>
                  {promo.expiresAt ? (
                    <p className="text-xs text-white/55">
                      Valid through {new Date(promo.expiresAt).toLocaleDateString()}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href={promo.detailPath}>View</Link>
                    </Button>
                    <ShareButton
                      destination={promo.detailPath}
                      title={promo.title}
                      text={`See ${promo.title} and ask the business about it`}
                      className="border-white/20 text-white"
                    />
                  </div>
                </div>
              </article>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {showServiceOffers ? (
        <Card className="border-white/10 bg-tsCard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <BriefcaseBusiness className="h-5 w-5 text-ts-orange" />
              Services
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {serviceOffers.slice(0, 8).map((offer) => {
              const destination = buildProfileServiceOfferPath(offer.id);
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
                        Service
                      </Badge>
                    </div>
                    <p className="font-semibold text-ts-orange">
                      {formatMoney(offer.price, offer.currency)}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={destination}>View service</Link>
                      </Button>
                      <ShareButton
                        destination={destination}
                        title={offer.title}
                        text={`See ${offer.title} and make a private request`}
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

      {showProfileProducts ? (
        <Card className="border-white/10 bg-tsCard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <PackageOpen className="h-5 w-5 text-ts-orange" />
              Products &amp; inventory
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            {productOffers.slice(0, 8).map((offer) => {
              const destination = buildProfileOfferExchangePath(
                offer.id,
                offer.metadata?.exchangeCategorySlug || offer.metadata?.itemCategory
              );
              if (!destination) return null;
              const image = listProfileOfferImageUrls(offer.metadata)[0];
              const hasStockCount =
                offer.itemStockQuantity !== null &&
                offer.itemStockQuantity !== undefined &&
                Number.isFinite(Number(offer.itemStockQuantity));
              const stock = hasStockCount ? Number(offer.itemStockQuantity) : null;
              const availability =
                stock === null ? null : stock > 0 ? `${stock} available` : "Currently unavailable";
              return (
                <PublicProfileProductCard
                  key={offer.id}
                  title={offer.title}
                  description={offer.description}
                  destination={destination}
                  imageUrl={image}
                  price={formatMoney(offer.price, offer.currency)}
                  eyebrow={offer.metadata?.itemCategory || "Inventory"}
                  availability={availability}
                  shareText={`View ${offer.title} on TradeScout Exchange`}
                />
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {showHomeScoutListings ? (
        <Card className="border-white/10 bg-tsCard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <House className="h-5 w-5 text-ts-orange" />
              Properties
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {homeScoutListings.slice(0, 6).map((listing) => {
              const location = [listing.city, listing.stateCode].filter(Boolean).join(", ");
              const facts = [
                listing.beds != null ? `${listing.beds} bd` : null,
                listing.baths != null ? `${listing.baths} ba` : null,
                listing.sqft != null ? `${listing.sqft.toLocaleString()} sq ft` : null,
              ].filter(Boolean);
              return (
                <article
                  key={listing.id}
                  className="overflow-hidden rounded-xl border border-white/10 bg-black/20"
                >
                  {listing.imageUrl ? (
                    <img
                      src={listing.imageUrl}
                      alt={listing.title}
                      className="aspect-[16/9] w-full object-cover"
                      loading="lazy"
                    />
                  ) : null}
                  <div className="space-y-3 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-white break-words">{listing.title}</h3>
                        {listing.description ? (
                          <p className="mt-1 line-clamp-2 text-sm text-white/70">
                            {listing.description}
                          </p>
                        ) : null}
                        {location ? (
                          <p className="mt-2 flex items-center gap-1 text-xs text-white/60">
                            <MapPin className="h-3.5 w-3.5" />
                            {location}
                          </p>
                        ) : null}
                        {facts.length > 0 ? (
                          <p className="mt-1 text-xs text-white/60">{facts.join(" • ")}</p>
                        ) : null}
                      </div>
                      <Badge variant="outline" className="shrink-0 border-white/20 text-white/80">
                        {listing.propertyType.replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="font-semibold text-ts-orange">{formatMoney(listing.price)}</p>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={listing.detailPath}>View</Link>
                      </Button>
                      <ShareButton
                        destination={listing.detailPath}
                        title={listing.title}
                        text={`View ${listing.title} on TradeScout HomeScout`}
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

      {showMarketplaceListings ? (
        <Card className="border-white/10 bg-tsCard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <ShoppingBag className="h-5 w-5 text-ts-orange" />
              Exchange inventory
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            {marketplaceListings.slice(0, 6).map((listing) => {
              const location = [listing.county, listing.state].filter(Boolean).join(", ");
              return (
                <PublicProfileProductCard
                  key={listing.id}
                  title={listing.title}
                  description={listing.description}
                  destination={listing.detailPath}
                  imageUrl={listing.imageUrl}
                  price={formatMoney(listing.price)}
                  eyebrow={listing.categoryName || "Exchange"}
                  location={location}
                  shareText={`View ${listing.title} on TradeScout Exchange`}
                  actionLabel="View listing"
                />
              );
            })}
          </CardContent>
        </Card>
      ) : null}

      {showHandmadeProducts ? (
        <Card className="border-white/10 bg-tsCard">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <PackageOpen className="h-5 w-5 text-ts-orange" />
              Handmade products
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-5 md:grid-cols-2">
            {handmadeProducts.slice(0, 8).map((product) => {
              const destination = buildHandmadeProductPath(product.id);
              if (!destination) return null;
              const image = listHandmadeProductImageUrls({
                primaryImageUrl: product.imageUrls?.[0],
                images: product.imageUrls,
              })[0];
              const location = [product.city, product.stateCode].filter(Boolean).join(", ");
              return (
                <PublicProfileProductCard
                  key={product.id}
                  title={product.title}
                  destination={destination}
                  imageUrl={image}
                  price={formatMoney(product.price, product.currency || "USD")}
                  eyebrow="Handmade"
                  location={location}
                  shareText={`View ${product.title} on TradeScout Handmade`}
                  actionLabel="View product"
                />
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
                          : "Recently"}
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
          See something you like? Open it to learn more or send a request. Your contact details stay
          private until you choose to connect.
        </p>
      </div>
    </div>
  );
}
