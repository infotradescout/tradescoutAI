import React from "react";
import { useAuth } from "@/hooks/useAuth";
import RecommendationGenerator from "@/components/RecommendationGenerator";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function RecommendationGeneratorPage() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-32 bg-gray-200 rounded"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="h-40 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Authentication Required</h2>
            <p className="text-gray-600 mb-6">
              Please log in to access the Smart Recommendation Generator.
            </p>
            <Button asChild>
              <Link href="/pre-scout-setup?mode=signin">Log In</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.role !== "contractor_user") {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="text-center py-12">
            <AlertCircle className="mx-auto h-12 w-12 text-orange-400 mb-4" />
            <h2 className="text-xl font-semibold text-gray-900 mb-2">Contractor Access Only</h2>
            <p className="text-gray-600 mb-6">
              The Smart Recommendation Generator is exclusively available to contractors. This
              powerful tool helps contractors analyze their performance, set goals, and create
              automated campaigns to increase customer recommendations.
            </p>
            <div className="flex gap-4 justify-center">
              <Button variant="outline" asChild>
                <Link href="/">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Go Home
                </Link>
              </Button>
              {user.role === "homeowner" && (
                <Button asChild>
                  <Link href="/contractors">Find Contractors</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ backgroundColor: "var(--surface-app-bg)" }}>
      <div
        className="border-b"
        style={{
          backgroundColor: "var(--surface-frame)",
          borderColor: "var(--surface-frame-border)",
        }}
      >
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/contractor/dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Link>
            </Button>
            <div className="h-6 w-px bg-gray-300" />
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Smart Recommendation Generator
              </h1>
              <p className="text-sm text-gray-600">Grow your business with data-driven insights</p>
            </div>
          </div>
        </div>
      </div>

      <RecommendationGenerator />
    </div>
  );
}
