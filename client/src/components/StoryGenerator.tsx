import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { 
  Sparkles, 
  Copy, 
  Share2, 
  Download, 
  Edit3, 
  Save, 
  RefreshCw,
  User,
  Briefcase,
  Star,
  Trophy,
  Heart,
  Target,
  Lightbulb,
  Zap
} from "lucide-react";

interface StoryTemplate {
  id: string;
  name: string;
  category: string;
  description: string;
  icon: React.ReactNode;
  prompts: string[];
  tone: 'professional' | 'friendly' | 'inspiring' | 'authoritative';
  length: 'short' | 'medium' | 'long';
}

interface GeneratedStory {
  id: string;
  template: string;
  content: string;
  title: string;
  createdAt: string;
}

const storyTemplates: StoryTemplate[] = [
  {
    id: 'origin-story',
    name: 'Origin Story',
    category: 'Background',
    description: 'Tell how you started your professional journey',
    icon: <Star className="h-4 w-4" />,
    prompts: [
      'What inspired you to enter this field?',
      'What was your first project or job?',
      'What challenges did you overcome early on?'
    ],
    tone: 'inspiring',
    length: 'medium'
  },
  {
    id: 'expertise-showcase',
    name: 'Expertise Showcase',
    category: 'Skills',
    description: 'Highlight your unique skills and experience',
    icon: <Trophy className="h-4 w-4" />,
    prompts: [
      'What makes your approach unique?',
      'What are your core specializations?',
      'What results have you achieved?'
    ],
    tone: 'professional',
    length: 'short'
  },
  {
    id: 'customer-focused',
    name: 'Customer-First Story',
    category: 'Values',
    description: 'Show your commitment to customer satisfaction',
    icon: <Heart className="h-4 w-4" />,
    prompts: [
      'How do you prioritize customer needs?',
      'Share a memorable customer success story',
      'What does quality service mean to you?'
    ],
    tone: 'friendly',
    length: 'medium'
  },
  {
    id: 'problem-solver',
    name: 'Problem Solver',
    category: 'Approach',
    description: 'Demonstrate your analytical and solution-focused mindset',
    icon: <Lightbulb className="h-4 w-4" />,
    prompts: [
      'Describe a complex challenge you solved',
      'What\'s your problem-solving process?',
      'How do you handle unexpected issues?'
    ],
    tone: 'authoritative',
    length: 'long'
  },
  {
    id: 'innovation-leader',
    name: 'Innovation Leader',
    category: 'Innovation',
    description: 'Share how you stay ahead with new techniques',
    icon: <Zap className="h-4 w-4" />,
    prompts: [
      'What new methods or technologies do you use?',
      'How do you stay current in your field?',
      'What innovations have you implemented?'
    ],
    tone: 'inspiring',
    length: 'medium'
  },
  {
    id: 'community-builder',
    name: 'Community Builder',
    category: 'Impact',
    description: 'Highlight your local community involvement',
    icon: <Target className="h-4 w-4" />,
    prompts: [
      'How do you contribute to your local community?',
      'What local partnerships have you built?',
      'How do you give back through your work?'
    ],
    tone: 'friendly',
    length: 'medium'
  }
];

