import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Upload, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

type UploadSummary = {
  processed?: number;
  overridesMerged?: number;
  countyFiles?: number;
  guides?: number;
  bulkStored?: number;
  errors?: unknown[];
};

export default function AdminKnowledgeUploadPage() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [uploadSummary, setUploadSummary] = useState<UploadSummary | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (selected: File[]) => {
      const allowedTypes = [
        "application/json",
        "text/markdown",
        "text/plain",
        "image/png",
        "image/jpeg",
        "image/webp",
      ];
      const maxSizeMb = 10;
      const filtered = selected.filter((f) => {
        const okType =
          allowedTypes.includes(f.type) ||
          f.name.endsWith(".md") ||
          f.name.endsWith(".json") ||
          f.name.endsWith(".txt");
        const okSize = f.size <= maxSizeMb * 1024 * 1024;
        return okType && okSize;
      });
      if (!filtered.length) {
        throw new Error("No valid files. Allowed: json/md/txt/png/jpg/webp, max 10MB each.");
      }

      const formData = new FormData();
      filtered.forEach((f) => formData.append("files", f));

      const res = await fetch("/api/admin/knowledge/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: (data) => {
      setUploadSummary((data?.summary || null) as UploadSummary | null);
      toast({ title: "Upload complete", description: "Files sorted into knowledge cache" });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: formatUserFacingErrorMessage(error, "Upload failed."),
        variant: "destructive",
      });
    },
  });

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const list = e.target.files ? Array.from(e.target.files) : [];
    setFiles(list);
  };

  return (
    <div className="space-y-6">
      <Card className="border-white/10 bg-tsCard">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Upload className="w-5 h-5 text-ts-orange" /> Knowledge Upload
          </CardTitle>
          <CardDescription>
            Upload files (json, md, text, images). Backend sorts into overrides, county guides, or
            bulk storage.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            type="file"
            multiple
            onChange={onFileChange}
            className="bg-tsCard border-white/10"
          />
          <div className="flex items-center justify-between text-sm text-white/70">
            <span>{files.length} files selected</span>
            <Button
              size="sm"
              className="bg-ts-orange-dark hover:bg-ts-orange-dark"
              disabled={uploadMutation.isPending || files.length === 0}
              onClick={() => uploadMutation.mutate(files)}
            >
              {uploadMutation.isPending ? "Uploading..." : "Upload & Ingest"}
            </Button>
          </div>

          {uploadSummary && (
            <div className="text-xs text-white/70 space-y-1 bg-black/20 p-3 rounded border border-white/10">
              <div className="flex items-center gap-2 text-ts-orange font-semibold">
                <Info className="w-4 h-4" /> Ingest Summary
              </div>
              <div>Processed: {uploadSummary.processed ?? 0}</div>
              <div>Overrides merged: {uploadSummary.overridesMerged ?? 0}</div>
              <div>County files: {uploadSummary.countyFiles ?? 0}</div>
              <div>Guides: {uploadSummary.guides ?? 0}</div>
              <div>Bulk stored: {uploadSummary.bulkStored ?? 0}</div>
              <div>Errors: {uploadSummary.errors?.length || 0}</div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
