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
  Trophy,
  Gem,
  ShoppingBag,
  Package,
  Cpu,
  Layers3,
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
        key: "businessType",
        label: "Business Type",
        options: [
          { value: "", label: "All Types" },
          { value: "retail", label: "Retail" },
          { value: "service", label: "Service" },
          { value: "restaurant", label: "Restaurant / Food" },
          { value: "manufacturing", label: "Manufacturing" },
          { value: "franchise", label: "Franchise" },
          { value: "ecommerce", label: "E-Commerce" },
        ],
      },
      {
        key: "annualRevenueRange",
        label: "Revenue Range",
        options: [
          { value: "", label: "Any Revenue" },
          { value: "under_100k", label: "Under $100K" },
          { value: "100k_500k", label: "$100K – $500K" },
          { value: "500k_1m", label: "$500K – $1M" },
          { value: "1m_5m", label: "$1M – $5M" },
          { value: "5m_plus", label: "$5M+" },
        ],
      },
      {
        key: "ownerFinancing",
        label: "Owner Financing",
        options: [
          { value: "yes", label: "Available" },
          { value: "no", label: "Not Available" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "businessType", label: "Type" },
      { specKey: "annualRevenueRange", label: "Revenue" },
      { specKey: "yearsInOperation", label: "Yrs Operating", suffix: " yrs" },
      {
        specKey: "ownerFinancing",
        label: "Financing",
        trueValue: "yes",
        trueLabel: "Owner Financing",
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
      {
        key: "yearMin",
        label: "Year (From)",
        options: [
          { value: "", label: "Any Year" },
          { value: "2020", label: "2020+" },
          { value: "2015", label: "2015+" },
          { value: "2010", label: "2010+" },
          { value: "2005", label: "2005+" },
          { value: "2000", label: "2000+" },
          { value: "1990", label: "1990+" },
        ],
      },
      {
        key: "mileageMax",
        label: "Max Mileage",
        options: [
          { value: "", label: "Any Mileage" },
          { value: "30000", label: "Under 30K" },
          { value: "60000", label: "Under 60K" },
          { value: "100000", label: "Under 100K" },
          { value: "150000", label: "Under 150K" },
          { value: "200000", label: "Under 200K" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "year", label: "Year", isTopLevel: true },
      // brand = make at the top level
      { specKey: "brand", label: "Make", isTopLevel: true },
      { specKey: "mileage", label: "mi", suffix: " mi", isTopLevel: true },
      {
        // titleStatus is stored in specifications JSONB
        specKey: "titleStatus",
        label: "Title",
        isTopLevel: false,
        colorMap: { clean: "green", rebuilt: "yellow", salvage: "red", lien: "orange" },
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
      {
        key: "hoursMax",
        label: "Max Hours",
        options: [
          { value: "", label: "Any Hours" },
          { value: "500", label: "Under 500 hrs" },
          { value: "1000", label: "Under 1,000 hrs" },
          { value: "3000", label: "Under 3,000 hrs" },
          { value: "5000", label: "Under 5,000 hrs" },
          { value: "10000", label: "Under 10,000 hrs" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "make", label: "Make" },
      { specKey: "model", label: "Model" },
      { specKey: "year", label: "Year" },
      { specKey: "hours", label: "hrs", suffix: " hrs" },
      { specKey: "attachments", label: "Attachments" },
      {
        specKey: "inspectionReady",
        label: "Inspection",
        trueValue: "yes",
        trueLabel: "Inspection Ready",
      },
    ],
  },

  "building-materials": {
    slug: "building-materials",
    name: "Building Materials & Surfaces",
    description:
      "Profile-linked material catalogs with availability, project fit, and pricing confirmed through a managed TradeScout request.",
    icon: Layers3,
    showCondition: false,
    catalogOnly: true,
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
      {
        key: "includesChargers",
        label: "Chargers Included",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
      {
        key: "includesCase",
        label: "Case Included",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "brand", label: "Brand" },
      { specKey: "bundleCount", label: "pcs", suffix: " pcs" },
      {
        specKey: "includesBatteries",
        label: "Batteries",
        trueValue: "yes",
        trueLabel: "Batteries Incl.",
      },
      { specKey: "includesCase", label: "Case", trueValue: "yes", trueLabel: "Case Incl." },
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
      {
        key: "material",
        label: "Material",
        options: [
          { value: "", label: "Any Material" },
          { value: "wood", label: "Wood" },
          { value: "leather", label: "Leather" },
          { value: "fabric", label: "Fabric / Upholstered" },
          { value: "metal", label: "Metal" },
          { value: "glass", label: "Glass" },
          { value: "wicker", label: "Wicker / Rattan" },
        ],
      },
      {
        key: "assemblyStatus",
        label: "Assembly",
        options: [
          { value: "assembled", label: "Assembled" },
          { value: "disassembled", label: "Disassembled" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "material", label: "Material" },
      { specKey: "dimensions", label: "Size" },
      {
        specKey: "assemblyStatus",
        label: "Assembly",
        valueMap: { assembled: "Assembled", disassembled: "Disassembled" },
      },
      {
        specKey: "deliveryOption",
        label: "Delivery",
        valueMap: { pickup_only: "Pickup Only", local_delivery: "Local Delivery" },
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
      {
        key: "hoursMax",
        label: "Max Hours",
        options: [
          { value: "", label: "Any Hours" },
          { value: "500", label: "Under 500 hrs" },
          { value: "1000", label: "Under 1,000 hrs" },
          { value: "3000", label: "Under 3,000 hrs" },
          { value: "5000", label: "Under 5,000 hrs" },
        ],
      },
      {
        key: "implementType",
        label: "Implement Type",
        options: [
          { value: "", label: "All Types" },
          { value: "tractor", label: "Tractor" },
          { value: "baler", label: "Baler" },
          { value: "mower", label: "Mower" },
          { value: "tiller", label: "Tiller" },
          { value: "sprayer", label: "Sprayer" },
          { value: "planter", label: "Planter" },
          { value: "combine", label: "Combine" },
          { value: "loader", label: "Loader" },
          { value: "trailer", label: "Trailer" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "make", label: "Make" },
      { specKey: "model", label: "Model" },
      { specKey: "year", label: "Year" },
      { specKey: "hours", label: "hrs", suffix: " hrs" },
      { specKey: "implementType", label: "Type" },
      { specKey: "fieldReady", label: "Field Ready", trueValue: "yes", trueLabel: "Field Ready" },
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
      {
        key: "powerRequirements",
        label: "Power",
        options: [
          { value: "", label: "Any Power" },
          { value: "120v", label: "120V Standard" },
          { value: "240v", label: "240V" },
          { value: "3phase", label: "3-Phase" },
          { value: "battery", label: "Battery / Cordless" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "brand", label: "Brand" },
      { specKey: "model", label: "Model" },
      { specKey: "powerRequirements", label: "Power" },
      { specKey: "throughput", label: "Output" },
      {
        specKey: "installRequired",
        label: "Install",
        trueValue: "yes",
        trueLabel: "Install Required",
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
      {
        key: "storage",
        label: "Storage",
        options: [
          { value: "", label: "Any Storage" },
          { value: "64gb", label: "64GB" },
          { value: "128gb", label: "128GB" },
          { value: "256gb", label: "256GB" },
          { value: "512gb", label: "512GB" },
          { value: "1tb", label: "1TB+" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "brand", label: "Brand" },
      { specKey: "model", label: "Model" },
      { specKey: "storage", label: "Storage" },
      { specKey: "batteryHealth", label: "Battery" },
      {
        specKey: "carrierStatus",
        label: "Carrier",
        valueMap: { unlocked: "Unlocked", carrier: "Carrier", wifi_only: "Wi-Fi Only" },
      },
      { specKey: "powersOn", label: "Powers On", trueValue: "yes", trueLabel: "Powers On ✓" },
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
        key: "sport",
        label: "Sport / Activity",
        options: [
          { value: "", label: "All Sports" },
          { value: "golf", label: "Golf" },
          { value: "cycling", label: "Cycling" },
          { value: "archery", label: "Archery" },
          { value: "hunting", label: "Hunting / Fishing" },
          { value: "fitness", label: "Fitness / Gym" },
          { value: "water", label: "Water Sports" },
          { value: "winter", label: "Winter Sports" },
          { value: "team", label: "Team Sports" },
          { value: "outdoor", label: "Outdoor / Camping" },
        ],
      },
      {
        key: "competitionReady",
        label: "Competition Ready",
        options: [
          { value: "yes", label: "Yes" },
          { value: "no", label: "No" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "sport", label: "Sport" },
      { specKey: "brand", label: "Brand" },
      { specKey: "size", label: "Size" },
      {
        specKey: "competitionReady",
        label: "Competition",
        trueValue: "yes",
        trueLabel: "Competition Ready",
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
      {
        key: "yearMin",
        label: "Era (From)",
        options: [
          { value: "", label: "Any Era" },
          { value: "2000", label: "2000s+" },
          { value: "1980", label: "1980s+" },
          { value: "1960", label: "1960s+" },
          { value: "1940", label: "1940s+" },
          { value: "1900", label: "Pre-1900" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "year", label: "Year" },
      { specKey: "authenticated", label: "Auth", trueValue: "yes", trueLabel: "Authenticated ✓" },
      { specKey: "graded", label: "Graded", trueValue: "yes", trueLabel: "Graded" },
      { specKey: "grade", label: "Grade" },
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
        key: "metal",
        label: "Metal Type",
        options: [
          { value: "", label: "Any Metal" },
          { value: "gold_14k", label: "14k Gold" },
          { value: "gold_18k", label: "18k Gold" },
          { value: "gold_24k", label: "24k Gold" },
          { value: "platinum", label: "Platinum" },
          { value: "silver", label: "Sterling Silver" },
          { value: "white_gold", label: "White Gold" },
          { value: "rose_gold", label: "Rose Gold" },
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
    cardBadges: [
      { specKey: "metal", label: "Metal" },
      { specKey: "weight", label: "Weight" },
      { specKey: "stoneDetails", label: "Stone" },
      { specKey: "certified", label: "Certified", trueValue: "yes", trueLabel: "Certified ✓" },
      {
        specKey: "appraisalStatus",
        label: "Appraisal",
        trueValue: "available",
        trueLabel: "Appraisal Avail.",
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
      {
        key: "leadTime",
        label: "Lead Time",
        options: [
          { value: "", label: "Any Lead Time" },
          { value: "same_day", label: "Same Day" },
          { value: "next_day", label: "Next Day" },
          { value: "weekly", label: "Weekly" },
          { value: "custom", label: "Custom / Pre-order" },
        ],
      },
    ],
    cardBadges: [
      { specKey: "batchSize", label: "Qty" },
      { specKey: "leadTime", label: "Lead Time" },
      {
        specKey: "pickupOrDelivery",
        label: "Fulfillment",
        valueMap: { pickup: "Pickup", delivery: "Delivery", both: "Pickup & Delivery" },
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
    cardBadges: [
      { specKey: "brand", label: "Brand" },
      { specKey: "model", label: "Model" },
      { specKey: "proof", label: "Proof" },
      {
        specKey: "inspectionAvailable",
        label: "Inspection",
        trueValue: "yes",
        trueLabel: "Inspection Avail.",
      },
    ],
  },
};
