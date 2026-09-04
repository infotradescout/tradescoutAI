import React, { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Shield, User, Mail, Lock, Eye, EyeOff, UserPlus } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { formatUserFacingErrorMessage } from "@/lib/userFacingError";
import { isSuperAdminLike } from "@/lib/roleChecks";

const createAdminSchema = z
  .object({
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    email: z.string().email("Valid email is required"),
    username: z.string().min(3, "Username must be at least 3 characters"),
    password: z.string().min(12, "Password must be at least 12 characters"),
    confirmPassword: z.string(),
    role: z.enum(["moderator", "ops_admin", "super_admin"], {
      required_error: "Please select a role",
    }),
    address: z.string().min(1, "Address is required"),
    reason: z.string().trim().min(12, "Audit reason must be at least 12 characters").max(500),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type CreateAdminFormData = z.infer<typeof createAdminSchema>;

export default function AdminCreateAccount() {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const form = useForm<CreateAdminFormData>({
    resolver: zodResolver(createAdminSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      role: "moderator",
      address: "",
      reason: "",
    },
  });

  const createAdminMutation = useMutation({
    mutationFn: async (data: Omit<CreateAdminFormData, "confirmPassword">) => {
      return await apiRequest("POST", "/api/admin/create-account", data);
    },
    onSuccess: (data) => {
      toast({
        title: "Success!",
        description: `Admin account created successfully for ${data.user.email}`,
      });
      form.reset();
    },
    onError: (error: Error) => {
      toast({
        title: "Account Creation Failed",
        description: formatUserFacingErrorMessage(error, "Account creation failed."),
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateAdminFormData) => {
    const { confirmPassword, ...createData } = data;
    void confirmPassword;
    createAdminMutation.mutate(createData);
  };

  // Check if user has permission to create admin accounts
  const canCreateAdmins =
    user?.isSuperAdmin === true ||
    [user?.role, user?.activeRole, ...(Array.isArray(user?.roles) ? user.roles : [])].some((role) =>
      isSuperAdminLike(typeof role === "string" ? role : undefined)
    );

  if (!canCreateAdmins) {
    return (
      <div className="max-w-2xl mx-auto p-4 md:p-6">
        <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
          <CardContent className="p-6 text-center">
            <Shield className="mx-auto h-16 w-16 text-destructive mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Access denied</h2>
            <p className="text-sm text-[color:var(--text-secondary)]">
              You don&apos;t have permission to create admin accounts.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
      <Card className="border border-[color:var(--border-subtle)] bg-[color:var(--surface-card)]">
        <CardHeader className="pb-3">
          <CardTitle className="text-white flex items-center gap-2">
            <Shield className="w-5 h-5 text-ts-orange" />
            Create Admin Account
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6">
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {/* Personal Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName" className="text-white/70 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  First Name
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  placeholder="Enter first name"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white placeholder:text-white/60"
                  {...form.register("firstName")}
                />
                {form.formState.errors.firstName && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.firstName.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName" className="text-white/70 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  placeholder="Enter last name"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white placeholder:text-white/60"
                  {...form.register("lastName")}
                />
                {form.formState.errors.lastName && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.lastName.message}
                  </p>
                )}
              </div>
            </div>

            {/* Account Information */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-white/70 flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="admin@tradescout.com"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white placeholder:text-white/60"
                  {...form.register("email")}
                />
                {form.formState.errors.email && (
                  <p className="text-destructive text-sm">{form.formState.errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username" className="text-white/70 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="admin_username"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white placeholder:text-white/60"
                  {...form.register("username")}
                />
                {form.formState.errors.username && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.username.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="address" className="text-white/70">
                  Address
                </Label>
                <Input
                  id="address"
                  type="text"
                  placeholder="123 Admin Street, City, State 12345"
                  className="bg-black/30 border-[color:var(--border-subtle)] text-white placeholder:text-white/60"
                  {...form.register("address")}
                />
                {form.formState.errors.address && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.address.message}
                  </p>
                )}
              </div>
            </div>

            {/* Role Selection */}
            <div className="space-y-2">
              <Label className="text-white/70 flex items-center gap-2">
                <Shield className="w-4 h-4" />
                Admin Role
              </Label>
              <Select
                onValueChange={(value) => form.setValue("role", value as any)}
                defaultValue="moderator"
              >
                <SelectTrigger className="bg-black/30 border-[color:var(--border-subtle)] text-white">
                  <SelectValue placeholder="Select admin role" />
                </SelectTrigger>
                <SelectContent className="bg-tsBg border-[color:var(--border-subtle)]">
                  <SelectItem value="moderator" className="text-white">
                    Staff - Employee moderation and support access
                  </SelectItem>
                  <SelectItem value="ops_admin" className="text-white">
                    Operations Admin - Platform operations and configuration
                  </SelectItem>
                  {canCreateAdmins && (
                    <SelectItem value="super_admin" className="text-white">
                      Super Admin - Full platform control
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
              {form.formState.errors.role && (
                <p className="text-destructive text-sm">{form.formState.errors.role.message}</p>
              )}
            </div>

            {/* Password Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-white/70 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter secure password"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white placeholder:text-white/60 pr-10"
                    {...form.register("password")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white/70 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {form.formState.errors.password && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.password.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-white/70 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Confirm Password
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    className="bg-black/30 border-[color:var(--border-subtle)] text-white placeholder:text-white/60 pr-10"
                    {...form.register("confirmPassword")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/60 hover:text-white/70 transition-colors"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
                {form.formState.errors.confirmPassword && (
                  <p className="text-destructive text-sm">
                    {form.formState.errors.confirmPassword.message}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason" className="text-white/70">
                Audit reason
              </Label>
              <Input
                id="reason"
                type="text"
                placeholder="Explain why this admin account is required"
                className="bg-black/30 border-[color:var(--border-subtle)] text-white placeholder:text-white/60"
                {...form.register("reason")}
              />
              {form.formState.errors.reason && (
                <p className="text-destructive text-sm">{form.formState.errors.reason.message}</p>
              )}
            </div>

            <Button
              type="submit"
              disabled={createAdminMutation.isPending}
              className="w-full bg-ts-orange hover:bg-ts-orange-dark"
            >
              {createAdminMutation.isPending ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Creating Account...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <UserPlus className="w-5 h-5" />
                  Create Admin Account
                </div>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
