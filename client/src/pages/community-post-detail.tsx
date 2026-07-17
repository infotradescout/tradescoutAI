import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Calendar, MapPin, MessageSquare, ShieldCheck } from "lucide-react";
import { Link, useParams } from "wouter";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SEOHelmet } from "@/components/SEOHelmet";
import { ShareButton } from "@/components/ShareButton";
import {
  buildCommunityPostPath,
  createCommunityPostShareMetadata,
  listCommunityPostImageUrls,
} from "@shared/communityPostShare";

type PublicCommunityPost = {
  id: string;
  title?: string | null;
  content: string;
  imageUrls?: string[];
  stateCode?: string | null;
  countyFips?: string | null;
  cityName?: string | null;
  regionName?: string | null;
  category?: string | null;
  tags?: string[];
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  isPinned?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
  author: {
    id: string;
    name: string;
    avatar?: string | null;
    role?: string | null;
    verified?: boolean;
    badges?: string[];
  };
};

const PUBLIC_ORIGIN = "https://www.thetradescout.com";

export default function CommunityPostDetail() {
  const { postId } = useParams<{ postId: string }>();
  const {
    data: post,
    isLoading,
    error,
  } = useQuery<PublicCommunityPost>({
    queryKey: ["/api/community/posts", postId, "public-detail"],
    enabled: Boolean(postId),
    queryFn: async () => {
      const response = await fetch(`/api/community/posts/${encodeURIComponent(postId || "")}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Community post not found");
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <main className="mx-auto flex min-h-[55vh] max-w-4xl items-center justify-center px-4 py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-ts-orange/30 border-t-transparent" />
      </main>
    );
  }

  if (error || !post) {
    return (
      <main className="mx-auto max-w-3xl px-4 py-16">
        <Card className="border-white/10 bg-tsCard">
          <CardContent className="p-8 text-center">
            <MessageSquare className="mx-auto h-10 w-10 text-white/50" />
            <h1 className="mt-4 text-2xl font-semibold text-white">Post not available</h1>
            <p className="mt-2 text-sm text-white/60">
              This post is private, hidden, removed, or no longer available.
            </p>
            <Button asChild className="mt-6">
              <Link href="/community-feed">Return to Community</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const postPath = buildCommunityPostPath(post.id);
  const shareMeta = createCommunityPostShareMetadata({ post, origin: PUBLIC_ORIGIN });
  const images = listCommunityPostImageUrls(post.imageUrls);
  const title = post.title?.trim() || shareMeta?.title || "Community post";
  const location = [post.cityName || post.regionName, post.stateCode].filter(Boolean).join(", ");
  const publishedDate = post.createdAt
    ? new Date(post.createdAt).toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SocialMediaPosting",
    headline: title,
    articleBody: post.content,
    image: shareMeta?.imageUrl ? [shareMeta.imageUrl] : undefined,
    datePublished: post.createdAt || undefined,
    dateModified: post.updatedAt || undefined,
    author: { "@type": "Person", name: post.author.name },
    url: shareMeta?.canonical || `${PUBLIC_ORIGIN}${postPath}`,
  };

  return (
    <>
      <SEOHelmet
        title={shareMeta?.title || title}
        description={shareMeta?.description}
        canonical={shareMeta?.canonical || `${PUBLIC_ORIGIN}${postPath}`}
        ogType="article"
        ogImage={shareMeta?.imageUrl || undefined}
        structuredData={structuredData}
      />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="ghost" className="text-white/70 hover:text-white">
            <Link href="/community-feed">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Community
            </Link>
          </Button>
          <ShareButton
            destination={postPath}
            title={title}
            text={shareMeta?.description || post.content}
            className="border-white/20 text-white"
          />
        </div>

        <article>
          <Card className="overflow-hidden border-white/10 bg-tsCard">
            <CardContent className="p-0">
              <div className="space-y-5 p-6 sm:p-8">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 border border-white/15">
                      <AvatarImage src={post.author.avatar || undefined} alt={post.author.name} />
                      <AvatarFallback className="bg-ts-orange text-white">
                        {post.author.name.charAt(0).toUpperCase() || "T"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-white">{post.author.name}</span>
                        {post.author.verified ? (
                          <Badge className="bg-emerald-600 text-white">Verified</Badge>
                        ) : null}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-white/60">
                        {publishedDate ? (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {publishedDate}
                          </span>
                        ) : null}
                        {location ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {location}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                  {post.category ? <Badge variant="secondary">{post.category}</Badge> : null}
                </div>

                <div>
                  <h1 className="text-2xl font-bold text-white sm:text-3xl">{title}</h1>
                  <p className="mt-4 whitespace-pre-wrap text-base leading-relaxed text-white/80">
                    {post.content}
                  </p>
                </div>

                {post.tags && post.tags.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {post.tags.slice(0, 12).map((tag) => (
                      <Badge key={tag} variant="outline" className="border-white/15 text-white/70">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                ) : null}
              </div>

              {images.length > 0 ? (
                <div
                  className={`grid gap-1 bg-black/20 ${images.length > 1 ? "sm:grid-cols-2" : ""}`}
                >
                  {images.map((image, index) => (
                    <a key={image} href={image} target="_blank" rel="noreferrer">
                      <img
                        src={image}
                        alt={`${title} image ${index + 1}`}
                        className="max-h-[36rem] w-full object-cover"
                        loading={index === 0 ? "eager" : "lazy"}
                      />
                    </a>
                  ))}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-5 text-sm text-white/60">
                <div className="flex gap-4">
                  <span>{Number(post.likeCount || 0)} likes</span>
                  <span>{Number(post.commentCount || 0)} comments</span>
                </div>
                <ShareButton
                  destination={postPath}
                  title={title}
                  text={shareMeta?.description || post.content}
                  className="border-white/20 text-white"
                />
              </div>
            </CardContent>
          </Card>
        </article>

        <div className="mt-6 rounded-xl border border-white/10 bg-tsCard/60 p-4 text-sm text-white/70">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-ts-orange" />
            <p>
              Anyone can read this public post. Community actions remain tied to local context,
              trust, and TradeScout&apos;s protected connection flow.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
