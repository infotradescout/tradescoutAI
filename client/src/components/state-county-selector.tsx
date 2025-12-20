import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface State {
  code: string;
  name: string;
  subdivisionType: 'county' | 'parish' | 'borough' | 'census area' | 'municipality' | 'district';
}

interface County {
  name: string;
  fips: string;
  stateCode: string;
}

interface StateCountySelectorProps {
  selectedState?: string;
  selectedCounty?: string;
  onStateChange: (stateCode: string) => void;
  onCountyChange: (countyFips: string) => void;
  disabled?: boolean;
  className?: string;
}

export function StateCountySelector({
  selectedState,
  selectedCounty,
  onStateChange,
  onCountyChange,
  disabled = false,
  className = ""
}: StateCountySelectorProps) {
  const [currentState, setCurrentState] = useState(selectedState || '');
  const [currentCounty, setCurrentCounty] = useState(selectedCounty || '');

  // Fetch all states
  const { data: states = [], isLoading: statesLoading } = useQuery<State[]>({
    queryKey: ['/api/states'],
    queryFn: async () => apiRequest('GET', '/api/states'),
  });

  // Fetch counties for selected state
  const { data: counties = [], isLoading: countiesLoading } = useQuery<County[]>({
    queryKey: ['/api/counties', currentState],
    enabled: !!currentState,
    queryFn: async () =>
      apiRequest('GET', `/api/counties?state=${encodeURIComponent(currentState)}`),
  });

  // Get subdivision type for selected state
  const selectedStateData = states.find(s => s.code === currentState);
  const subdivisionType = selectedStateData?.subdivisionType || 'county';
  const subdivisionTypeCapitalized = subdivisionType.charAt(0).toUpperCase() + subdivisionType.slice(1);

  const handleStateChange = (stateCode: string) => {
    setCurrentState(stateCode);
    setCurrentCounty(''); // Reset county when state changes
    onStateChange(stateCode);
    onCountyChange(''); // Clear county selection
  };

  const handleCountyChange = (countyFips: string) => {
    setCurrentCounty(countyFips);
    onCountyChange(countyFips);
  };

  // Update internal state when props change
  useEffect(() => {
    if (selectedState !== currentState) {
      setCurrentState(selectedState || '');
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedCounty !== currentCounty) {
      setCurrentCounty(selectedCounty || '');
    }
  }, [selectedCounty]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* State Selector */}
      <div>
        <Label className="block text-sm font-medium text-gray-300 mb-2">State</Label>
        <Select 
          value={currentState} 
          onValueChange={handleStateChange}
          disabled={disabled || statesLoading}
        >
          <SelectTrigger className="form-field">
            <SelectValue placeholder={statesLoading ? "Loading states..." : "Select State"} />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {states.map((state) => (
              <SelectItem key={state.code} value={state.code}>
                {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* County Selector */}
      <div>
        <Label className="block text-sm font-medium text-gray-300 mb-2">
          {subdivisionTypeCapitalized}
        </Label>
        <Select 
          value={currentCounty} 
          onValueChange={handleCountyChange}
          disabled={disabled || !currentState || countiesLoading}
        >
          <SelectTrigger className="form-field">
            <SelectValue 
              placeholder={
                !currentState 
                  ? `Select state first` 
                  : countiesLoading 
                    ? `Loading ${subdivisionType}s...` 
                    : `Select ${subdivisionTypeCapitalized}`
              } 
            />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {counties.map((county) => (
              <SelectItem key={county.fips} value={county.fips}>
                {county.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}