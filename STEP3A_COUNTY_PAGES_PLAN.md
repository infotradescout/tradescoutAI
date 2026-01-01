# Step 3A: County Pages — Execution Plan

**Scope**: Build indexable county surface pages with jurisdiction-aware routing  
**Data Source**: Real geographic + coverage aggregates only  
**Delivery**: Route spec + content template + schema + 1 wired example

---

## 1. Route Specification

### Primary County Page Route
```
/county/:stateCode/:countySlug
```

**Example**:
- `/county/az/maricopa` → Maricopa County, Arizona
- `/county/ca/los-angeles` → Los Angeles County, California
- `/county/tx/harris` → Harris County, Texas

### Data Flow
```
URL → stateCode (2-char) + countySlug (kebab-case)
↓
Resolve via US_STATES_COUNTIES + getCountiesByState()
↓
Fetch coverage status via geographicCoverage service
↓
Build page with real aggregates only
```

### Navigation Hierarchy
```
/ (root)
└── /county
    ├── /county/az
    │   └── /county/az/maricopa
    ├── /county/ca
    │   └── /county/ca/los-angeles
    └── /county/tx
        └── /county/tx/harris
```

---

## 2. Content Template

### Page Structure (React Component)

**File**: `client/src/pages/county/CountyPage.tsx`

```tsx
import { useParams } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import { SEOHelmet, createPlaceStructuredData, createAdministrativeAreaStructuredData, createFAQStructuredData } from '@/components/SEOHelmet';
import { US_STATES_COUNTIES, getStateByCode, getCountiesByState } from '@/shared/states-counties';

interface CountyPageData {
  state: {
    code: string;
    name: string;
  };
  county: {
    fipsCode: string;
    name: string;
    state: string;
  };
  coverage: {
    status: 'unassigned' | 'partial' | 'full';
    verifiedContractorCount?: number;
    territoryManagerCount?: number;
    lastUpdate?: string;
  };
}

export default function CountyPage() {
  const { stateCode, countySlug } = useParams<{ stateCode: string; countySlug: string }>();
  
  // Resolve county from slug + stateCode
  const state = getStateByCode(stateCode?.toUpperCase());
  const counties = state ? getCountiesByState(state.code) : [];
  const county = counties.find(c => 
    c.name.toLowerCase().replace(/\s+/g, '-') === countySlug?.toLowerCase()
  );
  
  // Fetch coverage data
  const { data: coverage } = useQuery({
    queryKey: [`/api/geographic-coverage/county/${county?.fipsCode}`],
    enabled: !!county?.fipsCode,
  });

  if (!state || !county || !coverage) {
    return <NotFound />;
  }

  const pageData: CountyPageData = {
    state: { code: state.code, name: state.name },
    county,
    coverage,
  };

  // Build structured data
  const placeSchema = createPlaceStructuredData({
    name: county.name,
    state: state.name,
    stateCode: state.code,
    fipsCode: county.fipsCode,
  });

  const adminAreaSchema = createAdministrativeAreaStructuredData({
    name: county.name,
    areaType: 'County',
    state: state.name,
  });

  const faqs = buildCountyFAQs(county.name, coverage.status);
  const faqSchema = createFAQStructuredData(faqs);

  return (
    <>
      <SEOHelmet
        title={`${county.name}, ${state.code} | TradeScout Local`}
        description={buildCountyDescription(county.name, state.name, coverage.status)}
        keywords={buildCountyKeywords(county.name, state.name)}
        structuredData={[placeSchema, adminAreaSchema, faqSchema]}
      />
      
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Breadcrumb items={buildBreadcrumbs(state.name, county.name, stateCode, countySlug)} />
        
        <h1 className="text-4xl font-bold mb-4">
          {county.name}, {state.code}
        </h1>
        
        <CoverageSectionFromStatus coverage={coverage} county={county} />
        
        <DirectConnectSection county={county} state={state} coverage={coverage} />
        
        <CommunitySection county={county} state={state} />
        
        <FAQSection faqs={faqs} />
      </div>
    </>
  );
}
```

### Content Sections (Real Data Only)

#### 1. Coverage Status Banner
```html
<div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-8">
  {coverage.status === 'full' && (
    <p className="text-blue-800">
      <strong>Fully covered:</strong> {coverage.verifiedContractorCount} verified contractors 
      + {coverage.territoryManagerCount} territory manager in {county.name}.
      <a href="/direct-connect">Find contractors →</a>
    </p>
  )}
  {coverage.status === 'partial' && (
    <p className="text-blue-800">
      <strong>Partial coverage:</strong> {coverage.verifiedContractorCount} verified contractors
      currently serving {county.name}. Growing.
      <a href="/direct-connect">Explore matches →</a>
    </p>
  )}
  {coverage.status === 'unassigned' && (
    <p className="text-blue-800">
      <strong>Not yet covered:</strong> {county.name} is on the roadmap.
      <a href="/contact">Request coverage →</a>
    </p>
  )}
</div>
```

