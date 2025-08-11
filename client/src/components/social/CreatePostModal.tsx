import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuth } from "@/hooks/useAuth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Image,
  MapPin,
  Users,
  Globe,
  X,
  Tag,
  MessageCircle,
  TrendingUp,
  Calendar,
  HelpCircle,
  ShoppingBag,
} from "lucide-react";

const createPostSchema = z.object({
  title: z.string().max(200, "Title must be less than 200 characters").optional(),
  content: z.string().min(1, "Content is required").max(2000, "Content must be less than 2000 characters"),
  postType: z.enum(["general", "projects", "recommendations", "questions", "marketplace", "events"]),
  visibility: z.enum(["public", "neighborhood", "county", "state"]),
  tags: z.array(z.string()).optional(),
  imageUrls: z.array(z.string()).optional(),
});

type CreatePostFormData = z.infer<typeof createPostSchema>;

interface CreatePostModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CreatePostModal({ open, onOpenChange }: CreatePostModalProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [currentTag, setCurrentTag] = useState("");

  const form = useForm<CreatePostFormData>({
    resolver: zodResolver(createPostSchema),
    defaultValues: {
      content: "",
      postType: "general",
      visibility: "neighborhood",
      tags: [],
      imageUrls: [],
    },
  });

  const createPostMutation = useMutation({
    mutationFn: (data: CreatePostFormData) => apiRequest('POST', '/api/social/posts', data),
    onSuccess: () => {
      toast({
        title: "Success",
        description: "Post created successfully!",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/social/feed'] });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create post",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreatePostFormData) => {
    createPostMutation.mutate(data);
  };

  const addTag = () => {
    if (currentTag.trim() && !form.getValues('tags')?.includes(currentTag.trim())) {
      const currentTags = form.getValues('tags') || [];
      form.setValue('tags', [...currentTags, currentTag.trim()]);
      setCurrentTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    const currentTags = form.getValues('tags') || [];
    form.setValue('tags', currentTags.filter(tag => tag !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const postTypes = [
    { value: "general", label: "General Discussion", icon: MessageCircle, description: "Share thoughts and general updates" },
    { value: "projects", label: "Projects", icon: TrendingUp, description: "Showcase your home projects" },
    { value: "recommendations", label: "Recommendations", icon: Users, description: "Share contractor or service recommendations" },
    { value: "questions", label: "Questions", icon: HelpCircle, description: "Ask for help or advice" },
    { value: "marketplace", label: "Marketplace", icon: ShoppingBag, description: "Buy, sell, or trade items" },
    { value: "events", label: "Events", icon: Calendar, description: "Share community events" },
  ];

  const visibilityOptions = [
    { value: "neighborhood", label: "Neighborhood", icon: MapPin, description: "Visible to your immediate neighbors" },
    { value: "county", label: "County", icon: Users, description: "Visible to your entire county" },
    { value: "state", label: "State", icon: Globe, description: "Visible to your state" },
    { value: "public", label: "Public", icon: Globe, description: "Visible to everyone" },
  ];

  const getPostTypeIcon = (type: string) => {
    const postType = postTypes.find(pt => pt.value === type);
    const IconComponent = postType?.icon || MessageCircle;
    return <IconComponent className="h-4 w-4" />;
  };

  const getVisibilityIcon = (visibility: string) => {
    const visibilityOption = visibilityOptions.find(vo => vo.value === visibility);
    const IconComponent = visibilityOption?.icon || MapPin;
    return <IconComponent className="h-4 w-4" />;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Post</DialogTitle>
          <DialogDescription>
            Share something with your community
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Author Info */}
            <div className="flex items-center space-x-3 pb-3 border-b">
              <Avatar className="h-10 w-10">
                <AvatarImage src={user?.profileImageUrl} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {user?.firstName?.[0]}{user?.lastName?.[0]}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-semibold text-sm">
                  {user?.firstName} {user?.lastName}
                </div>
                <div className="text-xs text-muted-foreground">
                  Posting as {user?.role}
                </div>
              </div>
            </div>

            {/* Post Type */}
            <FormField
              control={form.control}
              name="postType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Post Type</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {postTypes.map((type) => (
                      <Card
                        key={type.value}
                        className={`cursor-pointer transition-all ${
                          field.value === type.value 
                            ? 'ring-2 ring-primary bg-primary/5' 
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => field.onChange(type.value)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-2">
                            <type.icon className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">{type.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {type.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Title (Optional) */}
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Title (Optional)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Give your post a title..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Content */}
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Content</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="What's happening in your neighborhood?"
                      rows={6}
                      {...field}
                    />
                  </FormControl>
                  <div className="text-xs text-muted-foreground text-right">
                    {field.value?.length || 0}/2000 characters
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Visibility */}
            <FormField
              control={form.control}
              name="visibility"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Visibility</FormLabel>
                  <div className="grid grid-cols-2 gap-3">
                    {visibilityOptions.map((option) => (
                      <Card
                        key={option.value}
                        className={`cursor-pointer transition-all ${
                          field.value === option.value 
                            ? 'ring-2 ring-primary bg-primary/5' 
                            : 'hover:bg-accent'
                        }`}
                        onClick={() => field.onChange(option.value)}
                      >
                        <CardContent className="p-3">
                          <div className="flex items-center space-x-2">
                            <option.icon className="h-4 w-4 text-primary" />
                            <span className="font-medium text-sm">{option.label}</span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {option.description}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Tags</label>
              <div className="flex space-x-2">
                <div className="flex-1">
                  <Input
                    placeholder="Add a tag..."
                    value={currentTag}
                    onChange={(e) => setCurrentTag(e.target.value)}
                    onKeyPress={handleKeyPress}
                  />
                </div>
                <Button type="button" onClick={addTag} size="sm">
                  <Tag className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
              {form.getValues('tags') && form.getValues('tags')!.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.getValues('tags')!.map((tag, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      #{tag}
                      <X
                        className="h-3 w-3 cursor-pointer hover:text-destructive"
                        onClick={() => removeTag(tag)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Preview */}
            {(form.watch('content') || form.watch('title')) && (
              <div className="space-y-2">
                <label className="text-sm font-medium">Preview</label>
                <Card className="border-dashed">
                  <CardContent className="p-4">
                    <div className="flex items-start space-x-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={user?.profileImageUrl} />
                        <AvatarFallback className="bg-primary/10 text-primary text-xs">
                          {user?.firstName?.[0]}{user?.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">
                            {user?.firstName} {user?.lastName}
                          </span>
                          <div className="flex items-center gap-1">
                            {getPostTypeIcon(form.watch('postType'))}
                            <span className="text-xs text-muted-foreground capitalize">
                              {form.watch('postType')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
                            {getVisibilityIcon(form.watch('visibility'))}
                            <span className="text-xs text-muted-foreground capitalize">
                              {form.watch('visibility')}
                            </span>
                          </div>
                        </div>
                        {form.watch('title') && (
                          <h4 className="font-semibold text-sm">{form.watch('title')}</h4>
                        )}
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                          {form.watch('content')}
                        </p>
                        {form.watch('tags') && form.watch('tags')!.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {form.watch('tags')!.map((tag, index) => (
                              <Badge key={index} variant="outline" className="text-xs">
                                #{tag}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end space-x-3 pt-4 border-t">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createPostMutation.isPending}
                className="min-w-[100px]"
              >
                {createPostMutation.isPending ? "Posting..." : "Post"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}