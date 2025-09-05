import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { 
  Search, 
  Car, 
  FileText, 
  AlertCircle,
  CheckCircle,
  Calendar,
  Wrench,
  Shield,
  Award
} from "lucide-react";

interface VinData {
  year: string;
  make: string;
  model: string;
  trim: string;
  engine: string;
  transmission: string;
  drivetrain: string;
  fuelType: string;
  manufactured: string;
  bodyStyle: string;
  safetyRating: string;
  recalls: Array<{
    id: string;
    date: string;
    component: string;
    description: string;
    status: string;
  }>;
  serviceHistory: Array<{
    date: string;
    mileage: string;
    service: string;
    location: string;
  }>;
}

export default function CarSalesVinLookup() {
  const [vin, setVin] = useState("");
  const [vinData, setVinData] = useState<VinData | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const performVinLookup = async () => {
    if (vin.length !== 17) {
      alert("VIN must be exactly 17 characters");
      return;
    }

    setIsLoading(true);
    
    // Mock VIN lookup - in real app would call NHTSA/third-party API
    setTimeout(() => {
      const mockData = {
        year: "2022",
        make: "Toyota",
        model: "Camry",
        trim: "XLE",
        engine: "2.5L I4",
        transmission: "8-Speed Automatic",
        drivetrain: "FWD",
        fuelType: "Gasoline",
        manufactured: "Georgetown, KY, USA",
        bodyStyle: "4-Door Sedan",
        safetyRating: "5-Star Overall",
        recalls: [
          {
            id: "22V-123",
            date: "2022-03-15",
            component: "Fuel Pump",
            description: "Fuel pump may fail causing engine stall",
            status: "Remedy Available"
          }
        ],
        serviceHistory: [
          {
            date: "2024-01-15",
            mileage: "25,000",
            service: "Oil Change & Inspection",
            location: "Toyota Service Center"
          },
          {
            date: "2023-07-20", 
            mileage: "15,000",
            service: "Routine Maintenance",
            location: "Toyota Service Center"
          }
        ]
      };
      setVinData(mockData);
      setIsLoading(false);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white">
      <div className="container mx-auto px-6 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-500/20 rounded-xl">
              <Search className="h-8 w-8 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">VIN Lookup</h1>
              <p className="text-gray-400">Decode vehicle information and history by VIN</p>
            </div>
          </div>

          {/* VIN Input */}
          <Card className="bg-navy-800/50 border-navy-600 mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                Vehicle Identification Number
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="vin">Enter 17-Character VIN</Label>
                <Input
                  id="vin"
                  value={vin}
                  onChange={(e) => setVin(e.target.value.toUpperCase())}
                  placeholder="1HGCM82633A123456"
                  maxLength={17}
                  className="bg-navy-700/50 border-navy-600 text-lg font-mono"
                  data-testid="input-vin-number"
                />
                <div className="text-sm text-gray-400 mt-1">
                  {vin.length}/17 characters • VIN typically found on dashboard or driver door frame
                </div>
              </div>

              <Button 
                onClick={performVinLookup}
                disabled={vin.length !== 17 || isLoading}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                data-testid="button-lookup-vin"
              >
                <Search className="h-4 w-4 mr-2" />
                {isLoading ? "Decoding VIN..." : "Lookup Vehicle"}
              </Button>
            </CardContent>
          </Card>

          {/* VIN Results */}
          {isLoading && (
            <Card className="bg-navy-800/50 border-navy-600">
              <CardContent className="p-8 text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-400 mx-auto mb-4"></div>
                <h3 className="text-lg font-semibold mb-2">Decoding VIN</h3>
                <p className="text-gray-400">Retrieving vehicle information and history...</p>
              </CardContent>
            </Card>
          )}

          {vinData && !isLoading && (
            <div className="space-y-6">
              {/* Basic Vehicle Info */}
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Car className="h-5 w-5 text-indigo-400" />
                    Vehicle Specifications
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-gray-400">Year</p>
                      <p className="font-semibold">{vinData.year}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Make</p>
                      <p className="font-semibold">{vinData.make}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Model</p>
                      <p className="font-semibold">{vinData.model}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Trim</p>
                      <p className="font-semibold">{vinData.trim}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Engine</p>
                      <p className="font-semibold">{vinData.engine}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Transmission</p>
                      <p className="font-semibold">{vinData.transmission}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Drivetrain</p>
                      <p className="font-semibold">{vinData.drivetrain}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Fuel Type</p>
                      <p className="font-semibold">{vinData.fuelType}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-400">Body Style</p>
                      <p className="font-semibold">{vinData.bodyStyle}</p>
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-navy-700/30 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <Award className="h-4 w-4 text-yellow-400" />
                      <span className="font-medium">Safety Rating</span>
                    </div>
                    <p className="text-sm text-gray-300">{vinData.safetyRating}</p>
                  </div>

                  <div className="mt-3 text-sm text-gray-400">
                    <strong>Manufactured:</strong> {vinData.manufactured}
                  </div>
                </CardContent>
              </Card>

              {/* Recalls */}
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <AlertCircle className="h-5 w-5 text-orange-400" />
                    Safety Recalls
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {vinData.recalls.length > 0 ? (
                    <div className="space-y-3">
                      {vinData.recalls.map((recall, index) => (
                        <div key={index} className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                          <div className="flex items-center justify-between mb-2">
                            <Badge variant="secondary" className="bg-orange-600">
                              Recall #{recall.id}
                            </Badge>
                            <span className="text-sm text-gray-400">{recall.date}</span>
                          </div>
                          <h4 className="font-semibold mb-2">{recall.component}</h4>
                          <p className="text-sm text-gray-300 mb-2">{recall.description}</p>
                          <div className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-400" />
                            <span className="text-sm text-green-400">{recall.status}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center p-6">
                      <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                      <p className="text-green-400 font-medium">No Outstanding Recalls</p>
                      <p className="text-sm text-gray-400">This vehicle has no open safety recalls</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Service History */}
              <Card className="bg-navy-800/50 border-navy-600">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-blue-400" />
                    Service History
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {vinData.serviceHistory.map((service, index) => (
                      <div key={index} className="flex items-start gap-4 p-4 bg-navy-700/30 rounded-lg">
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
                          <Wrench className="h-6 w-6 text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="font-semibold">{service.service}</h4>
                            <div className="text-sm text-gray-400 flex items-center gap-2">
                              <Calendar className="h-4 w-4" />
                              {service.date}
                            </div>
                          </div>
                          <div className="text-sm text-gray-400">
                            <p>{service.mileage} miles • {service.location}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Actions */}
              <div className="flex gap-4">
                <Button 
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                  data-testid="button-save-report"
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Save VIN Report
                </Button>
                <Button 
                  variant="outline" 
                  className="flex-1"
                  data-testid="button-email-customer"
                >
                  Email to Customer
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}