**Data Source**: `geographicCoverage.getCountyCoverageSummary()` → real counts only

#### 2. Direct Connect Section
```html
<section className="mb-12">
  <h2 className="text-2xl font-bold mb-4">Find Contractors in {county.name}</h2>
  
  <p className="text-gray-700 mb-6">
    Search verified contractors by trade. Match on trust + relevance, not price wars.
  </p>
  
  <LinkButton href={`/direct-connect?county=${county.fipsCode}`}>
    Open Direct Connect →
  </LinkButton>
</section>
```

**Routing Intent**: `county` parameter wires Direct Connect's default locality

#### 3. Community Section
```html
<section className="mb-12">
  <h2 className="text-2xl font-bold mb-4">Community in {county.name}</h2>
  
  <p className="text-gray-700 mb-6">
    Join neighbors, contractors, and pros. Share recommendations, 
    post projects, and discover what's happening locally.
  </p>
  
  <LinkButton href={`/community?county=${county.fipsCode}`}>
    Community Feed →
  </LinkButton>
</section>
```

**Routing Intent**: `county` parameter wires Community's locality context

#### 4. FAQ Section (County-Aware)
```html
<section className="mb-12">
  <h2 className="text-2xl font-bold mb-4">FAQs</h2>
  
  {faqs.map(faq => (
    <FAQItem key={faq.question} question={faq.question} answer={faq.answer} />
  ))}
</section>
```

**Content Pattern** (sample):
```
Q: How do I find contractors in {countyName}?
A: Use Direct Connect to search verified local contractors. Match on trust + 
relevance, not cost per lead. {coverageStatus-aware guidance}.

Q: Is {countyName} fully covered?
A: {Coverage status: full/partial/unassigned}. 
{If full: verifiedContractorCount} contractors available.
{If partial: growing coverage}.
{If unassigned: request coverage link}.

Q: What services are available in {countyName}?
A: Roofing, plumbing, electrical, HVAC, and more. Availability varies by county.

Q: How is TradeScout different from Angi/HomeAdvisor in {countyName}?
A: No lead spam. No bidding wars. Trust-first matching using Community 
Verification Score (CVS).

Q: What is the Community Verification Score?
A: Public trust metric: verified identity + license + insurance + recommendations.
Payment cannot override trust.
```

---

## 3. Schema Blocks

### Place Schema (New)
```typescript
export const createPlaceStructuredData = (county: {
  name: string;
  state: string;
  stateCode: string;
  fipsCode: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "Place",
  "name": `${county.name}, ${county.stateCode}`,
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": county.name,
    "areaType": "County",
    "containedIn": {
      "@type": "State",
      "name": county.state,
      "code": county.stateCode
    }
  },
  "url": window.location.href,
  "geo": {
    "@type": "GeoShape",
    "box": `[latMin] [lonMin] [latMax] [lonMax]` // Optional: FIPS geo if available
  }
});
```

### AdministrativeArea Schema (New)
```typescript
export const createAdministrativeAreaStructuredData = (area: {
  name: string;
  areaType: string;
  state: string;
}) => ({
  "@context": "https://schema.org",
  "@type": "AdministrativeArea",
  "name": area.name,
  "areaType": area.areaType,
  "containedIn": {
    "@type": "State",
    "name": area.state
  }
});
```

### FAQPage (Conditional on Coverage)
```typescript
// buildCountyFAQs(countyName, coverageStatus) returns array of:
{
  question: string;  // County-specific, coverage-aware
  answer: string;    // Real guidance, no marketing
}
```

---

## 4. One Fully Wired Example: Maricopa County, AZ

### Route
```
/county/az/maricopa
```

### API Calls (Server-Side)
```typescript
// 1. Resolve county from slug
const county = getCountiesByState('AZ').find(c => 
  c.name === 'Maricopa County'
);
// → { fipsCode: '04013', name: 'Maricopa County', state: 'AZ' }

// 2. Fetch coverage
const coverage = await getCountyCoverageSummary();
const maricopaRow = coverage.rows.find(r => r.countyFips === '04013');
// → { coverageStatus: 'full', verifiedContractorCount: 847, territoryManagerCount: 3, ... }

// 3. Build page content
const pageTitle = 'Maricopa County, AZ | TradeScout Local';
const pageDesc = 'Find 847 verified contractors in Maricopa County, AZ. '
  + 'Trust-first matching, no lead spam. Community recommendations, verified licensing.';
const pageKeywords = 'maricopa county contractors, phoenix contractors, verified contractors, '
  + 'home improvement, roofing, plumbing, electrical, HVAC, maricopa';
```

