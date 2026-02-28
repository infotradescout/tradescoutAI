import { memo } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const CountyHub = memo(function CountyHub() {
  return (
    <div className="text-white px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <Card className="bg-tsCard border border-white/10">
          <CardHeader>
            <CardTitle>County hub</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-white/60">
              This page used to show placeholder content. County pages are now generated from real
              county/state data.
            </p>
            <Link href="/county-directory">
              <Button className="bg-ts-orange hover:bg-ts-orange/90 text-black font-semibold">
                Open county directory
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
});

export default CountyHub;
