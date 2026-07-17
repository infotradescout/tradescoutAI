import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import {
  ArrowLeft,
  Clock3,
  MapPin,
  Package,
  Palette,
  ShieldCheck,
  ShoppingBag,
  Truck,
  UserRound,
} from "lucide-react";
import { SEOHelmet } from "@/components/SEOHelmet";
import { ShareButton } from "@/components/ShareButton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  buildHandmadeProductPath,
  listHandmadeProductImageUrls,
  normalizeHandmadeProductId,
} from "@shared/handmadeProductShare";

type HandmadeProductDetail = {
  id: string;
  sellerId: string;
  title: string;
  description: string;
  price: string;
  compareAtPrice?: string | null;
  currency?: string | null;
  materials?: string[] | null;
  dimensions?: {
    length?: number;
    width?: number;
    height?: number;
    weight?: number;
    unit?: string;
  } | null;
  colors?: string[] | null;
  customizable?: boolean | null;
  customizationOptions?: string | null;
  inStock?: boolean | null;
  quantityAvailable?: number | null;
  madeToOrder?: boolean | null;
  processingTime?: string | null;
  primaryImageUrl?: string | null;
  images?: string[] | null;
  city?: string | null;
  stateCode?: string | null;
  shippingFrom?: string | null;
  freeShipping?: boolean | null;
  shippingCost?: string | null;
  localPickupAvailable?: boolean | null;
  shipsNationwide?: boolean | null;
  featured?: boolean | null;
};

function formatMoney(value: unknown, currency = "USD"): string {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "Price unavailable";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
  }).format(amount);
}

function formatDimensions(product: HandmadeProductDetail): string {
  const dimensions = product.dimensions;
  if (!dimensions) return "";
  const unit = dimensions.unit || "in";
  const size = [dimensions.length, dimensions.width, dimensions.height]
    .filter((value) => Number.isFinite(Number(value)))
    .join(" × ");
  const weight = Number.isFinite(Number(dimensions.weight)) ? `${dimensions.weight} lb` : "";
  return [size ? `${size} ${unit}` : "", weight].filter(Boolean).join(" · ");
}

