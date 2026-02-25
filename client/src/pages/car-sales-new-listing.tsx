import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Car,
  DollarSign,
  Camera,
  FileText,
  MapPin,
  Calendar,
  Gauge,
  Fuel,
  Settings,
  Upload,
} from "lucide-react";

export default function CarSalesNewListing() {
  const [formData, setFormData] = useState({
    make: "",
    model: "",
    year: "",
    price: "",
    mileage: "",
    condition: "",
    fuelType: "",
    transmission: "",
    exteriorColor: "",
    interiorColor: "",
    description: "",
    features: [],
    images: [],
  });

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white py-8">
      <div className="container mx-auto px-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-orange-500/20 rounded-xl">
              <Car className="h-8 w-8 text-orange-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Create New Vehicle Listing</h1>
              <p className="text-gray-400">
                List your vehicle for sale on the TradeScout marketplace
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="h-5 w-5 text-orange-400" />
                  Vehicle Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="make">Make</Label>
                    <Input
                      id="make"
                      value={formData.make}
                      onChange={(e) => handleInputChange("make", e.target.value)}
                      placeholder="e.g., Toyota"
                      className="bg-navy-700/50 border-navy-600"
                    />
                  </div>
                  <div>
                    <Label htmlFor="model">Model</Label>
                    <Input
                      id="model"
                      value={formData.model}
                      onChange={(e) => handleInputChange("model", e.target.value)}
                      placeholder="e.g., Camry"
                      className="bg-navy-700/50 border-navy-600"
                    />
                  </div>
                  <div>
                    <Label htmlFor="year">Year</Label>
                    <Input
                      id="year"
                      type="number"
                      value={formData.year}
                      onChange={(e) => handleInputChange("year", e.target.value)}
                      placeholder="e.g., 2020"
                      className="bg-navy-700/50 border-navy-600"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price">Price ($)</Label>
                    <Input
                      id="price"
                      type="number"
                      value={formData.price}
                      onChange={(e) => handleInputChange("price", e.target.value)}
                      placeholder="25000"
                      className="bg-navy-700/50 border-navy-600"
                    />
                  </div>
                  <div>
                    <Label htmlFor="mileage">Mileage</Label>
                    <Input
                      id="mileage"
                      type="number"
                      value={formData.mileage}
                      onChange={(e) => handleInputChange("mileage", e.target.value)}
                      placeholder="50000"
                      className="bg-navy-700/50 border-navy-600"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Vehicle Details */}
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-orange-400" />
                  Vehicle Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="condition">Condition</Label>
                    <Select onValueChange={(value) => handleInputChange("condition", value)}>
                      <SelectTrigger className="bg-navy-700/50 border-navy-600">
                        <SelectValue placeholder="Select condition" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="excellent">Excellent</SelectItem>
                        <SelectItem value="very-good">Very Good</SelectItem>
                        <SelectItem value="good">Good</SelectItem>
                        <SelectItem value="fair">Fair</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="transmission">Transmission</Label>
                    <Select onValueChange={(value) => handleInputChange("transmission", value)}>
                      <SelectTrigger className="bg-navy-700/50 border-navy-600">
                        <SelectValue placeholder="Select transmission" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="automatic">Automatic</SelectItem>
                        <SelectItem value="manual">Manual</SelectItem>
                        <SelectItem value="cvt">CVT</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="fuelType">Fuel Type</Label>
                    <Select onValueChange={(value) => handleInputChange("fuelType", value)}>
                      <SelectTrigger className="bg-navy-700/50 border-navy-600">
                        <SelectValue placeholder="Select fuel type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="gasoline">Gasoline</SelectItem>
                        <SelectItem value="diesel">Diesel</SelectItem>
                        <SelectItem value="hybrid">Hybrid</SelectItem>
                        <SelectItem value="electric">Electric</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="exteriorColor">Exterior Color</Label>
                    <Input
                      id="exteriorColor"
                      value={formData.exteriorColor}
                      onChange={(e) => handleInputChange("exteriorColor", e.target.value)}
                      placeholder="e.g., Silver"
                      className="bg-navy-700/50 border-navy-600"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Description */}
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-400" />
                  Description
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Label htmlFor="description">Vehicle Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => handleInputChange("description", e.target.value)}
                  placeholder="Provide detailed information about your vehicle..."
                  className="bg-navy-700/50 border-navy-600 min-h-[120px]"
                />
              </CardContent>
            </Card>

            {/* Images */}
            <Card className="bg-navy-800/50 border-navy-600">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Camera className="h-5 w-5 text-orange-400" />
                  Photos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-navy-600 rounded-lg p-8 text-center">
                  <Upload className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400 mb-2">
                    Drop your vehicle photos here, or click to browse
                  </p>
                  <p className="text-sm text-gray-500">Upload up to 20 high-quality images</p>
                  <Button variant="outline" className="mt-4">
                    <Upload className="h-4 w-4 mr-2" />
                    Choose Files
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Action Buttons */}
            <div className="flex gap-4 pt-6">
              <Button
                size="lg"
                className="bg-orange-600 hover:bg-orange-700 flex-1"
                data-testid="button-publish-listing"
              >
                <Car className="h-5 w-5 mr-2" />
                Publish Listing
              </Button>
              <Button variant="outline" size="lg" data-testid="button-save-draft">
                Save as Draft
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
