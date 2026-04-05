import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Image as ImageIcon,
  Video,
  Smile,
  X,
  Send,
  AlertCircle,
  Hammer,
  ThumbsUp,
  MessageSquare,
  ShieldCheck,
} from "lucide-react";
import { uploadObject } from "@/lib/objectUpload";
import { cn } from "@/lib/utils";

export interface CommunityComposerInlineProps {
  isAuthenticated: boolean;
  userInitial?: string;
  userAvatarUrl?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onSubmitWithMeta?: (meta: { postType: PostType }) => void;
  onOpenRequest?: () => void;
  isSubmitting?: boolean;
  images?: string[];
  onImagesChange?: (images: string[]) => void;
  maxImages?: number;
}

export type PostType = "alert" | "project" | "recommendation" | "discussion" | "admin_notice";

const POST_TYPE_CONFIG: Record<
  PostType,
  { label: string; icon: any; color: string; bg: string; border: string }
> = {
  discussion: {
    label: "Discussion",
    icon: MessageSquare,
    color: "text-blue-400",
    bg: "bg-blue-400/10",
    border: "border-blue-400/20",
  },
  project: {
    label: "Project",
    icon: Hammer,
    color: "text-purple-400",
    bg: "bg-purple-400/10",
    border: "border-purple-400/20",
  },
  recommendation: {
    label: "Trust Request",
    icon: ThumbsUp,
    color: "text-emerald-400",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
  },
  alert: {
    label: "Alert",
    icon: AlertCircle,
    color: "text-red-400",
    bg: "bg-red-400/10",
    border: "border-red-400/20",
  },
  admin_notice: {
    label: "Admin Notice",
    icon: ShieldCheck,
    color: "text-ts-orange",
    bg: "bg-ts-orange/10",
    border: "border-ts-orange/20",
  },
};

export function CommunityComposerInline({
  isAuthenticated,
  userInitial,
  userAvatarUrl,
  value,
  onChange,
  onSubmit,
  onOpenRequest,
  isSubmitting,
  images,
  onImagesChange,
  maxImages = 8,
  onSubmitWithMeta,
}: CommunityComposerInlineProps) {
  const [postType, setPostType] = React.useState<PostType>("discussion");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handlePrimaryClick = () => {
    if (!value.trim() && onOpenRequest) {
      onOpenRequest();
      return;
    }
    if (value.trim()) {
      if (onSubmitWithMeta) {
        onSubmitWithMeta({ postType });
      }
      onSubmit();
    }
  };

  const handleImagesSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onImagesChange) return;

    const existing = images ?? [];
    const remainingSlots = Math.max(0, maxImages - existing.length);
    const files = Array.from(event.target.files || []).slice(0, remainingSlots);

    const uploaded: string[] = [];
    for (const file of files) {
      try {
        const { publicUrl } = await uploadObject(file);
        uploaded.push(publicUrl);
      } catch (error) {
        console.error("Failed to upload community post image", error);
      }
    }

    if (uploaded.length) {
      onImagesChange([...existing, ...uploaded].slice(0, maxImages));
    }
    event.target.value = "";
  };

  const removeImage = (index: number) => {
    if (onImagesChange && images) {
      onImagesChange(images.filter((_, i) => i !== index));
    }
  };

  return (
    <div className="bg-[#141414] rounded-2xl border border-white/5 p-4 shadow-xl">
      <div className="flex gap-4">
        <Avatar className="h-10 w-10 border border-white/10 shrink-0">
          <AvatarImage src={userAvatarUrl} />
          <AvatarFallback className="bg-ts-orange text-black font-bold text-sm">
            {userInitial || "U"}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0 space-y-4">
          {/* Post Type Selector */}
          <div className="flex flex-wrap gap-2">
            {(Object.keys(POST_TYPE_CONFIG) as PostType[]).map((type) => {
              const config = POST_TYPE_CONFIG[type];
              const Icon = config.icon;
              const isActive = postType === type;

              return (
                <button
                  key={type}
                  onClick={() => setPostType(type)}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all border",
                    isActive
                      ? `${config.bg} ${config.color} ${config.border}`
                      : "bg-white/5 text-white/40 border-transparent hover:bg-white/10 hover:text-white/60"
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {config.label}
                </button>
              );
            })}
          </div>

          {/* Input Area */}
          <div className="relative group">
            <Textarea
              placeholder={
                isAuthenticated
                  ? "What's happening in your community?"
                  : "Sign in to join the conversation..."
              }
              value={value}
              onChange={(e) => onChange(e.target.value)}
              className="min-h-[100px] w-full bg-transparent border-none focus-visible:ring-0 p-0 text-base text-white placeholder:text-white/20 resize-none"
            />
          </div>

          {/* Image Preview */}
          {images && images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2">
              {images.map((url, index) => (
                <div
                  key={url + index}
                  className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group"
                >
                  <img src={url} alt="Upload" className="w-full h-full object-cover" />
                  <button
                    onClick={() => removeImage(index)}
                    className="absolute top-1.5 right-1.5 p-1 bg-black/60 hover:bg-black/80 rounded-full text-white transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Action Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-white/5">
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="text-white/40 hover:text-ts-orange hover:bg-ts-orange/10"
                onClick={() => fileInputRef.current?.click()}
              >
                <ImageIcon className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Photo</span>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImagesSelected}
                />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/40 hover:text-white hover:bg-white/5"
              >
                <Video className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Video</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-white/40 hover:text-white hover:bg-white/5"
              >
                <Smile className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Feeling</span>
              </Button>
            </div>

            <div className="flex items-center gap-3">
              {value.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange("")}
                  className="text-white/40 hover:text-white"
                >
                  Clear
                </Button>
              )}
              <Button
                onClick={handlePrimaryClick}
                disabled={!value.trim() || isSubmitting}
                className="bg-ts-orange hover:bg-ts-orange/90 text-black font-bold px-6 rounded-full h-9 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                    <span>Posting</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <span>Post</span>
                    <Send className="w-3.5 h-3.5" />
                  </div>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
