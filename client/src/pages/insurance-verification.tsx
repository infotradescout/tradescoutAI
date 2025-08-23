import { memo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Upload, Shield, CheckCircle, AlertTriangle, FileText } from 'lucide-react';

const InsuranceVerification = memo(function InsuranceVerification() {
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);

  const insuranceRequirements = [
    {
      type: "General Liability",
      minimum: "$1,000,000",
      required: true,
      description: "Covers property damage and bodily injury claims"
    },
    {
      type: "Workers' Compensation",
      minimum: "State Required",
      required: true,
      description: "Required for businesses with employees"
    },
    {
      type: "Professional Liability",
      minimum: "$500,000",
      required: false,
      description: "Covers errors and omissions in professional services"
    },
    {
      type: "Commercial Auto",
      minimum: "$500,000",
      required: false,
      description: "Required if using vehicles for business"
    }
  ];

  const handleFileUpload = (insuranceType: string) => {
    // Simulate file upload
    setUploadedFiles([...uploadedFiles, insuranceType]);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Insurance Verification</h1>
          <p className="text-xl text-gray-300">
            Upload your insurance certificates to complete professional verification
          </p>
        </div>

        {/* Requirements Overview */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white flex items-center gap-2">
              <Shield className="w-5 h-5 text-orange-500" />
              Insurance Requirements
            </CardTitle>
            <CardDescription className="text-gray-400">
              Ensure your insurance meets our minimum requirements for contractor verification
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {insuranceRequirements.map((req, index) => {
                const isUploaded = uploadedFiles.includes(req.type);
                return (
                  <div 
                    key={index} 
                    className={`p-4 rounded-lg border-2 ${
                      isUploaded 
                        ? 'border-emerald-500/50 bg-emerald-500/10' 
                        : req.required 
                        ? 'border-red-500/50 bg-red-500/10' 
                        : 'border-blue-500/50 bg-blue-500/10'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-white">{req.type}</h3>
                        <p className="text-sm text-gray-400">{req.minimum} minimum</p>
                      </div>
                      <div className="flex items-center gap-2">
                        {req.required && (
                          <Badge variant="destructive" className="text-xs">Required</Badge>
                        )}
                        {isUploaded && (
                          <CheckCircle className="w-5 h-5 text-emerald-400" />
                        )}
                      </div>
                    </div>
                    
                    <p className="text-sm text-gray-300 mb-4">{req.description}</p>
                    
                    {!isUploaded ? (
                      <Button 
                        onClick={() => handleFileUpload(req.type)}
                        size="sm" 
                        className={`w-full ${
                          req.required 
                            ? 'bg-red-600 hover:bg-red-700' 
                            : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                      >
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Certificate
                      </Button>
                    ) : (
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Certificate Uploaded</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Upload Form */}
        <Card className="bg-slate-800/50 border-slate-700 mb-8">
          <CardHeader>
            <CardTitle className="text-white">Insurance Certificate Upload</CardTitle>
            <CardDescription className="text-gray-400">
              Upload clear, high-resolution images or PDFs of your insurance certificates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* General Liability */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-white">General Liability Insurance</h3>
                  <Badge variant="destructive">Required</Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="gl-policy" className="text-gray-300">Policy Number</Label>
                    <Input 
                      id="gl-policy"
                      placeholder="Enter policy number"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gl-coverage" className="text-gray-300">Coverage Amount</Label>
                    <Input 
                      id="gl-coverage"
                      placeholder="e.g., $1,000,000"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gl-carrier" className="text-gray-300">Insurance Carrier</Label>
                    <Input 
                      id="gl-carrier"
                      placeholder="Enter carrier name"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                  <div>
                    <Label htmlFor="gl-expiry" className="text-gray-300">Expiration Date</Label>
                    <Input 
                      id="gl-expiry"
                      type="date"
                      className="bg-slate-700 border-slate-600 text-white"
                    />
                  </div>
                </div>
                
                <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
                  <Upload className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-300 mb-2">Drop your certificate here or click to browse</p>
                  <p className="text-sm text-gray-500">Supported formats: PDF, JPG, PNG (Max 10MB)</p>
                  <Button variant="outline" className="mt-4">
                    Select File
                  </Button>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-6">
                <div className="bg-blue-600/10 border border-blue-600/20 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <FileText className="w-5 h-5 text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-400 mb-2">Certificate Requirements</h4>
                      <ul className="space-y-1 text-sm text-gray-300">
                        <li>• Certificate must be current and not expired</li>
                        <li>• Coverage amounts must meet minimum requirements</li>
                        <li>• Certificate must show your business name exactly as registered</li>
                        <li>• Additional insured requirements may apply for certain projects</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-yellow-600/10 border border-yellow-600/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-yellow-400 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-yellow-400 mb-2">Important Notes</h4>
                    <ul className="space-y-1 text-sm text-gray-300">
                      <li>• Certificates are verified by our insurance partners</li>
                      <li>• Verification typically takes 1-2 business days</li>
                      <li>• You'll receive email notifications about verification status</li>
                      <li>• Expired certificates must be renewed to maintain verification</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button variant="outline" className="flex-1">
            Save as Draft
          </Button>
          <Button className="flex-1 bg-orange-600 hover:bg-orange-700">
            Submit for Verification
          </Button>
        </div>
      </div>
    </div>
  );
});

export default InsuranceVerification;