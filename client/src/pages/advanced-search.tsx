import { memo } from 'react';
import { Search } from 'lucide-react';
import FindContractors from './find-contractors';

const AdvancedSearch = memo(function AdvancedSearch() {
  return (
    <div className="min-h-screen gradient-bg text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Search className="h-8 w-8 text-orange-400" />
          <div>
            <h1 className="text-3xl md:text-4xl font-bold text-white">Contractor Search</h1>
            <p className="text-gray-300 text-sm md:text-base">
              Use the same verified TradeScout contractor directory with richer filters for state, county, and trade.
            </p>
          </div>
        </div>

        <FindContractors title="Advanced contractor search" />
      </div>
    </div>
  );
});

export default AdvancedSearch;