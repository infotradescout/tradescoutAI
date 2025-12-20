import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Image as ImageIcon, Video, Smile } from "lucide-react";
import { useHandedness } from "@/hooks/useHandedness";

export interface CommunityComposerInlineProps {
  isAuthenticated: boolean;
  userInitial?: string;
  userAvatarUrl?: string;
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  onOpenRequest?: () => void;
  isSubmitting?: boolean;
}

export function CommunityComposerInline({
  isAuthenticated,
  userInitial,
  userAvatarUrl,
  value,
  onChange,
  onSubmit,
  onOpenRequest,
  isSubmitting,
}: CommunityComposerInlineProps) {
  const handedness = useHandedness();
  const handlePrimaryClick = () => {
    if (!value.trim() && onOpenRequest) {
      onOpenRequest();
      return;
    }
    if (value.trim()) {
      onSubmit();
    }
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
        <Separator className="bg-[#1f2937]" />
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 sm:gap-2 text-xs sm:text-sm">
            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 dark:text-slate-400">
              <ImageIcon className="w-4 h-4 mr-2" />
              Photo
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 dark:text-slate-400">
              <Video className="w-4 h-4 mr-2" />
              Video
            </Button>
            <Button variant="ghost" size="sm" className="h-8 px-2 text-slate-500 dark:text-slate-400">
              <Smile className="w-4 h-4 mr-2" />
              Feeling
            </Button>
          </div>
          <div
            className={`flex gap-1.5 sm:gap-2 ${
              handedness === "left" ? "justify-start" : "justify-end"
            } w-full sm:w-auto`}
          >
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
