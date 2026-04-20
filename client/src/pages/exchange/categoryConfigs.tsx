/**
 * categoryConfigs.tsx
 *
 * One config object per Exchange category.
 * Each config drives its dedicated route page (ExchangeCategoryPage).
 */

import {
  Briefcase,
  Car,
  HardHat,
  Wrench,
  Sofa,
  Tractor,
  Monitor,
  Trophy,
  Gem,
  Coins,
  ShoppingBag,
  Package,
  Cpu,
} from "lucide-react";
import type { CategoryConfig } from "./ExchangeCategoryPage";

export const CATEGORY_CONFIGS: Record<string, CategoryConfig> = {
  business: {
    slug: "business",
    name: "Sell Your Business",
    description: "Buy or sell complete businesses, franchises, and brand assets locally.",
    icon: Briefcase,
    showCondition: false,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-50000", label: "Under $50K" },
      { value: "50000-250000", label: "$50K – $250K" },
      { value: "250000-1000000", label: "$250K – $1M" },
      { value: "1000000-5000000", label: "$1M – $5M" },
      { value: "5000000+", label: "$5M+" },
    ],
    extraFilters: [
      {
        key: "annualRevenueRange",
        label: "Revenue Range",
        options: [
          { value: "under_100k", label: "Under $100K" },
          { value: "100k_500k", label: "$100K – $500K" },
          { value: "500k_1m", label: "$500K – $1M" },
          { value: "1m_5m", label: "$1M – $5M" },
          { value: "5m_plus", label: "$5M+" },
        ],
      },
    ],
  },

  vehicles: {
    slug: "vehicles",
    name: "Vehicles",
    description: "Cars, trucks, motorcycles, boats, and more — buy and sell locally.",
    icon: Car,
    showCondition: true,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-5000", label: "Under $5K" },
      { value: "5000-15000", label: "$5K – $15K" },
      { value: "15000-35000", label: "$15K – $35K" },
      { value: "35000-75000", label: "$35K – $75K" },
      { value: "75000+", label: "$75K+" },
    ],
    extraFilters: [
      {
        key: "titleStatus",
        label: "Title Status",
        options: [
          { value: "clean", label: "Clean" },
          { value: "rebuilt", label: "Rebuilt" },
          { value: "salvage", label: "Salvage" },
          { value: "lien", label: "Lien" },
        ],
      },
    ],
  },

  construction: {
    slug: "construction",
    name: "Construction Equipment",
    description: "Heavy machinery, excavators, lifts, and construction equipment.",
    icon: HardHat,
    showCondition: true,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-10000", label: "Under $10K" },
      { value: "10000-50000", label: "$10K – $50K" },
      { value: "50000-150000", label: "$50K – $150K" },
      { value: "150000-500000", label: "$150K – $500K" },
      { value: "500000+", label: "$500K+" },
    ],
    extraFilters: [
      {
        key: "inspectionReady",
        label: "Inspection Ready",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },

  tools: {
    slug: "tools",
    name: "Tools & Hardware",
    description: "Professional tools, hand tools, power tools, and hardware.",
    icon: Wrench,
    showCondition: true,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-100", label: "Under $100" },
      { value: "100-500", label: "$100 – $500" },
      { value: "500-2000", label: "$500 – $2K" },
      { value: "2000-10000", label: "$2K – $10K" },
      { value: "10000+", label: "$10K+" },
    ],
    extraFilters: [
      {
        key: "includesBatteries",
        label: "Batteries Included",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },

  furniture: {
    slug: "furniture",
    name: "Furniture & Home Goods",
    description: "Quality furniture, home décor, and household goods.",
    icon: Sofa,
    showCondition: true,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-200", label: "Under $200" },
      { value: "200-1000", label: "$200 – $1K" },
      { value: "1000-5000", label: "$1K – $5K" },
      { value: "5000+", label: "$5K+" },
    ],
    extraFilters: [
      {
        key: "deliveryOption",
        label: "Delivery",
        options: [
          { value: "pickup_only", label: "Pickup Only" },
          { value: "local_delivery", label: "Local Delivery" },
        ],
      },
    ],
  },

  farm: {
    slug: "farm",
    name: "Farm Equipment",
    description: "Tractors, farm equipment, implements, and agricultural machinery.",
    icon: Tractor,
    showCondition: true,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-5000", label: "Under $5K" },
      { value: "5000-25000", label: "$5K – $25K" },
      { value: "25000-100000", label: "$25K – $100K" },
      { value: "100000+", label: "$100K+" },
    ],
    extraFilters: [
      {
        key: "fieldReady",
        label: "Field Ready",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },

  "business-equipment": {
    slug: "business-equipment",
    name: "Business Equipment",
    description: "Office equipment, commercial appliances, and business assets.",
    icon: Briefcase,
    showCondition: true,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-1000", label: "Under $1K" },
      { value: "1000-10000", label: "$1K – $10K" },
      { value: "10000-50000", label: "$10K – $50K" },
      { value: "50000+", label: "$50K+" },
    ],
    extraFilters: [
      {
        key: "installRequired",
        label: "Install Required",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },

  electronics: {
    slug: "electronics",
    name: "Electronics & Technology",
    description: "Laptops, phones, audio gear, and high-end electronics.",
    icon: Cpu,
    showCondition: true,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-200", label: "Under $200" },
      { value: "200-1000", label: "$200 – $1K" },
      { value: "1000-5000", label: "$1K – $5K" },
      { value: "5000+", label: "$5K+" },
    ],
    extraFilters: [
      {
        key: "powersOn",
        label: "Powers On",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "carrierStatus",
        label: "Carrier Status",
        options: [
          { value: "unlocked", label: "Unlocked" },
          { value: "carrier", label: "Carrier Locked" },
          { value: "wifi_only", label: "Wi-Fi Only" },
        ],
      },
    ],
  },

  sports: {
    slug: "sports",
    name: "Sports & Recreation",
    description: "Premium sports equipment, fitness gear, and outdoor recreation.",
    icon: Trophy,
    showCondition: true,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-100", label: "Under $100" },
      { value: "100-500", label: "$100 – $500" },
      { value: "500-2000", label: "$500 – $2K" },
      { value: "2000+", label: "$2K+" },
    ],
    extraFilters: [
      {
        key: "competitionReady",
        label: "Competition Ready",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },

  collectibles: {
    slug: "collectibles",
    name: "Art & Collectibles",
    description: "Artwork, antiques, coins, and authenticated collectibles.",
    icon: Gem,
    showCondition: false,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-500", label: "Under $500" },
      { value: "500-5000", label: "$500 – $5K" },
      { value: "5000-25000", label: "$5K – $25K" },
      { value: "25000+", label: "$25K+" },
    ],
    extraFilters: [
      {
        key: "authenticated",
        label: "Authenticated",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "graded",
        label: "Graded",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },

  jewelry: {
    slug: "jewelry",
    name: "Jewelry & Luxury Items",
    description: "Fine jewelry, luxury watches, and certified gems.",
    icon: Gem,
    showCondition: false,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-500", label: "Under $500" },
      { value: "500-5000", label: "$500 – $5K" },
      { value: "5000-25000", label: "$5K – $25K" },
      { value: "25000+", label: "$25K+" },
    ],
    extraFilters: [
      {
        key: "certified",
        label: "Certified",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "handoff",
        label: "Handoff Method",
        options: [
          { value: "secure_meetup", label: "Secure Meetup" },
          { value: "insured_shipping", label: "Insured Shipping" },
        ],
      },
    ],
  },

  "local-food": {
    slug: "local-food",
    name: "Local Food & Artisan Goods",
    description: "Local foods, artisan goods, handmade products, and farmers market items.",
    icon: ShoppingBag,
    showCondition: false,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-50", label: "Under $50" },
      { value: "50-200", label: "$50 – $200" },
      { value: "200-1000", label: "$200 – $1K" },
      { value: "1000+", label: "$1K+" },
    ],
    extraFilters: [
      {
        key: "pickupOrDelivery",
        label: "Fulfillment",
        options: [
          { value: "pickup", label: "Pickup" },
          { value: "delivery", label: "Delivery" },
          { value: "both", label: "Both" },
        ],
      },
    ],
  },

  other: {
    slug: "other",
    name: "Other High-Value Items",
    description: "Premium and high-value items that don't fit other categories.",
    icon: Package,
    showCondition: true,
    priceRanges: [
      { value: "", label: "Any Price" },
      { value: "0-500", label: "Under $500" },
      { value: "500-5000", label: "$500 – $5K" },
      { value: "5000-25000", label: "$5K – $25K" },
      { value: "25000+", label: "$25K+" },
    ],
    extraFilters: [
      {
        key: "inspectionAvailable",
        label: "Inspection Available",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
  },
};