export default function HandmadeProductDetail() {
  const { id: rawProductId } = useParams<{ id: string }>();
  const productId = normalizeHandmadeProductId(rawProductId);
  const productPath = buildHandmadeProductPath(productId);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const {
    data: product,
    isLoading,
    isError,
  } = useQuery<HandmadeProductDetail>({
    queryKey: ["/api/handmade/products", productId],
    enabled: Boolean(productId),
    queryFn: async () => {
      const response = await fetch(
        `/api/handmade/products/${encodeURIComponent(productId || "")}`,
        { credentials: "include" }
      );
      if (!response.ok) throw new Error("Handmade product not found");
      return response.json();
    },
  });

  const images = useMemo(() => (product ? listHandmadeProductImageUrls(product) : []), [product]);

  useEffect(() => {
    setSelectedImageIndex(0);
  }, [productId, product?.id]);

  if (isLoading) {
    return (
      <main className="bg-app text-primary min-h-[70vh] px-4 py-10">
        <div className="mx-auto max-w-6xl animate-pulse space-y-6">
          <div className="h-10 w-48 rounded bg-white/10" />
          <div className="grid gap-8 lg:grid-cols-2">
            <div className="aspect-square rounded-2xl bg-white/10" />
            <div className="space-y-4">
              <div className="h-10 rounded bg-white/10" />
              <div className="h-7 w-36 rounded bg-white/10" />
              <div className="h-32 rounded bg-white/10" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  if (!productId || !productPath || isError || !product) {
    return (
      <main className="bg-app text-primary min-h-[70vh] px-4 py-16">
        <Card className="mx-auto max-w-xl text-center">
          <CardContent className="space-y-4 p-8">
            <ShoppingBag className="mx-auto h-12 w-12 opacity-60" />
            <h1 className="text-2xl font-bold">This Handmade item is not available</h1>
            <p className="text-sm opacity-75">
              It may have been paused, sold, archived, or removed by its maker.
            </p>
            <Button asChild variant="outline">
              <Link href="/handmade-marketplace">Browse Handmade Marketplace</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const currency = product.currency || "USD";
  const selectedImage = images[selectedImageIndex] || images[0];
  const location = [product.city, product.stateCode].filter(Boolean).join(", ");
  const dimensions = formatDimensions(product);
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.title,
    description: product.description,
    image: images,
    offers: {
      "@type": "Offer",
      price: Number(product.price).toFixed(2),
      priceCurrency: currency,
      availability: product.inStock
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock",
      url: productPath,
    },
  };

  return (
    <main className="bg-app text-primary min-h-[70vh] px-4 py-8 md:py-12">
      <SEOHelmet
        title={`${product.title} | Handmade`}
        description={product.description.slice(0, 160)}
        canonical={productPath}
        ogType="product"
        ogImage={images[0]}
        structuredData={structuredData}
      />

      <div className="mx-auto max-w-6xl">
        <Button asChild variant="ghost" className="mb-5">
          <Link href="/handmade-marketplace">
            <ArrowLeft className="h-4 w-4" />
            Handmade Marketplace
          </Link>
        </Button>

        <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(340px,0.95fr)]">
          <section className="space-y-3" aria-label="Product photos">
            <div className="ts-card flex aspect-square items-center justify-center overflow-hidden rounded-2xl border-subtle">
              {selectedImage ? (
                <img
                  src={selectedImage}
                  alt={product.title}
                  className="h-full w-full object-contain"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 opacity-60">
                  <ShoppingBag className="h-16 w-16" />
                  <span>No product photo available</span>
                </div>
              )}
            </div>
            {images.length > 1 ? (
              <div className="grid grid-cols-5 gap-2 sm:grid-cols-6">
                {images.map((image, index) => (
                  <button
                    key={image}
                    type="button"
                    onClick={() => setSelectedImageIndex(index)}
                    className={`aspect-square overflow-hidden rounded-lg border-2 transition ${
                      selectedImageIndex === index
                        ? "border-ts-orange"
                        : "border-transparent opacity-75 hover:opacity-100"
                    }`}
                    aria-label={`View product photo ${index + 1}`}
                  >
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            ) : null}
          </section>

          <section className="space-y-6">
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2">
                {product.featured ? <Badge>Featured</Badge> : null}
                <Badge variant="outline">Handmade</Badge>
                <Badge variant={product.inStock ? "secondary" : "outline"}>
                  {product.inStock ? "Available" : "Out of stock"}
                </Badge>
              </div>
              <h1 className="text-3xl font-bold tracking-tight md:text-4xl">{product.title}</h1>
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-3xl font-bold text-ts-orange">
                  {formatMoney(product.price, currency)}
                </span>
                {product.compareAtPrice ? (
                  <span className="text-base line-through opacity-60">
                    {formatMoney(product.compareAtPrice, currency)}
                  </span>
                ) : null}
              </div>
              {location ? (
                <p className="flex items-center gap-2 text-sm opacity-75">
                  <MapPin className="h-4 w-4" />
                  {location}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <ShareButton
                destination={productPath}
                title={product.title}
                text={`View ${product.title} on TradeScout Handmade`}
                variant="default"
              />
              <Button asChild variant="outline">
                <Link href={`/profile/${encodeURIComponent(product.sellerId)}`}>
                  <UserRound className="h-4 w-4" />
                  View maker profile
                </Link>
              </Button>
            </div>

            <Card>
              <CardContent className="space-y-3 p-5">
                <h2 className="text-lg font-semibold">About this item</h2>
                <p className="whitespace-pre-wrap text-sm leading-6 opacity-85">
                  {product.description}
                </p>
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-2">
              <Card>
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <Package className="h-4 w-4 text-ts-orange" />
                    Availability
                  </div>
                  <p className="opacity-75">
                    {product.madeToOrder
                      ? "Made to order"
                      : product.quantityAvailable != null
                        ? `${product.quantityAvailable} available`
                        : product.inStock
                          ? "In stock"
                          : "Out of stock"}
                  </p>
                  {product.processingTime ? (
                    <p className="flex items-center gap-2 opacity-75">
                      <Clock3 className="h-4 w-4" />
                      {product.processingTime}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
              <Card>
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <Truck className="h-4 w-4 text-ts-orange" />
                    Delivery
                  </div>
                  <p className="opacity-75">
                    {product.freeShipping
                      ? "Free shipping"
                      : product.shippingCost
                        ? `${formatMoney(product.shippingCost, currency)} shipping`
                        : "Shipping details from the maker"}
                  </p>
                  {product.localPickupAvailable ? (
                    <p className="opacity-75">Local pickup available</p>
                  ) : null}
                  {product.shippingFrom ? (
                    <p className="opacity-75">Ships from {product.shippingFrom}</p>
                  ) : null}
                </CardContent>
              </Card>
            </div>

            {product.materials?.length || product.colors?.length || dimensions ? (
              <Card>
                <CardContent className="space-y-4 p-5 text-sm">
                  {product.materials?.length ? (
                    <div>
                      <p className="mb-2 font-semibold">Materials</p>
                      <div className="flex flex-wrap gap-2">
                        {product.materials.map((material) => (
                          <Badge key={material} variant="secondary">
                            {material}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  {product.colors?.length ? (
                    <p className="flex items-start gap-2">
                      <Palette className="mt-0.5 h-4 w-4 text-ts-orange" />
                      <span>
                        <strong>Colors:</strong> {product.colors.join(", ")}
                      </span>
                    </p>
                  ) : null}
                  {dimensions ? (
                    <p>
                      <strong>Dimensions:</strong> {dimensions}
                    </p>
                  ) : null}
                  {product.customizable ? (
                    <p>
                      <strong>Customization:</strong>{" "}
                      {product.customizationOptions || "Ask the maker about available options."}
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <div className="rounded-xl border border-ts-orange/30 bg-ts-orange/10 p-4 text-sm">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ts-orange" />
                <div>
                  <p className="font-semibold">Connection without compromise</p>
                  <p className="mt-1 opacity-80">
                    Sharing this item does not expose the maker&apos;s contact information. Open the
                    maker&apos;s TradeScout profile when you are ready to continue through the
                    protected request path.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
