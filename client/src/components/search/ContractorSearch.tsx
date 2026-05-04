import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  SearchTooltip,
  FilterTooltip,
  ContextualTooltip,
} from "@/components/ui/contextual-tooltip";
import { Search, MapPin, Filter, ShieldCheck, Wrench, Clock, DollarSign } from "lucide-react";

const searchFormSchema = z.object({
  location: z.string().min(2, "Location must be at least 2 characters"),
  service: z.string().optional(),
  budget: z.string().optional(),
  timeline: z.string().optional(),
  rating: z.string().optional(),
});

type SearchFormData = z.infer<typeof searchFormSchema>;

interface ContractorSearchProps {
  onSearch?: (filters: SearchFormData) => void;
  className?: string;
}

const services = [
  "Kitchen Remodeling",
  "Bathroom Renovation",
  "Flooring Installation",
  "Roofing",
  "Electrical Work",
  "Plumbing",
  "HVAC",
  "Painting",
  "Deck Building",
  "Landscaping",
];

const budgetRanges = [
  "Under $1,000",
  "$1,000 - $5,000",
  "$5,000 - $15,000",
  "$15,000 - $50,000",
  "$50,000 - $100,000",
  "Over $100,000",
];

const timelineOptions = [
  "ASAP",
  "Within 1 week",
  "Within 1 month",
  "Within 3 months",
  "Within 6 months",
  "No rush",
];

export function ContractorSearch({ onSearch, className = "" }: ContractorSearchProps) {
  const [isSearching, setIsSearching] = useState(false);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);

  const form = useForm<SearchFormData>({
    resolver: zodResolver(searchFormSchema),
    defaultValues: {
      location: "",
      service: "",
      budget: "",
      timeline: "",
      rating: "",
    },
  });

  const onSubmit = async (data: SearchFormData) => {
    setIsSearching(true);
    try {
      // Simulate search API call
      await new Promise((resolve) => setTimeout(resolve, 800));
      onSearch?.(data);

      // Update active filters for display
      const filters: string[] = [];
      if (data.service) filters.push(data.service);
      if (data.budget) filters.push(data.budget);
      if (data.timeline) filters.push(data.timeline);
      if (data.rating) filters.push(`CVS ${data.rating}+`);
      setActiveFilters(filters);
    } catch (error) {
      console.error("Search failed:", error);
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <Card className={`bg-tsCard border-white/10 ${className}`}>
      <CardHeader>
        <CardTitle className="text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-5 w-5 text-ts-orange" />
            Find Your Perfect Contractor
          </div>
          <SearchTooltip>
            <ContextualTooltip
              title="Search Like a Pro"
              content="Start with your zip code or city, then narrow down by service type. Think of it as GPS for finding the right contractor."
              illustration="wrench"
              variant="contractor"
            />
          </SearchTooltip>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            {/* Location Search */}
            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-white/70 flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-ts-orange" />
                    Location
                    <ContextualTooltip
                      content="Enter your city, zip code, or neighborhood - contractors work within specific service areas"
                      illustration="ruler"
                      size="sm"
                      variant="contractor"
                    />
                  </FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      className="bg-tsCard border-white/10 text-white"
                      placeholder="Enter your city or zip code"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Filters Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="service"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-ts-orange" />
                      Service Type
                      <FilterTooltip>
                        <ContextualTooltip
                          title="Choosing Services"
                          content="Be specific! 'Kitchen remodel' gets better matches than 'home improvement'"
                          illustration="hammer"
                          size="sm"
                          variant="contractor"
                        />
                      </FilterTooltip>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-tsCard border-white/10 text-white">
                          <SelectValue placeholder="What do you need?" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-tsCard border-white/10">
                        {services.map((service) => (
                          <SelectItem
                            key={service}
                            value={service}
                            className="text-white hover:bg-tsCard"
                          >
                            {service}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="budget"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-ts-orange" />
                      Budget Range
                      <ContextualTooltip
                        content="Honest budget ranges help contractors provide accurate quotes - like giving measurements before cutting lumber"
                        illustration="ruler"
                        size="sm"
                        variant="contractor"
                      />
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-tsCard border-white/10 text-white">
                          <SelectValue placeholder="Budget range" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-tsCard border-white/10">
                        {budgetRanges.map((range) => (
                          <SelectItem
                            key={range}
                            value={range}
                            className="text-white hover:bg-tsCard"
                          >
                            {range}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="timeline"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 flex items-center gap-2">
                      <Clock className="h-4 w-4 text-ts-orange" />
                      Timeline
                      <ContextualTooltip
                        content="Realistic timelines get better responses - contractors appreciate honest scheduling expectations"
                        illustration="drill"
                        size="sm"
                        variant="contractor"
                      />
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-tsCard border-white/10 text-white">
                          <SelectValue placeholder="When needed" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-tsCard border-white/10">
                        {timelineOptions.map((option) => (
                          <SelectItem
                            key={option}
                            value={option}
                            className="text-white hover:bg-tsCard"
                          >
                            {option}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-white/70 flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-ts-orange" />
                      Minimum CVS
                      <ContextualTooltip
                        content="CVS runs from 0 to 100. It reflects verification and performance signals, not payment."
                        illustration="paintbrush"
                        size="sm"
                        variant="contractor"
                      />
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger className="bg-tsCard border-white/10 text-white">
                          <SelectValue placeholder="Any trust level" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="bg-tsCard border-white/10">
                        <SelectItem value="40" className="text-white hover:bg-tsCard">
                          CVS 40+
                        </SelectItem>
                        <SelectItem value="70" className="text-white hover:bg-tsCard">
                          CVS 70+
                        </SelectItem>
                        <SelectItem value="85" className="text-white hover:bg-tsCard">
                          CVS 85+
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Search Button */}
            <div className="flex justify-center pt-4">
              <Button
                type="submit"
                disabled={isSearching}
                className="bg-ts-orange hover:bg-ts-orange-dark text-white px-8 py-3 text-lg flex items-center gap-2"
              >
                {isSearching ? (
                  <div className="animate-spin w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                ) : (
                  <Search className="h-5 w-5" />
                )}
                {isSearching ? "Searching..." : "Find Contractors"}
              </Button>
            </div>
          </form>
        </Form>

        {/* Active Filters */}
        {activeFilters.length > 0 && (
          <div className="mt-6 pt-6 border-t border-white/10">
            <div className="flex items-center gap-2 mb-3">
              <Filter className="h-4 w-4 text-ts-orange" />
              <span className="text-sm text-white/70">Active Filters:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {activeFilters.map((filter, index) => (
                <Badge
                  key={index}
                  variant="secondary"
                  className="bg-ts-orange/20 text-ts-orange border-ts-orange/30"
                >
                  {filter}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Pro Tips */}
        <div className="mt-6 p-4 bg-tsCard/50 rounded-lg border border-white/10">
          <h4 className="text-ts-orange font-semibold mb-2 flex items-center gap-2">
            <ContextualTooltip
              content="These tips come from successful homeowner-contractor matches"
              illustration="hardhat"
              size="sm"
              variant="contractor"
            />
            💡 Search Tips That Actually Work
          </h4>
          <ul className="text-sm text-white/70 space-y-1">
            <li>• Include your city or zip code for accurate local results</li>
            <li>• Be specific about your project type and scope</li>
            <li>• Honest budget ranges help contractors provide better quotes</li>
            <li>• Flexible timelines often get more contractor interest</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
