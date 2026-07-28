-- Append JW Stone's reusable public-profile presentation contract when absent.
-- Existing content blocks and any owner-authored profilePresentation block win.
UPDATE profiles
SET
  content_blocks = COALESCE(content_blocks, '[]'::jsonb) || jsonb_build_array(
    jsonb_build_object(
      'type', 'profilePresentation',
      'data', '{
        "layout": {
          "variant": "brand-showcase"
        },
        "header": {
          "layout": "centered-brand",
          "logoUrl": "/images/businesses/jw-stone/logo.svg",
          "logoAlt": "JW Stone — Premium Wholesale Stone Distributor",
          "homeLabel": "JW Stone home",
          "backLabel": "Back within JW Stone",
          "directConnectLabel": "Direct Connect with JW Stone"
        },
        "hero": {
          "videoUrl": "/images/businesses/jw-stone/video/hero.mp4",
          "posterUrl": "/images/businesses/jw-stone/video/hero-poster.jpg",
          "inventoryItemSlug": "amazonic-green",
          "eyebrow": "Amazonic Green · current inventory",
          "headline": "Natural stone, selected at the source.",
          "teaser": "Search the full collection or ask JW Stone about your project.",
          "preserveMedia": true,
          "align": "left",
          "zoomVideo": true
        },
        "copy": {
          "inventoryTitle": "Current Inventory",
          "ctaHeading": "Tell JW Stone what you need",
          "footerText": "Quarry-direct sourcing. Your contact details stay private until you choose to connect."
        },
        "media": {
          "fallbackLogoUrl": "/images/businesses/jw-stone/logo.svg",
          "fallbackLogoAlt": "JW Stone"
        },
        "inventory": {
          "initialView": "catalog",
          "density": "compact",
          "pageSize": 12,
          "pageStep": 12,
          "stickyControls": true,
          "sourceRequests": true,
          "browseCtaImage": "/images/businesses/jw-stone/inventory-source/1YaoUMDs2-E_UvX7aqoNXRboo4M323utd.webp",
          "browseCtaEyebrow": "Rhino White · current inventory",
          "featuredCollection": {
            "label": "JW Stone Picks",
            "slugs": [
              "blue-dunes",
              "cristallo",
              "gold-macaubas",
              "rhino-white",
              "taj-mahal",
              "titanium"
            ]
          }
        },
        "audience": {
          "layout": "guided",
          "intro": "Choose the path that fits you. The inventory stays the same; the questions and next step adapt to your project.",
          "availableFacts": [
            "Stone photos",
            "Material categories",
            "Confirmed finishes where listed",
            "Source counts where listed"
          ],
          "contextHeading": "Helpful context to include",
          "availabilityNote": "Pricing and current availability are confirmed through Direct Connect."
        },
        "faq": {
          "layout": "disclosure"
        },
        "recommendations": {
          "initialLimit": 3,
          "maxVisible": 24
        },
        "story": {
          "eyebrow": "From source to finished space",
          "heading": "Stone selected with the final room in mind.",
          "images": [
            {
              "src": "/images/businesses/jw-stone/story/quarry.webp",
              "alt": "Natural stone quarry represented on the JW Stone website",
              "label": "Direct quarry relationships"
            },
            {
              "src": "/images/businesses/jw-stone/story/taj-living-room.webp",
              "alt": "Light natural stone installation represented on the JW Stone website",
              "label": "Stone specified for the whole space"
            },
            {
              "src": "/images/businesses/jw-stone/story/fireplace.webp",
              "alt": "Dark and light stone interior represented on the JW Stone website",
              "label": "Material with architectural impact"
            },
            {
              "src": "/images/businesses/jw-stone/story/mont-blanc-bar.webp",
              "alt": "Illuminated stone bar represented on the JW Stone website",
              "label": "Finished-space inspiration"
            }
          ]
        },
        "social": {
          "brandName": "JW Stone Logistics",
          "logoUrl": "/images/businesses/jw-stone/logo.svg",
          "profileImageUrl": "/images/businesses/jw-stone/video/hero-poster.jpg",
          "accentColor": "#81904a",
          "profileCta": "Explore inventory",
          "inventoryCta": "View photos · Request pricing",
          "galleryCta": "View project"
        }
      }'::jsonb
    )
  ),
  updated_at = NOW()
WHERE slug = 'jw-stone'
  AND jsonb_typeof(COALESCE(content_blocks, '[]'::jsonb)) = 'array'
  AND NOT EXISTS (
    SELECT 1
    FROM jsonb_array_elements(COALESCE(content_blocks, '[]'::jsonb)) AS block
    WHERE block ->> 'type' = 'profilePresentation'
  );
