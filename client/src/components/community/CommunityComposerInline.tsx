import * as React from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Image as ImageIcon, Video, Smile } from "lucide-react";
import { useHandedness } from "@/hooks/useHandedness";
import { uploadObject } from "@/lib/objectUpload";

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

export type PostType =
  | "alert"
  | "project"
  | "recommendation"
  | "discussion"
  | "admin_notice";

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
  const handedness = useHandedness();
  const [postType, setPostType] = React.useState<PostType>("discussion");
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

  const handleImagesSelected = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (!onImagesChange) {
      event.target.value = "";
      return;
    }

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

  return (
    <div className="flex gap-3 sm:gap-4">
      <Avatar className="h-11 w-11 sm:h-12 sm:w-12 ring-2 ring-orange-500/40">
        <AvatarImage src={userAvatarUrl} />
        <AvatarFallback className="bg-gradient-to-br from-orange-500 to-orange-600 text-white text-lg font-semibold">
          {userInitial || "U"}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 space-y-3">
        {/* Post type selector: enforces intent */}
        <div className="flex items-center gap-2 text-[12px] text-slate-300">
          <span className="text-slate-500">Type:</span>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { k: "alert", label: "Alert" },
                { k: "project", label: "Project" },
                { k: "recommendation", label: "Recommendation" },
                { k: "discussion", label: "Discussion" },
                { k: "admin_notice", label: "Admin Notice" },
              ] as Array<{ k: PostType; label: string }>
            ).map((opt) => (
              <button
                key={opt.k}
                type="button"
                onClick={() => setPostType(opt.k)}
                className={`px-2 py-1 rounded-full border text-[11px] transition-colors ${
                  postType === opt.k
                    ? "bg-orange-500 text-black border-orange-400"
                    : "bg-slate-900 text-slate-300 border-slate-700 hover:border-orange-400"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
        <Textarea
          placeholder={
            isAuthenticated
              ? "Share an update with your community…"
              : "Browse without an account. Sign in when you want to post."
          }
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[72px] resize-none border-0 focus-visible:ring-0 px-0 text-white text-sm sm:text-base bg-transparent"
        />
        {images && images.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {images.map((url, index) => (
              <div
                key={url + index}
                className="relative w-20 h-20 rounded-md overflow-hidden border border-tsBorder"
              >
                <img
                  src={url}
                  alt="Post attachment"
                  className="w-full h-full object-cover"
                />
                {onImagesChange && (
                  <button
                    type="button"
                    className="absolute top-1 right-1 bg-black/60 rounded-full px-1 text-[10px] leading-none text-white"
                    onClick={() => {
                      const next = images.filter((_, i) => i !== index);
                      onImagesChange(next);
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        <Separator className="bg-tsBorder" />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex flex-wrap gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <label className="inline-flex items-center gap-2 h-8 px-2 text-slate-500 dark:text-slate-400 hover:text-slate-300 cursor-pointer">
              <ImageIcon className="w-4 h-4" />
              <span>Photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleImagesSelected}
              />
            </label>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 dark:text-slate-400">
              <Video className="w-4 h-4 mr-2" />
              Video
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 dark:text-slate-400">
              <Smile className="w-4 h-4 mr-2" />
              Feeling
            </Button>
          </div>
          <div className={`flex gap-1.5 sm:gap-2 ml-auto ${handedness === "left" ? "order-first" : ""}`}>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onChange("")}
            >
              Clear
            </Button>
            <Button
              onClick={handlePrimaryClick}
              disabled={!value.trim() || isSubmitting}
              className="bg-orange-500 hover:bg-orange-600 text-white px-4 sm:px-5"
            >
              {isSubmitting ? "Posting..." : "Post"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
