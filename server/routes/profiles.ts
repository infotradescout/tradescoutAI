router.get("/sitemap-exchange-listings.xml", async (req, res) => {
  try {
    const baseUrl = getCanonicalBaseUrl(req);
    const today = getTodayYmd();
    // Sitemap URLs are emitted as /exchange/:categorySlug/:id with encodeURIComponent path parts.
    type ExchangeSitemapItem = {
      id: string;
      sellerUserId: string;
      categoryName: string;
      updatedAt: Date | null;
    };
    let listings: ExchangeSitemapItem[] = [];
    let profileOfferItems: ExchangeSitemapItem[] = [];
    try {
      const maybeListings = await storage.listActiveExchangeListingsForSitemap();
      listings = Array.isArray(maybeListings) ? maybeListings : [];
    } catch (error) {
      console.warn("Exchange listings sitemap fallback: failed to load listings", error);
      listings = [];
    }

    try {
      const offers = await pool.query(
        `SELECT id, seller_user_id,
                COALESCE(metadata->>'exchangeCategorySlug', 'other') AS category_slug,
                updated_at
         FROM profile_offers
         WHERE is_active = true
           AND offer_type = 'item'
         ORDER BY updated_at DESC
         LIMIT 5000`
      );
      profileOfferItems = offers.rows.map((offer) => ({
        id: `profile-offer-${String(offer.id)}`,
        sellerUserId: String(offer.seller_user_id || "").trim(),
        categoryName: String(offer.category_slug || "other"),
        updatedAt: offer.updated_at ?? null,
      }));
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      if (!message.includes("profile_offers") && error?.code !== "42P01") {
        console.warn("Exchange listings sitemap fallback: failed to load profile offers", error);
      }
      profileOfferItems = [];
    }

    // Build a categoryName → slug lookup using the shared mapping
    const { getExchangeCategorySlugFromMarketplaceCategoryName } =
      await import("../../shared/exchangeListingRules");

    const exposureAuthority = await buildExposureAuthorityMap(
      [...listings, ...profileOfferItems].map((listing) => listing.sellerUserId)
    );
    const urls = [...listings, ...profileOfferItems]
      .filter(
        (listing) =>
          listing && typeof listing === "object" && exposureAuthority[listing.sellerUserId] === true
      )
      .map((listing) => {
        const id = String(listing.id || "").trim();
        if (!id) return null;
        const categorySlug =
          getExchangeCategorySlugFromMarketplaceCategoryName(listing.categoryName) ||
          slugifyCategory(listing.categoryName) ||
          "other";
        return {
          loc: `${baseUrl}/exchange/${encodeURIComponent(categorySlug)}/${encodeURIComponent(id)}`,
          lastmod: toYmd(listing.updatedAt, today),
          changefreq: "weekly",
          priority: "0.7",
        };
      });

    res.type("application/xml");
    res.send(
      buildUrlSet(
        urls.filter(
          (
            entry
          ): entry is { loc: string; lastmod: string; changefreq: string; priority: string } =>
            Boolean(entry)
        )
      )
    );
  } catch (error: any) {
    console.error("Error generating Exchange listings sitemap:", error);
    sendSitemapFallback(res);
  }
});

export { router as profilesRouter };
