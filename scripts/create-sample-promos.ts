import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { contractorPromos, contractors, users } from "../shared/schema";
import { eq } from "drizzle-orm";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function createSamplePromos() {
  console.log("Creating sample promotional campaigns...");

  // Use existing contractor IDs from the database
  const sampleContractorIds = ["elite-roofing-la", "pacific-plumbing", "sunshine-electrical"];

  // Sample promotional campaigns
  const samplePromos = [
    {
      contractorId: sampleContractorIds[0],
      title: "Winter Storm Special - 25% Off Roof Repairs",
      description: "Prepare your home for winter weather with professional roof repairs and inspections.",
      offerDetails: "Get 25% off all roof repair services including leak fixes, shingle replacement, and preventive maintenance. Free roof inspection included with any repair service. Perfect for preparing your home before the rainy season.",
      discountType: "percentage" as const,
      discountValue: "25",
      minimumJobValue: "500",
      promoCode: "WINTER25",
      maxUses: 50,
      expiresAt: new Date("2025-12-31"),
      isActive: true,
      slug: "winter-storm-special-25-off-roof-repairs",
    },
    {
      contractorId: sampleContractorIds[0],
      title: "New Roof Installation - $2000 Off",
      description: "Complete roof replacement with premium materials and 20-year warranty.",
      offerDetails: "Save $2000 on complete roof replacement installations. Includes premium asphalt shingles, underlayment, and professional installation. 20-year warranty on materials and workmanship. Free estimate and financing available.",
      discountType: "fixed_amount" as const,
      discountValue: "2000",
      minimumJobValue: "8000",
      promoCode: "NEWROOF2K",
      maxUses: 10,
      expiresAt: new Date("2025-09-30"),
      isActive: true,
      slug: "new-roof-installation-2000-off",
    },
    {
      contractorId: sampleContractorIds[1],
      title: "Emergency Plumbing - No Service Call Fee",
      description: "24/7 emergency plumbing services with waived service call fees for new customers.",
      offerDetails: "Free service call fee (normally $89) for first-time customers on any emergency plumbing repair. Available 24/7 including weekends and holidays. Upfront pricing with no hidden charges.",
      discountType: "free_service" as const,
      discountValue: "89",
      minimumJobValue: "150",
      promoCode: "EMERGENCY89",
      maxUses: 100,
      expiresAt: new Date("2025-08-31"),
      isActive: true,
      slug: "emergency-plumbing-no-service-call-fee",
    },
    {
      contractorId: sampleContractorIds[1],
      title: "Water Heater Replacement Bundle",
      description: "Complete water heater installation with free maintenance package.",
      offerDetails: "Water heater replacement including removal of old unit, installation of new energy-efficient model, and 1-year maintenance package. Includes annual tune-up and priority service scheduling.",
      discountType: "bundle_deal" as const,
      discountValue: "200",
      minimumJobValue: "1200",
      promoCode: "HEATER2025",
      maxUses: 25,
      expiresAt: new Date("2025-10-15"),
      isActive: true,
      slug: "water-heater-replacement-bundle",
    },
    {
      contractorId: sampleContractorIds[2],
      title: "Kitchen Makeover - 15% Off Full Remodel",
      description: "Transform your kitchen with our complete remodeling package and save big.",
      offerDetails: "15% off complete kitchen remodeling including cabinets, countertops, flooring, and appliance installation. Free 3D design consultation and project management included. Materials and labor covered.",
      discountType: "percentage" as const,
      discountValue: "15",
      minimumJobValue: "5000",
      promoCode: "KITCHEN15",
      maxUses: 20,
      expiresAt: new Date("2025-11-30"),
      isActive: true,
      slug: "kitchen-makeover-15-off-full-remodel",
    },
    {
      contractorId: sampleContractorIds[2],
      title: "Bathroom Renovation Package Deal",
      description: "Complete bathroom transformation with premium fixtures and finishes.",
      offerDetails: "Complete bathroom renovation package including tile work, vanity installation, plumbing fixtures, and lighting. Free upgraded faucet package (value $300) with any full bathroom remodel over $3000.",
      discountType: "bundle_deal" as const,
      discountValue: "300",
      minimumJobValue: "3000",
      promoCode: "BATH2025",
      maxUses: 15,
      expiresAt: new Date("2025-09-15"),
      isActive: true,
      slug: "bathroom-renovation-package-deal",
    }
  ];

  // Create promotional campaigns
  for (const promo of samplePromos) {
    await db.insert(contractorPromos).values(promo);
  }

  console.log("Sample promotional campaigns created successfully!");
  console.log("\nCreated promotional campaigns:");
  samplePromos.forEach((promo) => {
    console.log(`- ${promo.title}`);
    console.log(`  ${promo.discountType === 'percentage' ? promo.discountValue + '% off' : 
                   promo.discountType === 'fixed_amount' ? '$' + promo.discountValue + ' off' :
                   promo.discountType === 'free_service' ? 'Free service included' : 'Bundle deal'}`);
    console.log(`  Shareable link: /promo/${promo.slug}`);
  });
}

createSamplePromos().catch(console.error);