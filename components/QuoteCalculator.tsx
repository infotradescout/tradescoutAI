
import React, { useState, useMemo } from 'react';
import { Category } from '../types';
import { CalculatorIcon } from './Icons';

const regions = ['Oakville, ON', 'Burlington, ON', 'Mississauga, ON', 'Hamilton, ON', 'Toronto, ON'];

const categoryData: { [key in Category]: { label: string; rate: number } } = {
  [Category.PLUMBING]: { label: 'Number of Fixtures', rate: 150 },
  [Category.ELECTRICAL]: { label: 'Number of Outlets/Fixtures', rate: 100 },
  [Category.PAINTING]: { label: 'Area in Square Feet', rate: 2.5 },
  [Category.ROOFING]: { label: 'Area in Square Feet', rate: 8 },
  [Category.LANDSCAPING]: { label: 'Area in Square Feet', rate: 1.5 },
  [Category.GENERAL]: { label: 'Project Budget (rough)', rate: 1 },
};

const regionMultiplier: { [key: string]: number } = {
  'Oakville, ON': 1.1,
  'Burlington, ON': 1.05,
  'Mississauga, ON': 1.15,
  'Hamilton, ON': 0.95,
  'Toronto, ON': 1.3,
};

const QuoteCalculator: React.FC = () => {
  const [category, setCategory] = useState<Category>(Category.PAINTING);
  const [region, setRegion] = useState<string>(regions[0]);
  const [metric, setMetric] = useState<string>('500');
  const [estimate, setEstimate] = useState<number | null>(null);

  const handleCalculate = (e: React.FormEvent) => {
    e.preventDefault();
    const metricValue = parseFloat(metric);
    if (isNaN(metricValue) || metricValue <= 0) {
      setEstimate(null);
      return;
    }
    const data = categoryData[category];
    const multiplier = regionMultiplier[region];

    let calculatedCost;
    if (category === Category.GENERAL) {
        calculatedCost = metricValue * 1.25; // General Contractor markup estimate
    } else {
        calculatedCost = data.rate * metricValue * multiplier;
    }
    setEstimate(calculatedCost);
  };

  const metricLabel = useMemo(() => {
    return categoryData[category]?.label || 'Metric';
  }, [category]);
  
  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      setCategory(e.target.value as Category);
      setEstimate(null); // Reset estimate when category changes
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md border border-slate-200">
      <div className="flex items-center mb-4">
        <CalculatorIcon className="w-6 h-6 text-indigo-600 mr-3"/>
        <h3 className="text-xl font-bold text-slate-800">Get a Quick Estimate</h3>
      </div>
      <p className="text-sm text-slate-500 mb-4">
        This is a rough estimate to help you budget. For an accurate quote, please contact a contractor directly.
      </p>
      <form onSubmit={handleCalculate} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category-select" className="block text-sm font-medium text-slate-700">Service Category</label>
              <select
                id="category-select"
                value={category}
                onChange={handleCategoryChange}
                className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
              >
                {Object.values(Category).map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
             <div>
              <label htmlFor="region-select" className="block text-sm font-medium text-slate-700">Region</label>
              <select
                id="region-select"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
              >
                {regions.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
        </div>
        <div>
           <label htmlFor="metric" className="block text-sm font-medium text-slate-700">{metricLabel}</label>
           <input
              id="metric"
              type="number"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
              min="1"
              required
              className="mt-1 block w-full border border-slate-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-800"
           />
        </div>
        <button type="submit" className="w-full bg-indigo-600 text-white font-bold py-2 px-4 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors">
          Calculate Estimate
        </button>
      </form>
      {estimate !== null && (
        <div className="mt-4 p-4 bg-sky-50 border border-sky-200 rounded-lg text-center">
            <p className="text-sm font-medium text-slate-600">Estimated Project Cost:</p>
            <p className="text-3xl font-bold text-slate-800">
                ${estimate.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
        </div>
      )}
    </div>
  );
};

export default QuoteCalculator;
