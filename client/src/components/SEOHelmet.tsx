import { useEffect } from 'react';
import { useLocation } from 'wouter';

interface SEOHelmetProps {
  title?: string;
  description?: string;
  keywords?: string;
  canonical?: string;
  ogType?: string;
  ogImage?: string;
  structuredData?: Record<string, any>;
  noIndex?: boolean;
}

export function SEOHelmet({
  title = "TradeScout – Scout for Contractors and Communities",
  description = "Scout, your AI project assistant, helps you find verified local contractors, compare options, and run your projects with confidence.",
  keywords = "scout, ai assistant, local contractors, home improvement, verified contractors, free quotes, trusted contractors, roofing, plumbing, electrical",
  canonical,
  ogType = "website",
  ogImage = "/icon-512.png",
  structuredData,
  noIndex = false,
}: SEOHelmetProps) {
  const [location] = useLocation();
  const currentUrl = `${window.location.origin}${location}`;
  const finalCanonical = canonical || currentUrl;

  useEffect(() => {
    // Update document title
    document.title = title;

    // Update meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('robots', noIndex ? 'noindex, nofollow' : 'index, follow');
    
    // Open Graph
    updateMetaTag('og:title', title, 'property');
    updateMetaTag('og:description', description, 'property');
    updateMetaTag('og:type', ogType, 'property');
    updateMetaTag('og:url', currentUrl, 'property');
    updateMetaTag('og:image', `${window.location.origin}${ogImage}`, 'property');
    updateMetaTag('og:site_name', 'TradeScout', 'property');
    
    // Twitter Card
    updateMetaTag('twitter:card', 'summary_large_image', 'name');
    updateMetaTag('twitter:title', title, 'name');
    updateMetaTag('twitter:description', description, 'name');
    updateMetaTag('twitter:image', `${window.location.origin}${ogImage}`, 'name');
    updateMetaTag('twitter:site', '@TradeScout', 'name');
    
    // Additional SEO tags
    updateMetaTag('theme-color', '#FF6B35', 'name');
    updateMetaTag('apple-mobile-web-app-title', 'TradeScout', 'name');
    
    // Canonical link
    updateCanonicalLink(finalCanonical);
    
    // Structured data
    if (structuredData) {
      updateStructuredData(structuredData);
    }
    
    // Clean up function
    return () => {
      // Remove structured data script if it exists
      const existingScript = document.querySelector('script[type="application/ld+json"][data-react-helmet]');
      if (existingScript) {
        existingScript.remove();
      }
    };
  }, [title, description, keywords, currentUrl, finalCanonical, ogType, ogImage, structuredData, noIndex]);

  return null;
}

function updateMetaTag(name: string, content: string, attribute: 'name' | 'property' = 'name') {
  let meta = document.querySelector(`meta[${attribute}="${name}"]`) as HTMLMetaElement;
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }
  meta.content = content;
}

function updateCanonicalLink(href: string) {
  let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = href;
}

function updateStructuredData(data: Record<string, any>) {
  // Remove existing structured data
  const existingScript = document.querySelector('script[type="application/ld+json"][data-react-helmet]');
  if (existingScript) {
    existingScript.remove();
  }
  
  // Add new structured data
  const script = document.createElement('script');
  script.type = 'application/ld+json';
  script.setAttribute('data-react-helmet', 'true');
  script.textContent = JSON.stringify(data);
  document.head.appendChild(script);
}

// Structured data generators
export const createWebsiteStructuredData = () => ({
  "@context": "https://schema.org",
  "@type": "WebSite",
  "name": "TradeScout",
  "description": "Scout, the AI assistant inside TradeScout, connects you with verified local contractors and helps you manage home projects.",
  "url": window.location.origin,
  "potentialAction": {
    "@type": "SearchAction",
    "target": `${window.location.origin}/contractors/board?search={search_term_string}`,
    "query-input": "required name=search_term_string"
  },
  "sameAs": [
    "https://facebook.com/tradescout",
    "https://twitter.com/tradescout",
    "https://linkedin.com/company/tradescout"
  ]
});

export const createOrganizationStructuredData = () => ({
  "@context": "https://schema.org",
  "@type": "Organization",
  "name": "TradeScout",
  "description": "Community operating system connecting residents, pros, organizations, and verified local contractors",
  "url": window.location.origin,
  "logo": `${window.location.origin}/logo.png`,
  "image": `${window.location.origin}/icon-512.png`,
  "address": {
    "@type": "PostalAddress",
    "addressCountry": "US"
  },
  "contactPoint": {
    "@type": "ContactPoint",
    "telephone": "+1-800-TRADESCOUT",
    "contactType": "customer service",
    "availableLanguage": ["English"]
  },
  "sameAs": [
    "https://facebook.com/tradescout",
    "https://twitter.com/tradescout",
    "https://linkedin.com/company/tradescout"
  ]
});

export const createServiceStructuredData = (service: {
  name: string;
  description: string;
  category: string;
  areaServed?: string;
  provider?: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Service",
  "name": service.name,
  "description": service.description,
  "category": service.category,
  "provider": {
    "@type": "Organization",
    "name": service.provider || "TradeScout",
    "url": window.location.origin
  },
  "areaServed": service.areaServed || "United States",
  "hasOfferCatalog": {
    "@type": "OfferCatalog",
    "name": "Contractor Services",
    "itemListElement": [
      {
        "@type": "Offer",
        "itemOffered": {
          "@type": "Service",
          "name": "Free Contractor Quotes"
        }
      }
    ]
  }
});

export const createContractorStructuredData = (contractor: {
  id: string;
  name: string;
  description?: string;
  rating?: number;
  recommendationCount?: number;
  location?: string;
  trades?: string[];
  verified?: boolean;
}) => ({
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "@id": `${window.location.origin}/contractors/${contractor.id}`,
  "name": contractor.name,
  "description": contractor.description,
  "url": `${window.location.origin}/contractors/${contractor.id}`,
  "priceRange": "$$",
  "address": {
    "@type": "PostalAddress",
    "addressLocality": contractor.location,
    "addressCountry": "US"
  },
  "aggregateRating": contractor.rating ? {
    "@type": "AggregateRating",
    "ratingValue": contractor.rating,
    "recommendationCount": contractor.recommendationCount || 0,
    "bestRating": 5,
    "worstRating": 1
  } : undefined,
  "hasCredential": contractor.verified ? {
    "@type": "EducationalOccupationalCredential",
    "credentialCategory": "Professional Certification",
    "name": "Verified Contractor"
  } : undefined,
  "serviceType": contractor.trades || [],
  "areaServed": contractor.location || "Local Area"
});

export const createBreadcrumbStructuredData = (items: Array<{name: string, url: string}>) => ({
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": items.map((item, index) => ({
    "@type": "ListItem",
    "position": index + 1,
    "name": item.name,
    "item": `${window.location.origin}${item.url}`
  }))
});

export const createFAQStructuredData = (faqs: Array<{question: string, answer: string}>) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": faqs.map(faq => ({
    "@type": "Question",
    "name": faq.question,
    "acceptedAnswer": {
      "@type": "Answer",
      "text": faq.answer
    }
  }))
});