import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Car, 
  Calculator, 
  Search, 
  CheckCircle,
  DollarSign,
  Camera,
  FileText,
  Star
} from "lucide-react";

export default function CarSalesTradeIn() {
  const [vehicleInfo, setVehicleInfo] = useState({
    year: "",
    make: "",
    model: "",
    mileage: "",
    condition: "",
    vin: ""
  });

  const [tradeValue, setTradeValue] = useState(null);

  const handleInputChange = (field: string, value: string) => {
    setVehicleInfo(prev => ({ ...prev, [field]: value }));
  };

  const calculateTradeValue = () => {
    // Mock calculation - in real app would call KBB/Edmunds API
    const baseValue = 15000;
    const yearFactor = (2025 - parseInt(vehicleInfo.year)) * 500;
    const mileageFactor = (parseInt(vehicleInfo.mileage) / 1000) * 10;
    const conditionMultiplier = vehicleInfo.condition === "excellent" ? 1.1 : 
                               vehicleInfo.condition === "good" ? 1.0 : 0.9;
    
    const estimated = Math.max(1000, (baseValue - yearFactor - mileageFactor) * conditionMultiplier);
    setTradeValue(Math.round(estimated));
  };

  const recentTradeIns = [
    {
      id: 1,
      customer: "Sarah Johnson",
      vehicle: "2020 Honda Accord",
      mileage: "45,000",
      condition: "Good",
      tradeValue: "$18,500",
      newVehicle: "2024 Honda Pilot",
      date: "2 days ago",
      status: "Completed"
    },
    {
      id: 2,
      customer: "Mike Chen",
      vehicle: "2018 Toyota Camry",
      mileage: "62,000", 
      condition: "Excellent",
      tradeValue: "$16,200",
      newVehicle: "2024 Toyota Highlander",
      date: "1 week ago",
      status: "In Process"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Car className="h-8 w-8 text-purple-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Trade-In Valuations</h1>
              <p className="text-gray-400">Evaluate customer trade-in vehicles and process exchanges</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Trade-In Calculator */}
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calculator className="h-5 w-5 text-purple-400" />
                  Vehicle Appraisal
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      value={vehicleInfo.year}
                      onChange={(e) => handleInputChange("year", e.target.value)}
                      placeholder="2020"
                      className="bg-navy-700/50 border-navy-600"
                      data-testid="input-trade-year"
                    />
                  </div>
                  <div>
                    <Label htmlFor="make">Make</Label>
                    <Input
                      id="make"
                      value={vehicleInfo.make}
                      onChange={(e) => handleInputChange("make", e.target.value)}
                      placeholder="Toyota"
                      className="bg-navy-700/50 border-navy-600"
                      data-testid="input-trade-make"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="model">Model</Label>
                  <Input
                    id="model"
                    value={vehicleInfo.model}
                    onChange={(e) => handleInputChange("model", e.target.value)}
                    placeholder="Camry"
                    className="bg-navy-700/50 border-navy-600"
                    data-testid="input-trade-model"
                  />
                </div>

                <div>
                  <Label htmlFor="mileage">Mileage</Label>
                  <Input
                    id="mileage"
                    type="number"
                    value={vehicleInfo.mileage}
                    onChange={(e) => handleInputChange("mileage", e.target.value)}
                    placeholder="50000"
                    className="bg-navy-700/50 border-navy-600"
                    data-testid="input-trade-mileage"
                  />
                </div>

                <div>
                  <Label htmlFor="condition">Condition</Label>
                  <Select onValueChange={(value) => handleInputChange("condition", value)}>
                    <SelectTrigger className="bg-navy-700/50 border-navy-600" data-testid="select-trade-condition">
                      <SelectValue placeholder="Select condition" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="fair">Fair</SelectItem>
                      <SelectItem value="poor">Poor</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="vin">VIN (Optional)</Label>
                  <Input
                    id="vin"
                    value={vehicleInfo.vin}
                    onChange={(e) => handleInputChange("vin", e.target.value)}
                    placeholder="1HGCM82633A123456"
                    className="bg-navy-700/50 border-navy-600"
                    data-testid="input-trade-vin"
                  />
                </div>

                <Button 
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  onClick={calculateTradeValue}
                  data-testid="button-calculate-trade-value"
                >
                  <Calculator className="h-4 w-4 mr-2" />
                  Calculate Trade Value
                </Button>
              </CardContent>
            </Card>

            {/* Trade Value Results */}
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="h-5 w-5 text-green-400" />
                  Estimated Trade Value
                </CardTitle>
              </CardHeader>
              <CardContent>
                {tradeValue ? (
                  <div className="space-y-4">
                    <div className="text-center p-6 bg-green-500/10 rounded-lg">
                      <p className="text-sm text-gray-400 mb-2">Estimated Trade-In Value</p>
                      <p className="text-3xl font-bold text-green-400">${tradeValue.toLocaleString()}</p>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-400">Vehicle</span>
                        <span>{vehicleInfo.year} {vehicleInfo.make} {vehicleInfo.model}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Mileage</span>
                        <span>{vehicleInfo.mileage?.toLocaleString()} miles</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-400">Condition</span>
                        <span className="capitalize">{vehicleInfo.condition}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Button 
                        className="w-full bg-green-600 hover:bg-green-700"
                        data-testid="button-generate-offer"
                      >
                        <FileText className="h-4 w-4 mr-2" />
                        Generate Offer Letter
                      </Button>
                      <Button 
                        variant="outline" 
                        className="w-full"
                        data-testid="button-schedule-inspection"
                      >
                        <Camera className="h-4 w-4 mr-2" />
                        Schedule Inspection
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center p-8">
                    <Calculator className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-400">Enter vehicle details above to calculate trade-in value</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Recent Trade-Ins */}
          <Card className="bg-navy-800/50 border-navy-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-purple-400" />
                Recent Trade-In Appraisals
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentTradeIns.map((tradeIn) => (
                  <div key={tradeIn.id} className="flex items-center justify-between p-4 bg-navy-700/30 rounded-lg">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-purple-500/20 rounded-full flex items-center justify-center">
                        <Car className="h-6 w-6 text-purple-400" />
                      </div>
                      
                      <div>
                        <h4 className="font-semibold">{tradeIn.customer}</h4>
                        <p className="text-sm text-gray-400">{tradeIn.vehicle} • {tradeIn.mileage} miles</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="text-sm text-gray-400">Trade Value</p>
                          <p className="font-semibold text-green-400">{tradeIn.tradeValue}</p>
                        </div>
                        
                        <div>
                          <p className="text-sm text-gray-400">New Vehicle</p>
                          <p className="font-medium">{tradeIn.newVehicle}</p>
                        </div>

                        <Badge 
                          variant={tradeIn.status === "Completed" ? "default" : "secondary"}
                          className={tradeIn.status === "Completed" ? "bg-green-600" : ""}
                        >
                          {tradeIn.status}
                        </Badge>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}