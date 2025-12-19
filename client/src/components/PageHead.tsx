import { useEffect } from 'react';

interface PageHeadProps {
  title?: string;
  description?: string;
  keywords?: string;
  ogImage?: string;
  canonicalUrl?: string;
}

export function PageHead({ 
  title = "TradeScout – Scout for Contractors and Communities", 
  description = "Scout, your AI project assistant, helps you find verified local contractors, compare options, and manage projects with confidence.",
  keywords = "scout, ai assistant, contractors, home improvement, quotes, local contractors, verified contractors",
  ogImage = "/icon-512.png",
  canonicalUrl
}: PageHeadProps) {
  useEffect(() => {
    // Update document title
    document.title = title;
    
    // Update meta tags
    updateMetaTag('description', description);
    updateMetaTag('keywords', keywords);
    updateMetaTag('og:title', title, 'property');
    updateMetaTag('og:description', description, 'property');
    updateMetaTag('og:image', ogImage, 'property');
    updateMetaTag('twitter:title', title);
    updateMetaTag('twitter:description', description);
    updateMetaTag('twitter:image', ogImage);
    
    // Update canonical URL if provided
    if (canonicalUrl) {
      updateLinkTag('canonical', canonicalUrl);
    }
  }, [title, description, keywords, ogImage, canonicalUrl]);

  return null;
}

function updateMetaTag(name: string, content: string, attribute: string = 'name') {
  let meta = document.querySelector(`meta[${attribute}="${name}"]`);
  if (!meta) {
    meta = document.createElement('meta');
    meta.setAttribute(attribute, name);
    document.head.appendChild(meta);
  }
  meta.setAttribute('content', content);
}

function updateLinkTag(rel: string, href: string) {
  let link = document.querySelector(`link[rel="${rel}"]`);
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', rel);
    document.head.appendChild(link);
  }
  link.setAttribute('href', href);
}