import { Link } from "wouter";
import { Button } from "@/components/ui/button";

export function DirectoryListingLink({
  slug,
  businessName,
}: {
  slug: string;
  businessName: string;
}) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link
        href={`/business/${encodeURIComponent(slug)}`}
        aria-label={`View ${businessName} listing`}
      >
        View listing
      </Link>
    </Button>
  );
}
