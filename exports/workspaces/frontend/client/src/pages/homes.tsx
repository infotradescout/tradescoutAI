import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
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
  { value: "inspection", label: "Inspection" },
  { value: "upgrade", label: "Upgrade" },
  { value: "improvement", label: "Improvement" },
  { value: "maintenance", label: "Maintenance" },
  { value: "appliance", label: "Appliance" },
  { value: "warranty", label: "Warranty" },
  { value: "note", label: "Note" },
] as const;

const DOCUMENT_TYPES = [
  { value: "inspection_report", label: "Inspection report" },
  { value: "invoice", label: "Invoice" },
  { value: "receipt", label: "Receipt" },
  { value: "photo", label: "Photo" },
  { value: "manual", label: "Manual" },
  { value: "permit", label: "Permit" },
  { value: "other", label: "Other" },
] as const;

function formatHomeTitle(home: any): string {
  const nickname = typeof home?.nickname === "string" ? home.nickname.trim() : "";
  if (nickname) return nickname;
  const address1 = typeof home?.address1 === "string" ? home.address1.trim() : "";
  const city = typeof home?.city === "string" ? home.city.trim() : "";
  const state = typeof home?.stateCode === "string" ? home.stateCode.trim() : "";
  const zip = typeof home?.zipCode === "string" ? home.zipCode.trim() : "";
  const bits = [address1, [city, state].filter(Boolean).join(", "), zip].filter(Boolean);
  return bits.join(" - ") || "Home";
}