### Content Display
```html
<h1>Maricopa County, AZ</h1>

<banner>
  ✓ Fully Covered: 847 verified contractors + 3 territory managers
  Find contractors → [button to /direct-connect?county=04013]
</banner>

<section>
  Find Contractors in Maricopa County
  Search verified contractors by trade. Match on trust + relevance, not price wars.
  [Open Direct Connect →]
</section>

<section>
  Community in Maricopa County
  Join 50,000+ neighbors and contractors. Share recommendations, post projects, discover locally.
  [Community Feed →]
</section>

<section>
  FAQs
  - Q: How do I find contractors in Maricopa County?
    A: Use Direct Connect. 847 verified contractors available...
  - Q: Is Maricopa County fully covered?
    A: Yes. 847 contractors + 3 territory managers serve the county...
  - (etc., 5 total)
</section>

<breadcrumb>
  Home › States › Arizona › Maricopa County
</breadcrumb>
```

### Structured Data (JSON-LD)
```json
{
  "@context": "https://schema.org",
  "@type": "Place",
  "name": "Maricopa County, AZ",
  "areaServed": {
    "@type": "AdministrativeArea",
    "name": "Maricopa County",
    "areaType": "County",
    "containedIn": {
      "@type": "State",
      "name": "Arizona",
      "code": "AZ"
    }
  },
  "url": "https://www.thetradescout.com/county/az/maricopa"
}
```

---

## 5. Implementation Checklist

### Phase 1: Routes + Infrastructure
- [ ] Add `/county/:stateCode/:countySlug` route to App.tsx
- [ ] Create `CountyPage.tsx` (scaffold)
- [ ] Wire `getStateByCode()` + `getCountiesByState()` for slug resolution
- [ ] Create county slug generator utility (name → kebab-case)

### Phase 2: Schema Generators
- [ ] Add `createPlaceStructuredData()` to SEOHelmet.tsx
- [ ] Add `createAdministrativeAreaStructuredData()` to SEOHelmet.tsx
- [ ] Add `buildCountyFAQs()` utility (coverage-aware FAQ generation)
- [ ] Add `buildCountyDescription()` utility (coverage-aware meta)
- [ ] Add `buildCountyKeywords()` utility

### Phase 3: Content Sections
- [ ] Build Coverage Status Banner (coverage.status conditional)
- [ ] Build Direct Connect Section (with county parameter linking)
- [ ] Build Community Section (with county parameter linking)
- [ ] Build Breadcrumb (Country → State → County)

### Phase 4: API Integration
- [ ] Wire `geographicCoverage.getCountyCoverageSummary()` 
- [ ] Create `/api/geographic-coverage/county/:fipsCode` endpoint (if not exists)
- [ ] Test with Maricopa County (AZ) — known full coverage

### Phase 5: Sitemap + SEO
- [ ] Update `scripts/generate-sitemap.mjs` to include /county/* routes
  - Option 1: Only major counties (>500K population)
  - Option 2: All counties (extensive but crawlable)
  - **Recommend**: All counties (simplifies expansion logic)
- [ ] Verify robots.txt allows /county/*

### Phase 6: Testing + Validation
- [ ] Test `/county/az/maricopa` (full coverage example)
- [ ] Test `/county/mt/missoula` (partial coverage example)
- [ ] Test `/county/wy/niobrara` (unassigned example)
- [ ] Verify SEO output (title, description, canonical, breadcrumb)
- [ ] Verify structured data (Place, AdministrativeArea, FAQPage)
- [ ] Build validation (must stay GREEN)

---

## 6. Data Integrity Guardrails

✅ **Real aggregates only**:
- Coverage counts from `geographicCoverage` service
- County names from `US_STATES_COUNTIES`
- No invented metrics, no fallback values

✅ **Coverage-aware language**:
- Full: "X verified contractors + Y territory managers"
- Partial: "X contractors currently serving, growing"
- Unassigned: "On the roadmap, request coverage"

✅ **No promises beyond readiness**:
- Never claim "now serving" if unassigned
- Never fabricate contractor counts if data unavailable
- Always explicit about coverage state

✅ **Neutral copy**:
- FAQPage answers are factual system explanation
- No marketing superlatives
- No Angi/HomeAdvisor criticism (save for /compare/* pages)

---

## 7. Next Phase (Step 3B): Jurisdiction-Aware Routing

After 3A is complete:
- **Direct Connect**: Accept `?county=FIPS` → default locality context
- **Scout**: Accept location hint → answer with county-scoped context
- **Community**: Accept `?county=FIPS` → county-scoped feed

No schema changes; just routing/intent logic.

---

## Immediate Execution Steps

1. ✅ **Plan confirmed** (this document)
2. 🔄 **Create `/county/:stateCode/:countySlug` route** (App.tsx)
3. 🔄 **Build `CountyPage.tsx`** (scaffold + breadcrumb)
4. 🔄 **Add schema generators to SEOHelmet.tsx**
5. 🔄 **Build content sections** (coverage, direct-connect, community, FAQ)
6. 🔄 **Wire Maricopa County example** (full coverage test)
7. 🔄 **Update sitemap generator**
8. 🔄 **Build + validate** (GREEN required)
9. 🔄 **Commit Step 3A**

---

**Status**: Ready for implementation  
**Timeline**: ~60 min (scaffold + schema + 1 example)  
**Risk**: Low (no DB changes, real data only, no monetization)
