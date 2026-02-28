import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { uploadPrivateObject } from "@/lib/privateObjectUpload";

const RECORD_TYPES = [
  { value: "service", label: "Service" },
  { value: "repair", label: "Repair" },
  { value: "upgrade", label: "Upgrade" },
  { value: "inspection", label: "Inspection" },
  { value: "accident", label: "Accident" },
  { value: "note", label: "Note" },
] as const;

const DOCUMENT_TYPES = [
  { value: "service_report", label: "Service report" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "photo", label: "Photo" },
  { value: "title", label: "Title" },
  { value: "other", label: "Other" },
] as const;

function formatVehicleTitle(v: any): string {
  const nickname = typeof v?.nickname === "string" ? v.nickname.trim() : "";
  if (nickname) return nickname;
  const year = v?.year != null ? String(v.year) : "";
  const make = typeof v?.make === "string" ? v.make.trim() : "";
  const model = typeof v?.model === "string" ? v.model.trim() : "";
  const trim = typeof v?.trim === "string" ? v.trim.trim() : "";
  const bits = [year, make, model, trim].filter(Boolean);
  return bits.join(" ") || "Vehicle";
}

export default function VehicleVault() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);

  const vehiclesQuery = useQuery({ queryKey: ["/api/vehicles"] });
  const vehicles = Array.isArray((vehiclesQuery.data as any)?.vehicles)
    ? (vehiclesQuery.data as any).vehicles
    : [];

  useEffect(() => {
    if (!selectedVehicleId && vehicles.length > 0) {
      setSelectedVehicleId(String(vehicles[0]?.id || ""));
    }
  }, [vehicles.length, selectedVehicleId]);

  const vehicleDetailQuery = useQuery({
    queryKey: [selectedVehicleId ? `/api/vehicles/${selectedVehicleId}` : "/api/vehicles/_none"],
    enabled: Boolean(selectedVehicleId),
  });

  const vehicleDetail = vehicleDetailQuery.data as any;
  const records = Array.isArray(vehicleDetail?.records) ? vehicleDetail.records : [];
  const documents = Array.isArray(vehicleDetail?.documents) ? vehicleDetail.documents : [];

  const [newVehicle, setNewVehicle] = useState({
    nickname: "",
    year: "",
    make: "",
    model: "",
    trim: "",
    vin: "",
    mileage: "",
  });

  const [newRecord, setNewRecord] = useState({
    recordType: "service",
    occurredAt: "",
    title: "",
    details: "",
    cost: "",
    mileage: "",
  });

  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]["value"]>("other");
  const [docFile, setDocFile] = useState<File | null>(null);

  const createVehicleMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nickname: newVehicle.nickname?.trim() || undefined,
        year: newVehicle.year?.trim() ? Number.parseInt(newVehicle.year, 10) : undefined,
        make: newVehicle.make?.trim() || undefined,
        model: newVehicle.model?.trim() || undefined,
        trim: newVehicle.trim?.trim() || undefined,
        vin: newVehicle.vin?.trim() || undefined,
        mileage: newVehicle.mileage?.trim() ? Number.parseInt(newVehicle.mileage, 10) : undefined,
      };
      return apiRequest("POST", "/api/vehicles", payload);
    },
    onSuccess: async (data: any) => {
      toast({ title: "Vehicle added" });
      setNewVehicle({
        nickname: "",
        year: "",
        make: "",
        model: "",
        trim: "",
        vin: "",
        mileage: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      const id = String(data?.vehicle?.id || "");
      if (id) setSelectedVehicleId(id);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add vehicle",
        description: err?.message || "Try again",
        variant: "destructive",
      });
    },
  });

  const addRecordMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVehicleId) throw new Error("Select a vehicle first");
      if (!newRecord.title.trim()) throw new Error("Title is required");
      const payload: any = {
        recordType: newRecord.recordType,
        occurredAt: newRecord.occurredAt?.trim() || undefined,
        title: newRecord.title.trim(),
        details: newRecord.details?.trim() || undefined,
        cost: newRecord.cost?.trim() ? Number.parseFloat(newRecord.cost) : undefined,
        mileage: newRecord.mileage?.trim() ? Number.parseInt(newRecord.mileage, 10) : undefined,
      };
      return apiRequest("POST", `/api/vehicles/${selectedVehicleId}/records`, payload);
    },
    onSuccess: async () => {
      toast({ title: "Record added" });
      setNewRecord({
        recordType: "service",
        occurredAt: "",
        title: "",
        details: "",
        cost: "",
        mileage: "",
      });
      if (selectedVehicleId) {
        await queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${selectedVehicleId}`] });
        await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add record",
        description: err?.message || "Try again",
        variant: "destructive",
      });
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVehicleId) throw new Error("Select a vehicle first");
      if (!docFile) throw new Error("Choose a file");

      const { objectKey } = await uploadPrivateObject(docFile);
      return apiRequest("POST", `/api/vehicles/${selectedVehicleId}/documents`, {
        documentType: docType,
        objectKey,
        originalName: docFile.name,
        contentType: docFile.type || "application/octet-stream",
        bytes: docFile.size,
      });
    },
    onSuccess: async () => {
      toast({ title: "Document uploaded" });
      setDocFile(null);
      setDocType("other");
      if (selectedVehicleId) {
        await queryClient.invalidateQueries({ queryKey: [`/api/vehicles/${selectedVehicleId}`] });
        await queryClient.invalidateQueries({ queryKey: ["/api/vehicles"] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Upload failed",
        description: err?.message || "Try again",
        variant: "destructive",
      });
    },
  });

  const prefillMutation = useMutation({
    mutationFn: async () => {
      if (!selectedVehicleId) throw new Error("Select a vehicle first");
      return apiRequest("GET", `/api/vehicles/${selectedVehicleId}/prefill-marketplace`);
    },
    onSuccess: (data: any) => {
      const vehicleId = selectedVehicleId;
      if (!vehicleId) return;
      // Push the user into the marketplace listing flow with prefill.
      window.location.href = `/marketplace/new?vehicleId=${encodeURIComponent(vehicleId)}`;
    },
    onError: (err: any) => {
      toast({
        title: "Could not start sale flow",
        description: err?.message || "Try again.",
        variant: "destructive",
      });
    },
  });

  const selectedVehicle = useMemo(() => {
    if (!selectedVehicleId) return null;
    return vehicles.find((v: any) => String(v?.id || "") === selectedVehicleId) || null;
  }, [vehicles, selectedVehicleId]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Vehicles</h1>
        <p className="text-sm text-muted-foreground">
          Private records for your vehicles: service history, repairs, and documents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your vehicles</CardTitle>
              <CardDescription>Only visible to you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {vehiclesQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : vehicles.length === 0 ? (
                <div className="text-sm text-muted-foreground">Add your first vehicle below.</div>
              ) : (
                vehicles.map((v: any) => {
                  const id = String(v?.id || "");
                  const active = id && selectedVehicleId === id;
                  return (
                    <button
                      key={id}
                      className={[
                        "w-full text-left rounded-md border px-3 py-2 transition",
                        active
                          ? "border-ts-orange/30 bg-ts-orange/10"
                          : "border-border hover:bg-muted",
                      ].join(" ")}
                      onClick={() => setSelectedVehicleId(id)}
                    >
                      <div className="text-sm font-medium">{formatVehicleTitle(v)}</div>
                      <div className="text-xs text-muted-foreground">
                        {typeof v?.mileage === "number"
                          ? `${v.mileage.toLocaleString()} mi`
                          : "Mileage unknown"}
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add a vehicle</CardTitle>
              <CardDescription>Keep it private, add details later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Nickname (optional)</Label>
                  <Input
                    value={newVehicle.nickname}
                    onChange={(e) => setNewVehicle((p) => ({ ...p, nickname: e.target.value }))}
                    placeholder="e.g., Daily driver"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Year</Label>
                    <Input
                      value={newVehicle.year}
                      onChange={(e) => setNewVehicle((p) => ({ ...p, year: e.target.value }))}
                      placeholder="2020"
                      inputMode="numeric"
                    />
                  </div>
                  <div>
                    <Label>Mileage</Label>
                    <Input
                      value={newVehicle.mileage}
                      onChange={(e) => setNewVehicle((p) => ({ ...p, mileage: e.target.value }))}
                      placeholder="45000"
                      inputMode="numeric"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Make</Label>
                    <Input
                      value={newVehicle.make}
                      onChange={(e) => setNewVehicle((p) => ({ ...p, make: e.target.value }))}
                      placeholder="Ford"
                    />
                  </div>
                  <div>
                    <Label>Model</Label>
                    <Input
                      value={newVehicle.model}
                      onChange={(e) => setNewVehicle((p) => ({ ...p, model: e.target.value }))}
                      placeholder="F-150"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Trim (optional)</Label>
                    <Input
                      value={newVehicle.trim}
                      onChange={(e) => setNewVehicle((p) => ({ ...p, trim: e.target.value }))}
                      placeholder="XLT"
                    />
                  </div>
                  <div>
                    <Label>VIN (optional)</Label>
                    <Input
                      value={newVehicle.vin}
                      onChange={(e) => setNewVehicle((p) => ({ ...p, vin: e.target.value }))}
                      placeholder="VIN"
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => createVehicleMutation.mutate()}
                disabled={createVehicleMutation.isPending}
              >
                Add vehicle
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedVehicle ? formatVehicleTitle(selectedVehicle) : "Select a vehicle"}
              </CardTitle>
              <CardDescription>
                Add records over time. This will power reports and future resale suggestions.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedVehicleId ? (
                <div className="text-sm text-muted-foreground">Choose a vehicle to start.</div>
              ) : vehicleDetailQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading…</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Add a record</CardTitle>
                        <CardDescription className="text-xs">
                          Service, repairs, notes.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label>Type</Label>
                          <Select
                            value={newRecord.recordType}
                            onValueChange={(v) => setNewRecord((p) => ({ ...p, recordType: v }))}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Record type" />
                            </SelectTrigger>
                            <SelectContent>
                              {RECORD_TYPES.map((rt) => (
                                <SelectItem key={rt.value} value={rt.value}>
                                  {rt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Date (optional)</Label>
                            <Input
                              type="date"
                              value={newRecord.occurredAt}
                              onChange={(e) =>
                                setNewRecord((p) => ({ ...p, occurredAt: e.target.value }))
                              }
                            />
                          </div>
                          <div>
                            <Label>Cost (optional)</Label>
                            <Input
                              value={newRecord.cost}
                              onChange={(e) =>
                                setNewRecord((p) => ({ ...p, cost: e.target.value }))
                              }
                              placeholder="0.00"
                              inputMode="decimal"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Mileage (optional)</Label>
                            <Input
                              value={newRecord.mileage}
                              onChange={(e) =>
                                setNewRecord((p) => ({ ...p, mileage: e.target.value }))
                              }
                              placeholder="45000"
                              inputMode="numeric"
                            />
                          </div>
                          <div>
                            <Label>Title</Label>
                            <Input
                              value={newRecord.title}
                              onChange={(e) =>
                                setNewRecord((p) => ({ ...p, title: e.target.value }))
                              }
                              placeholder="e.g., Oil change"
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Details (optional)</Label>
                          <Textarea
                            value={newRecord.details}
                            onChange={(e) =>
                              setNewRecord((p) => ({ ...p, details: e.target.value }))
                            }
                            placeholder="Parts, shop, warranty info…"
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => addRecordMutation.mutate()}
                          disabled={addRecordMutation.isPending}
                        >
                          Add record
                        </Button>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Upload a document</CardTitle>
                        <CardDescription className="text-xs">
                          Stored privately in your account.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label>Type</Label>
                          <Select value={docType} onValueChange={(v: any) => setDocType(v)}>
                            <SelectTrigger>
                              <SelectValue placeholder="Document type" />
                            </SelectTrigger>
                            <SelectContent>
                              {DOCUMENT_TYPES.map((dt) => (
                                <SelectItem key={dt.value} value={dt.value}>
                                  {dt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>File</Label>
                          <Input
                            type="file"
                            onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                            accept=".pdf,image/*"
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => uploadDocMutation.mutate()}
                          disabled={uploadDocMutation.isPending}
                        >
                          Upload
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sell this vehicle</CardTitle>
                      <CardDescription className="text-xs">
                        Starts a listing draft using your saved vehicle info.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => prefillMutation.mutate()}
                        disabled={prefillMutation.isPending}
                      >
                        Start sale listing
                      </Button>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Recent records</CardTitle>
                        <CardDescription className="text-xs">
                          {records.length ? `${records.length} records` : "No records yet"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {records.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            Add your first record above.
                          </div>
                        ) : (
                          records.slice(0, 12).map((r: any) => (
                            <div key={String(r?.id || "")} className="rounded-md border px-3 py-2">
                              <div className="flex items-center justify-between gap-3">
                                <div className="text-sm font-medium truncate">
                                  {String(r?.title || "Record")}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {typeof r?.occurredAt === "string" && r.occurredAt
                                    ? r.occurredAt
                                    : ""}
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {typeof r?.recordType === "string" ? r.recordType : "note"}
                                {r?.mileage != null ? ` • ${String(r.mileage)} mi` : ""}
                                {r?.cost ? ` • $${String(r.cost)}` : ""}
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Documents</CardTitle>
                        <CardDescription className="text-xs">
                          {documents.length ? `${documents.length} saved` : "No documents yet"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {documents.length === 0 ? (
                          <div className="text-sm text-muted-foreground">
                            Upload service reports, receipts…
                          </div>
                        ) : (
                          documents.slice(0, 12).map((d: any) => {
                            const name =
                              typeof d?.originalName === "string" && d.originalName
                                ? d.originalName
                                : "Document";
                            const id = String(d?.id || "");
                            const vehicleId = String(selectedVehicleId || "");
                            return (
                              <div
                                key={id}
                                className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{name}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    {typeof d?.documentType === "string" ? d.documentType : "other"}
                                  </div>
                                </div>
                                <Button asChild variant="secondary" size="sm">
                                  <a
                                    href={`/api/vehicles/${vehicleId}/documents/${id}/download`}
                                    target="_blank"
                                    rel="noreferrer"
                                  >
                                    Download
                                  </a>
                                </Button>
                              </div>
                            );
                          })
                        )}
                      </CardContent>
                    </Card>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