export default function HomesVault() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedHomeId, setSelectedHomeId] = useState<string | null>(null);

  const homesQuery = useQuery({ queryKey: ["/api/homes"] });
  const homes = Array.isArray((homesQuery.data as any)?.homes)
    ? (homesQuery.data as any).homes
    : [];

  useEffect(() => {
    if (!selectedHomeId && homes.length > 0) {
      setSelectedHomeId(String(homes[0]?.id || ""));
    }
  }, [homes.length, selectedHomeId]);

  const homeDetailQuery = useQuery({
    queryKey: [selectedHomeId ? `/api/homes/${selectedHomeId}` : "/api/homes/_none"],
    enabled: Boolean(selectedHomeId),
  });

  const homeDetail = homeDetailQuery.data as any;
  const records = Array.isArray(homeDetail?.records) ? homeDetail.records : [];
  const appliances = Array.isArray(homeDetail?.appliances) ? homeDetail.appliances : [];
  const documents = Array.isArray(homeDetail?.documents) ? homeDetail.documents : [];

  const schedulesQuery = useQuery({
    queryKey: [
      selectedHomeId
        ? `/api/homes/${selectedHomeId}/maintenance-schedules`
        : "/api/homes/_none/maintenance-schedules",
    ],
    enabled: Boolean(selectedHomeId),
  });
  const schedules = Array.isArray((schedulesQuery.data as any)?.schedules)
    ? (schedulesQuery.data as any).schedules
    : [];

  const projectsQuery = useQuery({
    queryKey: [
      selectedHomeId ? `/api/homes/${selectedHomeId}/projects` : "/api/homes/_none/projects",
    ],
    enabled: Boolean(selectedHomeId),
  });
  const projects = Array.isArray((projectsQuery.data as any)?.projects)
    ? (projectsQuery.data as any).projects
    : [];

  const [newHome, setNewHome] = useState({
    nickname: "",
    address1: "",
    city: "",
    stateCode: "",
    zipCode: "",
    propertyType: "",
    yearBuilt: "",
  });

  const [newRecord, setNewRecord] = useState({
    recordType: "maintenance",
    occurredAt: "",
    title: "",
    details: "",
    cost: "",
  });

  const [newAppliance, setNewAppliance] = useState({
    category: "",
    brand: "",
    model: "",
    serial: "",
    installedAt: "",
    notes: "",
  });

  const [docType, setDocType] = useState<(typeof DOCUMENT_TYPES)[number]["value"]>("other");
  const [docFile, setDocFile] = useState<File | null>(null);

  const [newSchedule, setNewSchedule] = useState({
    title: "",
    cadenceDays: "90",
    nextDueAt: "",
    assignedBusinessSlug: "",
    shareWithAssignedProvider: false,
  });

  const [newProject, setNewProject] = useState({
    title: "",
    projectType: "",
    description: "",
    estimatedCost: "",
    desiredStartAt: "",
    hasBudgetNow: "no" as "yes" | "no",
    monthlySavings: "",
    fundingSources: "",
  });

  const createHomeMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        nickname: newHome.nickname?.trim() || undefined,
        address1: newHome.address1?.trim() || undefined,
        city: newHome.city?.trim() || undefined,
        stateCode: newHome.stateCode?.trim() || undefined,
        zipCode: newHome.zipCode?.trim() || undefined,
        propertyType: newHome.propertyType?.trim() || undefined,
        yearBuilt: newHome.yearBuilt?.trim() ? Number.parseInt(newHome.yearBuilt, 10) : undefined,
      };
      return apiRequest("POST", "/api/homes", payload);
    },
    onSuccess: async (data: any) => {
      toast({ title: "Home added" });
      setNewHome({
        nickname: "",
        address1: "",
        city: "",
        stateCode: "",
        zipCode: "",
        propertyType: "",
        yearBuilt: "",
      });
      await queryClient.invalidateQueries({ queryKey: ["/api/homes"] });
      const id = String(data?.home?.id || "");
      if (id) setSelectedHomeId(id);
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add home",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const addRecordMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHomeId) throw new Error("Select a home first");
      if (!newRecord.title.trim()) throw new Error("Title is required");
      const payload: any = {
        recordType: newRecord.recordType,
        occurredAt: newRecord.occurredAt?.trim() || undefined,
        title: newRecord.title.trim(),
        details: newRecord.details?.trim() || undefined,
        cost: newRecord.cost?.trim() ? Number.parseFloat(newRecord.cost) : undefined,
      };
      return apiRequest("POST", `/api/homes/${selectedHomeId}/records`, payload);
    },
    onSuccess: async () => {
      toast({ title: "Record added" });
      setNewRecord({ recordType: "maintenance", occurredAt: "", title: "", details: "", cost: "" });
      if (selectedHomeId) {
        await queryClient.invalidateQueries({ queryKey: [`/api/homes/${selectedHomeId}`] });
        await queryClient.invalidateQueries({ queryKey: ["/api/homes"] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to add record",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const addApplianceMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHomeId) throw new Error("Select a home first");
      if (!newAppliance.category.trim()) throw new Error("Category is required");
      const payload: any = {
        category: newAppliance.category.trim(),
        brand: newAppliance.brand?.trim() || undefined,
        model: newAppliance.model?.trim() || undefined,
        serial: newAppliance.serial?.trim() || undefined,
        installedAt: newAppliance.installedAt?.trim() || undefined,
        notes: newAppliance.notes?.trim() || undefined,
      };
      return apiRequest("POST", `/api/homes/${selectedHomeId}/appliances`, payload);
    },
    onSuccess: async () => {
      toast({ title: "Appliance saved" });
      setNewAppliance({
        category: "",
        brand: "",
        model: "",
        serial: "",
        installedAt: "",
        notes: "",
      });
      if (selectedHomeId) {
        await queryClient.invalidateQueries({ queryKey: [`/api/homes/${selectedHomeId}`] });
        await queryClient.invalidateQueries({ queryKey: ["/api/homes"] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to save appliance",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const uploadDocMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHomeId) throw new Error("Select a home first");
      if (!docFile) throw new Error("Choose a file");

      const { objectKey } = await uploadPrivateObject(docFile);

      const payload: any = {
        documentType: docType,
        objectKey,
        originalName: docFile.name,
        contentType: docFile.type || "application/octet-stream",
        bytes: docFile.size,
      };

      return apiRequest("POST", `/api/homes/${selectedHomeId}/documents`, payload);
    },
    onSuccess: async () => {
      toast({ title: "Document uploaded" });
      setDocFile(null);
      setDocType("other");
      if (selectedHomeId) {
        await queryClient.invalidateQueries({ queryKey: [`/api/homes/${selectedHomeId}`] });
        await queryClient.invalidateQueries({ queryKey: ["/api/homes"] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Upload failed",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHomeId) throw new Error("Select a home first");
      if (!newSchedule.title.trim()) throw new Error("Schedule title is required");
      const cadenceDays = Number.parseInt(String(newSchedule.cadenceDays || "90"), 10);
      if (!Number.isFinite(cadenceDays) || cadenceDays < 1) throw new Error("Cadence invalid");

      const payload: any = {
        title: newSchedule.title.trim(),
        cadenceDays,
        nextDueAt: newSchedule.nextDueAt?.trim() || undefined,
        assignedBusinessSlug: newSchedule.assignedBusinessSlug?.trim() || undefined,
        shareWithAssignedProvider: newSchedule.shareWithAssignedProvider === true,
      };

      return apiRequest("POST", `/api/homes/${selectedHomeId}/maintenance-schedules`, payload);
    },
    onSuccess: async () => {
      toast({ title: "Schedule created" });
      setNewSchedule({
        title: "",
        cadenceDays: "90",
        nextDueAt: "",
        assignedBusinessSlug: "",
        shareWithAssignedProvider: false,
      });
      if (selectedHomeId) {
        await queryClient.invalidateQueries({
          queryKey: [`/api/homes/${selectedHomeId}/maintenance-schedules`],
        });
        await queryClient.invalidateQueries({ queryKey: ["/api/homes"] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to create schedule",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const completeScheduleMutation = useMutation({
    mutationFn: async (scheduleId: string) => {
      if (!selectedHomeId) throw new Error("Select a home first");
      if (!scheduleId) throw new Error("scheduleId required");
      return apiRequest(
        "POST",
        `/api/homes/${selectedHomeId}/maintenance-schedules/${scheduleId}/complete`,
        {}
      );
    },
    onSuccess: async () => {
      toast({ title: "Marked complete" });
      if (selectedHomeId) {
        await queryClient.invalidateQueries({
          queryKey: [`/api/homes/${selectedHomeId}/maintenance-schedules`],
        });
        await queryClient.invalidateQueries({ queryKey: [`/api/homes/${selectedHomeId}`] });
        await queryClient.invalidateQueries({ queryKey: ["/api/homes"] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to complete schedule",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHomeId) throw new Error("Select a home first");
      if (!newProject.title.trim()) throw new Error("Project title is required");

      const estimatedCost = newProject.estimatedCost?.trim()
        ? Number.parseFloat(newProject.estimatedCost)
        : undefined;
      const monthlySavings = newProject.monthlySavings?.trim()
        ? Number.parseFloat(newProject.monthlySavings)
        : undefined;

      const fundingSources = newProject.fundingSources
        ? newProject.fundingSources
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean)
            .slice(0, 12)
        : undefined;

      const payload: any = {
        title: newProject.title.trim(),
        projectType: newProject.projectType?.trim() || undefined,
        description: newProject.description?.trim() || undefined,
        estimatedCost: Number.isFinite(estimatedCost as any) ? estimatedCost : undefined,
        desiredStartAt: newProject.desiredStartAt?.trim() || undefined,
        hasBudgetNow: newProject.hasBudgetNow === "yes",
        monthlySavings: Number.isFinite(monthlySavings as any) ? monthlySavings : undefined,
        fundingSources,
      };

      return apiRequest("POST", `/api/homes/${selectedHomeId}/projects`, payload);
    },
    onSuccess: async () => {
      toast({ title: "Project started" });
      setNewProject({
        title: "",
        projectType: "",
        description: "",
        estimatedCost: "",
        desiredStartAt: "",
        hasBudgetNow: "no",
        monthlySavings: "",
        fundingSources: "",
      });
      if (selectedHomeId) {
        await queryClient.invalidateQueries({
          queryKey: [`/api/homes/${selectedHomeId}/projects`],
        });
        await queryClient.invalidateQueries({ queryKey: ["/api/homes"] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Failed to start project",
        description: formatUserFacingErrorMessage(err, "Try again"),
        variant: "destructive",
      });
    },
  });

  const startSaleMutation = useMutation({
    mutationFn: async () => {
      if (!selectedHomeId) throw new Error("Select a home first");
      // Light validation that the home exists + user owns it.
      await apiRequest("GET", `/api/homes/${selectedHomeId}/prefill-homescout`);
      return true;
    },
    onSuccess: () => {
      const homeId = selectedHomeId;
      if (!homeId) return;
      window.location.href = `/exchange?tab=sell&category=real-estate&homeId=${encodeURIComponent(homeId)}`;
    },
    onError: (err: any) => {
      toast({
        title: "Could not start sale flow",
        description: formatUserFacingErrorMessage(err, "Try again."),
        variant: "destructive",
      });
    },
  });

  const selectedHome = useMemo(() => {
    if (!selectedHomeId) return null;
    return homes.find((h: any) => String(h?.id || "") === selectedHomeId) || null;
  }, [homes, selectedHomeId]);

  return (
    <div className="container mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Homes</h1>
        <p className="text-sm text-muted-foreground">
          Private records for your properties: inspections, upgrades, appliances, and documents.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Your homes</CardTitle>
              <CardDescription>Only visible to you.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {homesQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : homes.length === 0 ? (
                <div className="text-sm text-muted-foreground">Add your first home below.</div>
              ) : (
                homes.map((h: any) => {
                  const id = String(h?.id || "");
                  const active = id && selectedHomeId === id;
                  return (
                    <button
                      key={id}
                      className={[
                        "w-full text-left rounded-md border px-3 py-2 transition",
                        active
                          ? "border-ts-orange/30 bg-ts-orange/10"
                          : "border-border hover:bg-muted",
                      ].join(" ")}
                      onClick={() => setSelectedHomeId(id)}
                    >
                      <div className="text-sm font-medium">{formatHomeTitle(h)}</div>
                      <div className="text-xs text-muted-foreground">
                        {typeof h?.propertyType === "string" && h.propertyType
                          ? h.propertyType
                          : "Property"}
                        {typeof h?.yearBuilt === "number" ? ` - Built ${h.yearBuilt}` : ""}
                      </div>
                    </button>
                  );
                })
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Add a home</CardTitle>
              <CardDescription>Keep it private, add details later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 gap-3">
                <div>
                  <Label>Nickname (optional)</Label>
                  <Input
                    value={newHome.nickname}
                    onChange={(e) => setNewHome((p) => ({ ...p, nickname: e.target.value }))}
                    placeholder="e.g., Main house"
                  />
                </div>
                <div>
                  <Label>Address (optional)</Label>
                  <Input
                    value={newHome.address1}
                    onChange={(e) => setNewHome((p) => ({ ...p, address1: e.target.value }))}
                    placeholder="Street address"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <Label>City</Label>
                    <Input
                      value={newHome.city}
                      onChange={(e) => setNewHome((p) => ({ ...p, city: e.target.value }))}
                      placeholder="City"
                    />
                  </div>
                  <div>
                    <Label>State</Label>
                    <Input
                      value={newHome.stateCode}
                      onChange={(e) =>
                        setNewHome((p) => ({ ...p, stateCode: e.target.value.toUpperCase() }))
                      }
                      placeholder="LA"
                      maxLength={2}
                    />
                  </div>
                  <div>
                    <Label>ZIP</Label>
                    <Input
                      value={newHome.zipCode}
                      onChange={(e) => setNewHome((p) => ({ ...p, zipCode: e.target.value }))}
                      placeholder="70454"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Property type</Label>
                    <Input
                      value={newHome.propertyType}
                      onChange={(e) => setNewHome((p) => ({ ...p, propertyType: e.target.value }))}
                      placeholder="house, condo, etc"
                    />
                  </div>
                  <div>
                    <Label>Year built</Label>
                    <Input
                      value={newHome.yearBuilt}
                      onChange={(e) => setNewHome((p) => ({ ...p, yearBuilt: e.target.value }))}
                      placeholder="1998"
                      inputMode="numeric"
                    />
                  </div>
                </div>
              </div>

              <Button
                className="w-full"
                onClick={() => createHomeMutation.mutate()}
                disabled={createHomeMutation.isPending}
              >
                Add home
              </Button>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedHome ? formatHomeTitle(selectedHome) : "Select a home"}
              </CardTitle>
              <CardDescription>
                Add records over time. This data will power home reports and suggestions later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {!selectedHomeId ? (
                <div className="text-sm text-muted-foreground">Choose a home to start.</div>
              ) : homeDetailQuery.isLoading ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Add a record</CardTitle>
                        <CardDescription className="text-xs">
                          Inspection, maintenance, upgrades, notes.
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
                        <div>
                          <Label>Title</Label>
                          <Input
                            value={newRecord.title}
                            onChange={(e) => setNewRecord((p) => ({ ...p, title: e.target.value }))}
                            placeholder="e.g., Replaced water heater"
                          />
                        </div>
                        <div>
                          <Label>Details (optional)</Label>
                          <Textarea
                            value={newRecord.details}
                            onChange={(e) =>
                              setNewRecord((p) => ({ ...p, details: e.target.value }))
                            }
                            placeholder="Notes, parts, warranty info..."
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
                        <CardTitle className="text-base">Add an appliance</CardTitle>
                        <CardDescription className="text-xs">
                          Brand, model, serial, install date.
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div>
                          <Label>Category</Label>
                          <Input
                            value={newAppliance.category}
                            onChange={(e) =>
                              setNewAppliance((p) => ({ ...p, category: e.target.value }))
                            }
                            placeholder="HVAC, Water heater, Refrigerator..."
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Brand</Label>
                            <Input
                              value={newAppliance.brand}
                              onChange={(e) =>
                                setNewAppliance((p) => ({ ...p, brand: e.target.value }))
                              }
                              placeholder="Brand"
                            />
                          </div>
                          <div>
                            <Label>Model</Label>
                            <Input
                              value={newAppliance.model}
                              onChange={(e) =>
                                setNewAppliance((p) => ({ ...p, model: e.target.value }))
                              }
                              placeholder="Model"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <Label>Serial (optional)</Label>
                            <Input
                              value={newAppliance.serial}
                              onChange={(e) =>
                                setNewAppliance((p) => ({ ...p, serial: e.target.value }))
                              }
                              placeholder="Serial"
                            />
                          </div>
                          <div>
                            <Label>Installed (optional)</Label>
                            <Input
                              type="date"
                              value={newAppliance.installedAt}
                              onChange={(e) =>
                                setNewAppliance((p) => ({ ...p, installedAt: e.target.value }))
                              }
                            />
                          </div>
                        </div>
                        <div>
                          <Label>Notes (optional)</Label>
                          <Textarea
                            value={newAppliance.notes}
                            onChange={(e) =>
                              setNewAppliance((p) => ({ ...p, notes: e.target.value }))
                            }
                            placeholder="Filter sizes, warranty, installer..."
                          />
                        </div>
                        <Button
                          className="w-full"
                          onClick={() => addApplianceMutation.mutate()}
                          disabled={addApplianceMutation.isPending}
                        >
                          Save appliance
                        </Button>
                      </CardContent>
                    </Card>
                  </div>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Sell this home</CardTitle>
                      <CardDescription className="text-xs">
                        Starts a HomeScout listing draft using your saved Home Vault info.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <Button
                        onClick={() => startSaleMutation.mutate()}
                        disabled={startSaleMutation.isPending}
                      >
                        {startSaleMutation.isPending ? "Starting..." : "Start sale listing"}
                      </Button>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Projects</CardTitle>
                      <CardDescription className="text-xs">
                        Start a home project and track planning. If you don't have budget yet, make
                        a savings plan.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Project title</Label>
                          <Input
                            value={newProject.title}
                            onChange={(e) =>
                              setNewProject((p) => ({ ...p, title: e.target.value }))
                            }
                            placeholder="Build a deck"
                          />
                        </div>
                        <div>
                          <Label>Type (optional)</Label>
                          <Input
                            value={newProject.projectType}
                            onChange={(e) =>
                              setNewProject((p) => ({ ...p, projectType: e.target.value }))
                            }
                            placeholder="carpentry, roofing, HVAC..."
                          />
                        </div>
                        <div>
                          <Label>Estimated cost (optional)</Label>
                          <Input
                            value={newProject.estimatedCost}
                            onChange={(e) =>
                              setNewProject((p) => ({ ...p, estimatedCost: e.target.value }))
                            }
                            placeholder="5000"
                            inputMode="decimal"
                          />
                        </div>
                        <div>
                          <Label>Desired start (optional)</Label>
                          <Input
                            type="date"
                            value={newProject.desiredStartAt}
                            onChange={(e) =>
                              setNewProject((p) => ({ ...p, desiredStartAt: e.target.value }))
                            }
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Details (optional)</Label>
                        <Textarea
                          value={newProject.description}
                          onChange={(e) =>
                            setNewProject((p) => ({ ...p, description: e.target.value }))
                          }
                          placeholder="Size, materials, constraints, HOA rules..."
                        />
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Do you have budget now?</Label>
                          <Select
                            value={newProject.hasBudgetNow}
                            onValueChange={(v) =>
                              setNewProject((p) => ({ ...p, hasBudgetNow: v as any }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Choose" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="no">Not yet</SelectItem>
                              <SelectItem value="yes">Yes</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        {newProject.hasBudgetNow === "no" ? (
                          <div>
                            <Label>Monthly savings (optional)</Label>
                            <Input
                              value={newProject.monthlySavings}
                              onChange={(e) =>
                                setNewProject((p) => ({ ...p, monthlySavings: e.target.value }))
                              }
                              placeholder="250"
                              inputMode="decimal"
                            />
                          </div>
                        ) : (
                          <div />
                        )}
                      </div>
                      {newProject.hasBudgetNow === "no" ? (
                        <div>
                          <Label>Possible funding sources (optional)</Label>
                          <Input
                            value={newProject.fundingSources}
                            onChange={(e) =>
                              setNewProject((p) => ({ ...p, fundingSources: e.target.value }))
                            }
                            placeholder="savings, HELOC, credit union loan, insurance... (comma separated)"
                          />
                          <p className="text-xs text-muted-foreground mt-1">
                            Informational only. TradeScout does not sell leads or charge to connect.
                          </p>
                        </div>
                      ) : null}

                      <Button
                        onClick={() => createProjectMutation.mutate()}
                        disabled={createProjectMutation.isPending}
                      >
                        {createProjectMutation.isPending ? "Starting..." : "Start project"}
                      </Button>

                      <div className="pt-2 border-t space-y-2">
                        {projectsQuery.isLoading ? (
                          <div className="text-sm text-muted-foreground">Loading projects...</div>
                        ) : projects.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No projects yet.</div>
                        ) : (
                          projects.slice(0, 10).map((p: any) => {
                            const id = String(p?.id || "");
                            const title =
                              typeof p?.title === "string" && p.title ? p.title : "Project";
                            const status =
                              typeof p?.status === "string" && p.status ? p.status : "planning";
                            const est = p?.estimatedCost ? String(p.estimatedCost) : "";
                            const plan = p?.plan || null;
                            return (
                              <div
                                key={id}
                                className="rounded-md border px-3 py-2 flex items-start justify-between gap-3"
                              >
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{title}</div>
                                  <div className="text-xs text-muted-foreground truncate">
                                    Status: {status}
                                    {est ? ` • Est: $${est}` : ""}
                                    {plan?.monthlyContribution
                                      ? ` • Save: $${plan.monthlyContribution}/mo`
                                      : ""}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Maintenance schedules</CardTitle>
                      <CardDescription className="text-xs">
                        Recurring maintenance for this home. If you assign a provider business and
                        enable sharing, it can sync to them without exposing your address by
                        default.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>Title</Label>
                          <Input
                            value={newSchedule.title}
                            onChange={(e) =>
                              setNewSchedule((p) => ({ ...p, title: e.target.value }))
                            }
                            placeholder="HVAC tune-up"
                          />
                        </div>
                        <div>
                          <Label>Cadence (days)</Label>
                          <Input
                            value={newSchedule.cadenceDays}
                            onChange={(e) =>
                              setNewSchedule((p) => ({ ...p, cadenceDays: e.target.value }))
                            }
                            placeholder="90"
                            inputMode="numeric"
                          />
                        </div>
                        <div>
                          <Label>Next due (optional ISO)</Label>
                          <Input
                            value={newSchedule.nextDueAt}
                            onChange={(e) =>
                              setNewSchedule((p) => ({ ...p, nextDueAt: e.target.value }))
                            }
                            placeholder="2026-03-30T12:00:00.000Z"
                          />
                        </div>
                        <div>
                          <Label>Provider business slug (optional)</Label>
                          <Input
                            value={newSchedule.assignedBusinessSlug}
                            onChange={(e) =>
                              setNewSchedule((p) => ({
                                ...p,
                                assignedBusinessSlug: e.target.value,
                              }))
                            }
                            placeholder="acme-hvac"
                          />
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          id="shareWithProvider"
                          type="checkbox"
                          checked={newSchedule.shareWithAssignedProvider === true}
                          onChange={(e) =>
                            setNewSchedule((p) => ({
                              ...p,
                              shareWithAssignedProvider: e.target.checked,
                            }))
                          }
                        />
                        <Label htmlFor="shareWithProvider">
                          Share schedule with assigned provider
                        </Label>
                      </div>

                      <Button
                        onClick={() => createScheduleMutation.mutate()}
                        disabled={createScheduleMutation.isPending}
                      >
                        Create schedule
                      </Button>

                      <div className="space-y-2">
                        {schedulesQuery.isLoading ? (
                          <div className="text-sm text-muted-foreground">Loading schedules...</div>
                        ) : schedules.length === 0 ? (
                          <div className="text-sm text-muted-foreground">No schedules yet.</div>
                        ) : (
                          schedules.map((s: any) => (
                            <div
                              key={String(s.id)}
                              className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                            >
                              <div className="min-w-0">
                                <div className="text-sm font-medium truncate">{s.title}</div>
                                <div className="text-xs text-muted-foreground">
                                  Next due:{" "}
                                  {s.nextDueAt ? new Date(s.nextDueAt).toLocaleDateString() : "n/a"}
                                  {s.assignedBusiness?.slug
                                    ? ` | Provider: ${s.assignedBusiness.slug}`
                                    : ""}
                                </div>
                              </div>
                              <Button
                                variant="outline"
                                onClick={() => completeScheduleMutation.mutate(String(s.id))}
                                disabled={completeScheduleMutation.isPending}
                              >
                                Mark complete
                              </Button>
                            </div>
                          ))
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                            Upload receipts, reports, manuals...
                          </div>
                        ) : (
                          documents.slice(0, 12).map((d: any) => {
                            const name =
                              typeof d?.originalName === "string" && d.originalName
                                ? d.originalName
                                : "Document";
                            const id = String(d?.id || "");
                            const homeId = String(selectedHomeId || "");
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
                                    href={`/api/homes/${homeId}/documents/${id}/download`}
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Timeline</CardTitle>
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
                                {r?.cost ? ` - $${String(r.cost)}` : ""}
                              </div>
                            </div>
                          ))
                        )}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-base">Appliances</CardTitle>
                        <CardDescription className="text-xs">
                          {appliances.length ? `${appliances.length} saved` : "No appliances yet"}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        {appliances.length === 0 ? (
                          <div className="text-sm text-muted-foreground">Add appliances above.</div>
                        ) : (
                          appliances.slice(0, 12).map((a: any) => (
                            <div key={String(a?.id || "")} className="rounded-md border px-3 py-2">
                              <div className="text-sm font-medium truncate">
                                {String(a?.category || "Appliance")}
                              </div>
                              <div className="text-xs text-muted-foreground truncate">
                                {[a?.brand, a?.model, a?.serial].filter(Boolean).join(" - ")}
                              </div>
                            </div>
                          ))
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
