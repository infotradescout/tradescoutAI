import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";

interface State {
  code: string;
  name: string;
  subdivisionType: "county" | "parish" | "borough" | "census area" | "municipality" | "district";
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
  // Optional detailed callback with full county record for callers that
  // need both FIPS (machine) and name (display).
  onCountySelected?: (county: County | null) => void;
  disabled?: boolean;
  className?: string;
}

export function StateCountySelector({
  selectedState,
  selectedCounty,
  onStateChange,
  onCountyChange,
  onCountySelected,
  disabled = false,
  className = "",
}: StateCountySelectorProps) {
  const [currentState, setCurrentState] = useState(selectedState || "");
  const [currentCounty, setCurrentCounty] = useState(selectedCounty || "");

  // Fetch all states
  const {
    data: states = [],
    isLoading: statesLoading,
    error: statesError,
  } = useQuery<State[]>({
    queryKey: ["/api/states"],
    queryFn: async () => apiRequest("GET", "/api/states"),
  });

  // Fetch counties for selected state
  const {
    data: counties = [],
    isLoading: countiesLoading,
    error: countiesError,
  } = useQuery<County[]>({
    queryKey: ["/api/counties", currentState],
    enabled: !!currentState,
    queryFn: async () =>
      apiRequest("GET", `/api/counties?state=${encodeURIComponent(currentState)}`),
  });

  // Get subdivision type for selected state
  const selectedStateData = states.find((s) => s.code === currentState);
  const subdivisionType = selectedStateData?.subdivisionType || "county";
  const subdivisionTypeCapitalized =
    subdivisionType.charAt(0).toUpperCase() + subdivisionType.slice(1);

  const handleStateChange = (stateCode: string) => {
    setCurrentState(stateCode);
    setCurrentCounty(""); // Reset county when state changes
    onStateChange(stateCode);
    onCountyChange(""); // Clear county selection
    if (onCountySelected) {
      onCountySelected(null);
    }
  };

  const handleCountyChange = (countyFips: string) => {
    setCurrentCounty(countyFips);
    onCountyChange(countyFips);
    if (onCountySelected) {
      const county = counties.find((c) => c.fips === countyFips) || null;
      onCountySelected(county);
    }
  };

  // Update internal state when props change
  useEffect(() => {
    if (selectedState !== currentState) {
      setCurrentState(selectedState || "");
    }
  }, [selectedState]);

  useEffect(() => {
    if (selectedCounty !== currentCounty) {
      setCurrentCounty(selectedCounty || "");
    }
  }, [selectedCounty]);

  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${className}`}>
      {/* State Selector */}
      <div>
        <Label className="block text-sm font-medium text-tsTextMuted mb-2">State</Label>
        <Select
          value={currentState}
          onValueChange={handleStateChange}
          disabled={disabled || statesLoading || Boolean(statesError)}
        >
          <SelectTrigger className="form-field">
            <SelectValue
              placeholder={
                statesLoading
                  ? "Loading states..."
                  : statesError
                    ? "Unable to load states"
                    : "Select state"
              }
            />
          </SelectTrigger>
          <SelectContent className="max-h-80">
            {states.map((state) => (
              <SelectItem key={state.code} value={state.code}>
                {state.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {statesError && (
          <p className="mt-1 text-[11px] text-red-300">
            Could not load states. Refresh and try again.
          </p>
        )}
      </div>

      {/* County Selector */}
      <div>
        <Label className="block text-sm font-medium text-tsTextMuted mb-2">
          {subdivisionTypeCapitalized}
        </Label>
        <Select
          value={currentCounty}
          onValueChange={handleCountyChange}
          disabled={disabled || !currentState || countiesLoading || Boolean(countiesError)}
        >
          <SelectTrigger className="form-field">
            <SelectValue
              placeholder={
                !currentState
                  ? `Select state first`
                  : countiesError
                    ? `Unable to load ${subdivisionType}s`
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
        {countiesError && currentState && (
          <p className="mt-1 text-[11px] text-red-300">
            Could not load {subdivisionType}s for this state.
          </p>
        )}
      </div>
    </div>
  );
}
