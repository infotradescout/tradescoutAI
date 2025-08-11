import { SocialFeed } from '@/components/social/SocialFeed';
import { Toaster } from '@/components/ui/toaster';
import { ErrorBoundary } from '@/components/ui/error-boundary';

export default function Community() {
  return (
    <ErrorBoundary>
      <div className="min-h-screen">
        <SocialFeed />
        <Toaster />
      </div>
    </ErrorBoundary>
  );
}