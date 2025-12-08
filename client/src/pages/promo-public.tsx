import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { Phone, Mail, Globe, Star, Shield, Calendar, DollarSign, MapPin, Clock, Award } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";

// Extend Window for gtag
declare global {
  interface Window {
    gtag?: (event: string, action: string, params: any) => void;
  }
}

interface PromoData {
  promo: {
    id: string;
    title: string;
    description: string;
    offerDetails: string;
    discountType: string;
    discountValue: string;
    minimumJobValue?: string;
    promoCode?: string;
    expiresAt?: string;
    slug: string;
  };
  contractor: {
    id: string;
    companyName: string;
    slug: string;
    phone?: string;
    email?: string;
    about?: string;
    photos?: string[];
    yearsInBusiness?: number;
    verifiedLicensed: boolean;
    verifiedInsured: boolean;
  import EmptyState from "@/components/EmptyState";

  export default function PromoPublic() {
    return <EmptyState title="Promotions" message="No data available yet." />;
  }