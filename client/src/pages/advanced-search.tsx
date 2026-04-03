import { memo } from 'react';
import { Search } from 'lucide-react';
import FindContractors from './find-contractors';
import { Page, Section } from '@/components/layout/PagePrimitives';

const AdvancedSearch = memo(function AdvancedSearch() {
  return (
    <Page>
      <Section
        title={
          <span className="flex items-center gap-2">
            <Search className="h-6 w-6 text-ts-orange" />
            Contractor Search
          </span>
        }
        subtitle="Use the same verified TradeScout contractor directory with richer filters for state, county, and trade."
      >
        <FindContractors title="Advanced contractor search" />
      </Section>
    </Page>
  );
});

export default AdvancedSearch;
