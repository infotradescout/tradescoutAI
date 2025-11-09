import { memo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Image, Type, Palette, Sparkles, Eye, Download, Share2 } from 'lucide-react';

const AdCreator = memo(function AdCreator() {
  const [adType, setAdType] = useState('social');
  const [selectedTemplate, setSelectedTemplate] = useState('modern');

  const adTemplates = [
    { 
      id: 'modern', 
      name: 'Modern Professional', 
      style: 'Clean lines with gradient background',
      preview: 'bg-gradient-to-br from-blue-600 to-purple-600'
    },
    { 
      id: 'bold', 
      name: 'Bold Impact', 
      style: 'High contrast with large text',
      preview: 'bg-gradient-to-r from-orange-500 to-red-500'
    },
    { 
      id: 'elegant', 
      name: 'Elegant Minimal', 
      style: 'Sophisticated with subtle accents',
      preview: 'bg-gradient-to-br from-slate-700 to-slate-900'
    },
    { 
      id: 'vibrant', 
      name: 'Vibrant Energy', 
      style: 'Colorful and attention-grabbing',
      preview: 'bg-gradient-to-r from-emerald-400 to-cyan-400'
    }
  ];

  const adSizes = {
    social: [
      { name: 'Facebook Post', size: '1200x630', ratio: '1.91:1' },
      { name: 'Instagram Square', size: '1080x1080', ratio: '1:1' },
      { name: 'Instagram Story', size: '1080x1920', ratio: '9:16' },
      { name: 'Twitter Header', size: '1500x500', ratio: '3:1' }
    ],
    display: [
      { name: 'Banner', size: '728x90', ratio: '8.1:1' },
      { name: 'Rectangle', size: '300x250', ratio: '1.2:1' },
      { name: 'Skyscraper', size: '160x600', ratio: '1:3.75' },
      { name: 'Mobile Banner', size: '320x50', ratio: '6.4:1' }
    ],
    print: [
      { name: 'Flyer', size: '8.5x11', ratio: '1:1.29' },
      { name: 'Business Card', size: '3.5x2', ratio: '1.75:1' },
      { name: 'Postcard', size: '6x4', ratio: '1.5:1' },
      { name: 'Yard Sign', size: '24x18', ratio: '1.33:1' }
    ]
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-4">Advertisement Creator</h1>
          <p className="text-xl text-gray-300">
            Create professional marketing materials to promote your services
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Ad Creation Panel */}
          <div className="lg:col-span-2 space-y-6">
            <Tabs value={adType} onValueChange={setAdType}>
              <TabsList className="grid w-full grid-cols-3 bg-[#1a2332]">
                <TabsTrigger value="social" className="data-[state=active]:bg-orange-600">Social Media</TabsTrigger>
                <TabsTrigger value="display" className="data-[state=active]:bg-orange-600">Display Ads</TabsTrigger>
                <TabsTrigger value="print" className="data-[state=active]:bg-orange-600">Print Materials</TabsTrigger>
              </TabsList>

              <TabsContent value={adType} className="space-y-6">
                {/* Ad Size Selection */}
                <Card className="bg-[#1a2332]/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white">Choose Ad Size</CardTitle>
                    <CardDescription className="text-gray-400">
                      Select the format for your advertisement
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {adSizes[adType as keyof typeof adSizes].map((size, index) => (
                        <div 
                          key={index}
                          className="p-4 border-2 border-slate-600 rounded-lg cursor-pointer hover:border-orange-500 transition-colors"
                        >
                          <h3 className="font-semibold text-white mb-1">{size.name}</h3>
                          <p className="text-gray-400 text-sm">{size.size} • {size.ratio}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Template Selection */}
                <Card className="bg-[#1a2332]/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Palette className="w-5 h-5 text-orange-500" />
                      Design Template
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Choose a template style for your advertisement
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {adTemplates.map((template) => (
                        <div 
                          key={template.id}
                          className={`p-4 border-2 rounded-lg cursor-pointer transition-all ${
                            selectedTemplate === template.id 
                              ? 'border-orange-500 bg-orange-500/10' 
                              : 'border-slate-600 hover:border-slate-500'
                          }`}
                          onClick={() => setSelectedTemplate(template.id)}
                        >
                          <div className={`h-20 rounded-lg mb-3 ${template.preview}`}></div>
                          <h3 className="font-semibold text-white mb-1">{template.name}</h3>
                          <p className="text-gray-400 text-sm">{template.style}</p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Content Input */}
                <Card className="bg-[#1a2332]/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Type className="w-5 h-5 text-orange-500" />
                      Ad Content
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Add your text, images, and promotional content
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="headline" className="text-gray-300">Headline</Label>
                      <Input 
                        id="headline"
                        placeholder="e.g., Transform Your Kitchen Today!"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="subheading" className="text-gray-300">Subheading</Label>
                      <Input 
                        id="subheading"
                        placeholder="e.g., Professional Renovation Services"
                        className="bg-slate-700 border-slate-600 text-white"
                      />
                    </div>

                    <div>
                      <Label htmlFor="description" className="text-gray-300">Description</Label>
                      <Textarea 
                        id="description"
                        placeholder="Brief description of your services and what makes you special..."
                        className="bg-slate-700 border-slate-600 text-white"
                        rows={3}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="cta-text" className="text-gray-300">Call-to-Action</Label>
                        <Input 
                          id="cta-text"
                          placeholder="Get Free Quote"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                      <div>
                        <Label htmlFor="contact-info" className="text-gray-300">Contact Info</Label>
                        <Input 
                          id="contact-info"
                          placeholder="(555) 123-4567"
                          className="bg-slate-700 border-slate-600 text-white"
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="image-upload" className="text-gray-300">Upload Image</Label>
                      <div className="border-2 border-dashed border-slate-600 rounded-lg p-6 text-center">
                        <Image className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-400 text-sm">Drag & drop an image or click to browse</p>
                        <Button variant="outline" size="sm" className="mt-2">
                          Upload Image
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* AI Enhancement */}
                <Card className="bg-[#1a2332]/50 border-slate-700">
                  <CardHeader>
                    <CardTitle className="text-white flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      AI Enhancement
                    </CardTitle>
                    <CardDescription className="text-gray-400">
                      Use AI to optimize your ad content and design
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Button variant="outline" className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Improve Headline
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Generate Description
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Suggest Colors
                      </Button>
                      <Button variant="outline" className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4" />
                        Optimize Layout
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Preview Panel */}
          <div className="space-y-6">
            <Card className="bg-[#1a2332]/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Eye className="w-5 h-5 text-orange-500" />
                  Live Preview
                </CardTitle>
                <CardDescription className="text-gray-400">
                  See how your ad will look
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Ad Preview */}
                <div className="bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg p-6 text-white aspect-video">
                  <div className="h-full flex flex-col justify-between">
                    <div>
                      <h2 className="text-xl font-bold mb-2">Transform Your Kitchen Today!</h2>
                      <p className="text-blue-100 text-sm mb-2">Professional Renovation Services</p>
                      <p className="text-blue-200 text-xs">Expert craftsmanship with guaranteed satisfaction...</p>
                    </div>
                    <div className="flex items-end justify-between">
                      <Button size="sm" className="bg-[#0f1419] text-blue-600 hover:bg-blue-50">
                        Get Free Quote
                      </Button>
                      <p className="text-blue-100 text-xs">(555) 123-4567</p>
                    </div>
                  </div>
                </div>

                {/* Preview Options */}
                <div className="mt-4 space-y-2">
                  <Button variant="outline" size="sm" className="w-full">
                    <Eye className="w-4 h-4 mr-2" />
                    Preview Different Sizes
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card className="bg-[#1a2332]/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Export & Share</CardTitle>
                <CardDescription className="text-gray-400">
                  Download or share your advertisement
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full bg-orange-600 hover:bg-orange-700">
                  <Download className="w-4 h-4 mr-2" />
                  Download High-Res
                </Button>
                <Button variant="outline" className="w-full">
                  <Share2 className="w-4 h-4 mr-2" />
                  Share Preview Link
                </Button>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" size="sm">PNG</Button>
                  <Button variant="outline" size="sm">JPG</Button>
                  <Button variant="outline" size="sm">PDF</Button>
                  <Button variant="outline" size="sm">SVG</Button>
                </div>
              </CardContent>
            </Card>

            {/* Performance Tips */}
            <Card className="bg-[#1a2332]/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white text-sm">Performance Tips</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 text-sm text-gray-400">
                  <p>• Use clear, action-oriented headlines</p>
                  <p>• Include your phone number prominently</p>
                  <p>• Highlight your unique value proposition</p>
                  <p>• Use high-quality, relevant images</p>
                  <p>• Keep text readable on mobile devices</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
});

export default AdCreator;