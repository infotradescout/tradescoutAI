import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  ContextualTooltip, 
  SearchTooltip, 
  FilterTooltip, 
  ProfileTooltip,
  MessagingTooltip,
  SchedulingTooltip,
  PricingTooltip,
  ReviewsTooltip,
  ToolsTooltip
} from "@/components/ui/contextual-tooltip";
import { ContextualHelp } from "@/components/help/HelpSystem";
import { 
  LeadsWidget, 
  RevenueWidget, 
  RatingWidget, 
  MessagesWidget, 
  ScheduleWidget 
} from "@/components/dashboard/DashboardWidget";
import { ContactForm } from "@/components/forms/ContactForm";
import { ContractorSearch } from "@/components/search/ContractorSearch";
import { 
  Search, 
  Filter, 
  User, 
  MessageSquare, 
  Calendar, 
  DollarSign, 
  Star, 
  Wrench,
  Hammer,
  HardHat,
  Drill,
  Settings,
  Paintbrush,
  Ruler
} from "lucide-react";

export default function HelpDemo() {
  return (
    <div className="min-h-screen bg-navy-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-4xl font-bold text-white mb-4">
            Contextual Help System Demo
          </h1>
          <p className="text-xl text-gray-300 mb-6">
            Witty contractor-themed tooltips throughout the platform
          </p>
          <ContextualHelp />
        </div>

        {/* Basic Tooltip Examples */}
        <Card className="bg-navy-800 border-navy-600">
          <CardHeader>
            <CardTitle className="text-white">Basic Contextual Tooltips</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-400" />
                <span className="text-white">Search</span>
                <SearchTooltip />
              </div>
              
              <div className="flex items-center gap-2">
                <Filter className="h-5 w-5 text-orange-400" />
                <span className="text-white">Filters</span>
                <FilterTooltip />
              </div>
              
              <div className="flex items-center gap-2">
                <User className="h-5 w-5 text-orange-400" />
                <span className="text-white">Profile</span>
                <ProfileTooltip />
              </div>
              
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-orange-400" />
                <span className="text-white">Messaging</span>
                <MessagingTooltip />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-orange-400" />
                <span className="text-white">Scheduling</span>
                <SchedulingTooltip />
              </div>
              
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-orange-400" />
                <span className="text-white">Pricing</span>
                <PricingTooltip />
              </div>
              
              <div className="flex items-center gap-2">
                <Star className="h-5 w-5 text-orange-400" />
                <span className="text-white">Reviews</span>
                <ReviewsTooltip />
              </div>
              
              <div className="flex items-center gap-2">
                <Wrench className="h-5 w-5 text-orange-400" />
                <span className="text-white">Tools</span>
                <ToolsTooltip />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Custom Tooltips with Different Illustrations */}
        <Card className="bg-navy-800 border-navy-600">
          <CardHeader>
            <CardTitle className="text-white">Tool Illustrations Gallery</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 md:grid-cols-7 gap-6">
              <div className="text-center">
                <ContextualTooltip
                  title="Wrench"
                  content="The universal fix-it tool - like WD-40 for your workflow!"
                  illustration="wrench"
                  variant="contractor"
                >
                  <div className="p-4 bg-orange-500/20 rounded-lg cursor-pointer hover:bg-orange-500/30 transition-colors">
                    <Wrench className="h-8 w-8 text-orange-400 mx-auto" />
                    <p className="text-white text-sm mt-2">Wrench</p>
                  </div>
                </ContextualTooltip>
              </div>

              <div className="text-center">
                <ContextualTooltip
                  title="Hammer"
                  content="Sometimes you need the right tool for the job - and sometimes that tool is a hammer!"
                  illustration="hammer"
                  variant="contractor"
                >
                  <div className="p-4 bg-orange-500/20 rounded-lg cursor-pointer hover:bg-orange-500/30 transition-colors">
                    <Hammer className="h-8 w-8 text-orange-400 mx-auto" />
                    <p className="text-white text-sm mt-2">Hammer</p>
                  </div>
                </ContextualTooltip>
              </div>

              <div className="text-center">
                <ContextualTooltip
                  title="Hard Hat"
                  content="Safety first! Like wearing your hard hat on a job site."
                  illustration="hardhat"
                  variant="contractor"
                >
                  <div className="p-4 bg-orange-500/20 rounded-lg cursor-pointer hover:bg-orange-500/30 transition-colors">
                    <HardHat className="h-8 w-8 text-orange-400 mx-auto" />
                    <p className="text-white text-sm mt-2">Hard Hat</p>
                  </div>
                </ContextualTooltip>
              </div>

              <div className="text-center">
                <ContextualTooltip
                  title="Drill"
                  content="Gets the job done fast - like a good impact driver!"
                  illustration="drill"
                  variant="contractor"
                >
                  <div className="p-4 bg-orange-500/20 rounded-lg cursor-pointer hover:bg-orange-500/30 transition-colors">
                    <Drill className="h-8 w-8 text-orange-400 mx-auto" />
                    <p className="text-white text-sm mt-2">Drill</p>
                  </div>
                </ContextualTooltip>
              </div>

              <div className="text-center">
                <ContextualTooltip
                  title="Screwdriver"
                  content="For the fine-tuning work - precision matters!"
                  illustration="screwdriver"
                  variant="contractor"
                >
                  <div className="p-4 bg-orange-500/20 rounded-lg cursor-pointer hover:bg-orange-500/30 transition-colors">
                    <Settings className="h-8 w-8 text-orange-400 mx-auto" />
                    <p className="text-white text-sm mt-2">Settings</p>
                  </div>
                </ContextualTooltip>
              </div>

              <div className="text-center">
                <ContextualTooltip
                  title="Paintbrush"
                  content="Adds the finishing touches - makes everything look professional!"
                  illustration="paintbrush"
                  variant="contractor"
                >
                  <div className="p-4 bg-orange-500/20 rounded-lg cursor-pointer hover:bg-orange-500/30 transition-colors">
                    <Paintbrush className="h-8 w-8 text-orange-400 mx-auto" />
                    <p className="text-white text-sm mt-2">Paintbrush</p>
                  </div>
                </ContextualTooltip>
              </div>

              <div className="text-center">
                <ContextualTooltip
                  title="Ruler"
                  content="Measure twice, cut once - accuracy is everything!"
                  illustration="ruler"
                  variant="contractor"
                >
                  <div className="p-4 bg-orange-500/20 rounded-lg cursor-pointer hover:bg-orange-500/30 transition-colors">
                    <Ruler className="h-8 w-8 text-orange-400 mx-auto" />
                    <p className="text-white text-sm mt-2">Ruler</p>
                  </div>
                </ContextualTooltip>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Form with Tooltips */}
        <Card className="bg-navy-800 border-navy-600">
          <CardHeader>
            <CardTitle className="text-white">Form Fields with Contextual Help</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-gray-300 flex items-center gap-2 mb-2">
                Project Type
                <ContextualTooltip
                  title="Project Selection"
                  content="Choose the project type that best describes your needs - it affects material calculations"
                  illustration="hammer"
                  variant="contractor"
                  size="sm"
                />
              </Label>
              <Select>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="Select project type..." />
                </SelectTrigger>
                <SelectContent className="bg-navy-700 border-navy-600">
                  <SelectItem value="kitchen" className="text-white hover:bg-navy-600">Kitchen Remodel</SelectItem>
                  <SelectItem value="bathroom" className="text-white hover:bg-navy-600">Bathroom Renovation</SelectItem>
                  <SelectItem value="roofing" className="text-white hover:bg-navy-600">Roofing Work</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-gray-300 flex items-center gap-2 mb-2">
                Square Footage
                <ContextualTooltip
                  title="Accurate Measurements"
                  content="Precise measurements are crucial - like measuring lumber before cutting"
                  illustration="ruler"
                  variant="contractor"
                  size="sm"
                />
              </Label>
              <Input 
                placeholder="Enter square footage"
                className="bg-navy-700 border-navy-600 text-white"
              />
            </div>

            <div>
              <Label className="text-gray-300 flex items-center gap-2 mb-2">
                Timeline
                <ContextualTooltip
                  title="Project Timeline"
                  content="Rush jobs cost more - planning ahead saves money like buying materials in bulk"
                  illustration="drill"
                  variant="contractor"
                  size="sm"
                />
              </Label>
              <Select>
                <SelectTrigger className="bg-navy-700 border-navy-600 text-white">
                  <SelectValue placeholder="Select timeline..." />
                </SelectTrigger>
                <SelectContent className="bg-navy-700 border-navy-600">
                  <SelectItem value="urgent" className="text-white hover:bg-navy-600">Urgent</SelectItem>
                  <SelectItem value="month" className="text-white hover:bg-navy-600">Within a month</SelectItem>
                  <SelectItem value="planning" className="text-white hover:bg-navy-600">Still planning</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Dashboard Widgets */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <LeadsWidget count={24} newToday={5} />
          <RevenueWidget amount={12500} monthlyChange={15} />
          <RatingWidget rating={4.8} reviewCount={127} />
          <MessagesWidget unreadCount={3} />
          <ScheduleWidget upcomingJobs={7} />
        </div>

        {/* Contact Form Demo */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ContactForm variant="default" />
          <ContractorSearch />
        </div>
      </div>
    </div>
  );
}