export function StoryGenerator() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTemplate, setSelectedTemplate] = useState<StoryTemplate | null>(null);
  const [generatedStory, setGeneratedStory] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [editedStory, setEditedStory] = useState<string>('');
  const [activeCategory, setActiveCategory] = useState<string>('Background');

  const categories = [...new Set(storyTemplates.map(t => t.category))];

  const generateStoryMutation = useMutation({
    mutationFn: async ({ templateId, userInputs }: { templateId: string; userInputs: Record<string, string> }) => {
      return apiRequest("POST", "/api/stories/generate", {
        templateId,
        userInputs,
        userId: user?.id
      });
    },
    onSuccess: (data) => {
      setGeneratedStory(data.content);
      setEditedStory(data.content);
      toast({
        title: "Story Generated!",
        description: "Your professional story has been created successfully.",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: "Unable to generate story. Please try again.",
        variant: "destructive",
      });
    },
  });

  const saveStoryMutation = useMutation({
    mutationFn: async (story: { title: string; content: string; templateId: string }) => {
      return apiRequest("POST", "/api/stories", story);
    },
    onSuccess: () => {
      toast({
        title: "Story Saved!",
        description: "Your story has been saved to your profile.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/stories'] });
    },
  });

  const handleTemplateSelect = (template: StoryTemplate) => {
    setSelectedTemplate(template);
    setGeneratedStory('');
    setIsEditing(false);
  };

  const handleQuickGenerate = async (template: StoryTemplate) => {
    if (!user) {
      toast({
        title: "Login Required",
        description: "Please log in to generate stories.",
        variant: "destructive",
      });
      return;
    }

    const mockUserInputs = {
      role: user.role || 'contractor',
      experience: '5+ years',
      specialty: 'Custom work',
      location: 'Local area'
    };

    generateStoryMutation.mutate({
      templateId: template.id,
      userInputs: mockUserInputs
    });
  };

  const handleCopyStory = () => {
    navigator.clipboard.writeText(isEditing ? editedStory : generatedStory);
    toast({
      title: "Copied!",
      description: "Story copied to clipboard.",
    });
  };

  const handleSaveStory = () => {
    if (!selectedTemplate) return;
    
    saveStoryMutation.mutate({
      title: selectedTemplate.name,
      content: isEditing ? editedStory : generatedStory,
      templateId: selectedTemplate.id
    });
  };

  const filteredTemplates = storyTemplates.filter(t => t.category === activeCategory);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-2">
          <Sparkles className="h-6 w-6 text-yellow-500" />
          <h2 className="text-2xl font-bold">Professional Story Generator</h2>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Create compelling professional stories in one click using our narrative templates
        </p>
      </div>

      <Tabs value={activeCategory} onValueChange={setActiveCategory} className="space-y-4">
        <TabsList className="grid w-full grid-cols-6 lg:grid-cols-6">
          {categories.map((category) => (
            <TabsTrigger key={category} value={category} className="text-xs">
              {category}
            </TabsTrigger>
          ))}
        </TabsList>

        {categories.map((category) => (
          <TabsContent key={category} value={category} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {template.icon}
                        <CardTitle className="text-sm">{template.name}</CardTitle>
                      </div>
                      <div className="flex gap-1">
                        <Badge variant="outline" className="text-xs">
                          {template.tone}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {template.length}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 space-y-3">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {template.description}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => handleQuickGenerate(template)}
                        disabled={generateStoryMutation.isPending}
                        className="flex-1"
                        data-testid={`button-quick-generate-${template.id}`}
                      >
                        {generateStoryMutation.isPending ? (
                          <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Zap className="h-3 w-3 mr-1" />
                        )}
                        Quick Generate
                      </Button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button 
                            size="sm" 
                            variant="outline"
                            onClick={() => handleTemplateSelect(template)}
                            data-testid={`button-customize-${template.id}`}
                          >
                            <Edit3 className="h-3 w-3" />
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              {template.icon}
                              {template.name} Generator
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <h4 className="font-medium">Template Prompts:</h4>
                              <ul className="space-y-1">
                                {template.prompts.map((prompt, index) => (
                                  <li key={index} className="text-sm text-gray-600 dark:text-gray-400 flex items-start gap-2">
                                    <span className="text-blue-500">•</span>
                                    {prompt}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            
                            {generatedStory && (
                              <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                  <h4 className="font-medium">Generated Story:</h4>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => setIsEditing(!isEditing)}
                                      data-testid="button-edit-story"
                                    >
                                      <Edit3 className="h-3 w-3 mr-1" />
                                      {isEditing ? 'Preview' : 'Edit'}
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={handleCopyStory}
                                      data-testid="button-copy-story"
                                    >
                                      <Copy className="h-3 w-3 mr-1" />
                                      Copy
                                    </Button>
                                    <Button
                                      size="sm"
                                      onClick={handleSaveStory}
                                      disabled={saveStoryMutation.isPending}
                                      data-testid="button-save-story"
                                    >
                                      <Save className="h-3 w-3 mr-1" />
                                      Save
                                    </Button>
                                  </div>
                                </div>
                                
                                {isEditing ? (
                                  <Textarea
                                    value={editedStory}
                                    onChange={(e) => setEditedStory(e.target.value)}
                                    className="min-h-[200px]"
                                    placeholder="Edit your story..."
                                    data-testid="textarea-edit-story"
                                  />
                                ) : (
                                  <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                                    <p className="whitespace-pre-wrap text-sm leading-relaxed" data-testid="text-generated-story">
                                      {editedStory || generatedStory}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                            
                            <Button
                              onClick={() => handleQuickGenerate(template)}
                              disabled={generateStoryMutation.isPending}
                              className="w-full"
                              data-testid="button-generate-story-dialog"
                            >
                              {generateStoryMutation.isPending ? (
                                <>
                                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                                  Generating Your Story...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Generate {template.name}
                                </>
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      
      {generatedStory && !selectedTemplate && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Your Generated Story
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <p className="whitespace-pre-wrap leading-relaxed" data-testid="text-quick-generated-story">
                {generatedStory}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleCopyStory} variant="outline" data-testid="button-copy-quick-story">
                <Copy className="h-4 w-4 mr-2" />
                Copy Story
              </Button>
              <Button onClick={handleSaveStory} disabled={saveStoryMutation.isPending} data-testid="button-save-quick-story">
                <Save className="h-4 w-4 mr-2" />
                Save to Profile
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}