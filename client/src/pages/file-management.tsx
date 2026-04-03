import { memo, useState } from 'react';
import { Upload, File, Image, Video, Trash2, Download, Eye, FolderPlus, Search, Filter, Grid3X3, List } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { Page, Section } from '@/components/layout/PagePrimitives';

const FileManagement = memo(function FileManagement() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<number[]>([]);
  const { toast } = useToast();

  const files = [
    {
      id: 1,
      name: 'contractor_license.pdf',
      type: 'document',
      size: '2.4 MB',
      uploadDate: '2024-03-20T10:30:00Z',
      category: 'verification',
      url: '/files/contractor_license.pdf',
      thumbnail: null
    },
    {
      id: 2,
      name: 'kitchen_before.jpg',
      type: 'image',
      size: '3.8 MB',
      uploadDate: '2024-03-19T14:15:00Z',
      category: 'project',
      url: '/files/kitchen_before.jpg',
      thumbnail: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=200&h=150&fit=crop'
    },
    {
      id: 3,
      name: 'project_walkthrough.mp4',
      type: 'video',
      size: '24.6 MB',
      uploadDate: '2024-03-18T09:45:00Z',
      category: 'project',
      url: '/files/project_walkthrough.mp4',
      thumbnail: 'https://images.unsplash.com/photo-1581094794329-c8112a89af12?w=200&h=150&fit=crop'
    },
    {
      id: 4,
      name: 'insurance_certificate.pdf',
      type: 'document',
      size: '1.2 MB',
      uploadDate: '2024-03-17T16:20:00Z',
      category: 'verification',
      url: '/files/insurance_certificate.pdf',
      thumbnail: null
    },
    {
      id: 5,
      name: 'bathroom_after.jpg',
      type: 'image',
      size: '4.1 MB',
      uploadDate: '2024-03-16T11:30:00Z',
      category: 'project',
      url: '/files/bathroom_after.jpg',
      thumbnail: 'https://images.unsplash.com/photo-1584622650111-993a426fbf0a?w=200&h=150&fit=crop'
    },
    {
      id: 6,
      name: 'quote_estimate.pdf',
      type: 'document',
      size: '0.8 MB',
      uploadDate: '2024-03-15T13:10:00Z',
      category: 'business',
      url: '/files/quote_estimate.pdf',
      thumbnail: null
    }
  ];

  const categories = [
    { value: 'all', label: 'All Files', count: files.length },
    { value: 'verification', label: 'Verification', count: files.filter(f => f.category === 'verification').length },
    { value: 'project', label: 'Project Files', count: files.filter(f => f.category === 'project').length },
    { value: 'business', label: 'Business', count: files.filter(f => f.category === 'business').length }
  ];

  const fileStats = {
    total: files.length,
    totalSize: files.reduce((acc, file) => acc + parseFloat(file.size.replace(' MB', '')), 0),
    images: files.filter(f => f.type === 'image').length,
    documents: files.filter(f => f.type === 'document').length,
    videos: files.filter(f => f.type === 'video').length
  };

  const getFileIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <Image className="h-8 w-8 text-blue-400" />;
      case 'video':
        return <Video className="h-8 w-8 text-purple-400" />;
      case 'document':
        return <File className="h-8 w-8 text-green-400" />;
      default:
        return <File className="h-8 w-8 text-white/60" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'verification':
        return 'bg-blue-600';
      case 'project':
        return 'bg-green-600';
      case 'business':
        return 'bg-purple-600';
      default:
        return 'bg-white/10';
    }
  };

  const handleFileUpload = () => {
    toast({
      title: "File Upload",
      description: "File upload functionality would be implemented here with drag-and-drop support.",
    });
  };

  const handleFileAction = (fileId: number, action: string) => {
    const file = files.find(f => f.id === fileId);
    toast({
      title: `File ${action}`,
      description: `${file?.name} has been ${action.toLowerCase()}.`,
    });
  };

  const handleBulkAction = (action: string) => {
    toast({
      title: `Bulk ${action}`,
      description: `${selectedFiles.length} files have been ${action.toLowerCase()}.`,
    });
    setSelectedFiles([]);
  };

  const toggleFileSelection = (fileId: number) => {
    setSelectedFiles(prev => 
      prev.includes(fileId) 
        ? prev.filter(id => id !== fileId)
        : [...prev, fileId]
    );
  };

  const formatFileSize = (sizeStr: string) => {
    return sizeStr;
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <Page>
      <Section
        title={
          <span className="flex items-center gap-2">
            <Upload className="h-6 w-6 text-primary" />
            File Management
          </span>
        }
        subtitle="Upload, organize, and manage your files"
        actions={
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={handleFileUpload}
          >
            <Upload className="h-4 w-4 mr-2" />
            Upload Files
          </Button>
        }
      >

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-8">
        <Card className="bg-card border-border backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-foreground">{fileStats.total}</div>
            <div className="text-muted-foreground text-sm">Total Files</div>
          </CardContent>
        </Card>
        
        <Card className="bg-card border-border backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">{fileStats.images}</div>
            <div className="text-muted-foreground text-sm">Images</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border backdrop-blur-sm">
            <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-400">{fileStats.documents}</div>
            <div className="text-muted-foreground text-sm">Documents</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">{fileStats.videos}</div>
            <div className="text-muted-foreground text-sm">Videos</div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border backdrop-blur-sm">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-primary">{fileStats.totalSize.toFixed(1)}</div>
            <div className="text-muted-foreground text-sm">MB Used</div>
          </CardContent>
        </Card>
      </div>

      {/* File Management Interface */}
      <Card className="bg-card border-border backdrop-blur-sm">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-foreground">File Library</CardTitle>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('grid')}
                className={`border-border ${viewMode === 'grid' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                <Grid3X3 className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setViewMode('list')}
                className={`border-border ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
              >
                <List className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Controls */}
          <div className="flex flex-col md:flex-row gap-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search files..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 bg-background border-border text-foreground"
                />
              </div>
            </div>
            
            <Select>
              <SelectTrigger className="w-48 bg-background border-border text-foreground">
                <SelectValue placeholder="Filter by category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.value} value={category.value}>
                    {category.label} ({category.count})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              className="border-primary text-primary hover:bg-primary/20"
              onClick={handleFileUpload}
            >
              <FolderPlus className="h-4 w-4 mr-2" />
              New Folder
            </Button>
          </div>

          {/* Bulk Actions */}
          {selectedFiles.length > 0 && (
            <div className="flex items-center gap-2 mb-4 p-3 bg-muted rounded-lg">
              <span className="text-foreground">{selectedFiles.length} files selected</span>
              <div className="flex gap-2 ml-auto">
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-primary text-primary hover:bg-primary/20"
                  onClick={() => handleBulkAction('Downloaded')}
                >
                  <Download className="h-4 w-4 mr-1" />
                  Download
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  className="border-destructive text-destructive hover:bg-destructive/20"
                  onClick={() => handleBulkAction('Deleted')}
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete
                </Button>
              </div>
            </div>
          )}

          {/* File Grid/List */}
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {files.map((file) => (
                <Card 
                  key={file.id} 
                  className={`bg-background border-border cursor-pointer transition-all hover:border-primary ${
                    selectedFiles.includes(file.id) ? 'ring-2 ring-primary border-primary' : ''
                  }`}
                  onClick={() => toggleFileSelection(file.id)}
                >
                  <CardContent className="p-4">
                    <div className="aspect-square bg-muted rounded-lg mb-3 flex items-center justify-center overflow-hidden">
                      {file.thumbnail ? (
                        <img 
                          src={file.thumbnail} 
                          alt={file.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        getFileIcon(file.type)
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <h3 className="text-foreground font-medium text-sm truncate">{file.name}</h3>
                      <div className="flex items-center justify-between">
                        <Badge className={getCategoryColor(file.category)}>
                          {file.category}
                        </Badge>
                        <span className="text-muted-foreground text-xs">{formatFileSize(file.size)}</span>
                      </div>
                      <p className="text-muted-foreground text-xs">{formatDate(file.uploadDate)}</p>
                    </div>

                    <div className="flex justify-end mt-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/20">
                            <Eye className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          <DropdownMenuItem onClick={() => handleFileAction(file.id, 'Viewed')}>
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleFileAction(file.id, 'Downloaded')}>
                            <Download className="h-4 w-4 mr-2" />
                            Download
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleFileAction(file.id, 'Deleted')}
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {files.map((file) => (
                <div 
                  key={file.id}
                  className={`flex items-center justify-between p-4 bg-background rounded-lg cursor-pointer transition-all hover:bg-muted ${
                    selectedFiles.includes(file.id) ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => toggleFileSelection(file.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                      {file.thumbnail ? (
                        <img 
                          src={file.thumbnail} 
                          alt={file.name}
                          className="w-full h-full object-cover rounded-lg"
                        />
                      ) : (
                        getFileIcon(file.type)
                      )}
                    </div>
                    
                    <div>
                      <h3 className="text-foreground font-medium">{file.name}</h3>
                      <div className="flex items-center gap-2">
                        <Badge className={getCategoryColor(file.category)}>
                          {file.category}
                        </Badge>
                        <span className="text-muted-foreground text-sm">{formatFileSize(file.size)}</span>
                        <span className="text-muted-foreground text-sm">•</span>
                        <span className="text-muted-foreground text-sm">{formatDate(file.uploadDate)}</span>
                      </div>
                    </div>
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="border-primary text-primary hover:bg-primary/20">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent>
                      <DropdownMenuItem onClick={() => handleFileAction(file.id, 'Viewed')}>
                        <Eye className="h-4 w-4 mr-2" />
                        View
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleFileAction(file.id, 'Downloaded')}>
                        <Download className="h-4 w-4 mr-2" />
                        Download
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => handleFileAction(file.id, 'Deleted')}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </Section>
    </Page>
  );
});
export default FileManagement;