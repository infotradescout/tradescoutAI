import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Mail, Users, Gift, Copy, Check } from "lucide-react";

type ReferralCodeResponse = { referralCode?: string } | undefined;
type ReferralStats = {
  totalInvitationsSent?: number;
  totalInvitationsAccepted?: number;
  contractorReferrals?: number;
  homeownerReferrals?: number;
} | undefined;

type Invitation = {
  id: string;
  email: string;
  targetRole: string;
  code: string;
  status: string;
  sentAt?: string;
  acceptedAt?: string | null;
};

export default function InvitePage() {
  const [email, setEmail] = useState("");
  const [targetRole, setTargetRole] = useState("");
  const [personalMessage, setPersonalMessage] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch user's referral code
  const { data: referralCodeData } = useQuery<ReferralCodeResponse>({
    queryKey: ["/api/referrals/generate-code"],
    retry: false,
  });

  // Fetch user's invitations
  const { data: invitations = [], isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/invitations/my"],
    retry: false,
  });

  // Fetch user's referral stats
  const { data: stats } = useQuery<ReferralStats>({
    queryKey: ["/api/referrals/stats"],
    retry: false,
  });

  // Generate referral code mutation
  const generateCodeMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/referrals/generate-code"),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/generate-code"] });
      toast({
        title: "Success",
        description: "Your referral code has been generated!",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to generate referral code",
        variant: "destructive",
      });
    },
  });

  // Send invitation mutation
  const sendInvitationMutation = useMutation({
    mutationFn: (data: { email: string; targetRole: string; personalMessage?: string }) =>
      apiRequest("POST", "/api/invitations/send", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations/my"] });
      queryClient.invalidateQueries({ queryKey: ["/api/referrals/stats"] });
      setEmail("");
      setTargetRole("");
      setPersonalMessage("");
      toast({
        title: "Invitation Sent!",
        description: "Your invitation has been sent successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to send invitation",
        variant: "destructive",
      });
    },
  });

  const handleSendInvitation = () => {
    if (!email || !targetRole) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    sendInvitationMutation.mutate({
      email,
      targetRole,
      personalMessage: personalMessage || undefined,
    });
  };

  const copyReferralCode = async () => {
    if (!referralCodeData?.referralCode) return;

    try {
      await navigator.clipboard.writeText(referralCodeData.referralCode);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
      toast({
        title: "Copied!",
        description: "Referral code copied to clipboard",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: "Failed to copy referral code",
        variant: "destructive",
      });
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "accepted":
        return "default";
      case "pending":
        return "secondary";
      case "expired":
        return "destructive";
      default:
        return "outline";
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-orange-500 mb-2">
          Invite Friends to TradeScout
        </h1>
        <p className="text-gray-600 dark:text-gray-300">
          Help grow our community by inviting contractors and homeowners you know
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Send Invitation Form */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Email Invitation
            </CardTitle>
            <CardDescription>
              Invite someone specific by email with a personal message
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Email Address</label>
              <Input
                type="email"
                placeholder="friend@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Role</label>
              <Select value={targetRole} onValueChange={setTargetRole}>
                <SelectTrigger>
                  <SelectValue placeholder="Select role for invitee" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="homeowner">Homeowner</SelectItem>
                  <SelectItem value="contractor_user">Contractor</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Personal Message (Optional)</label>
              <Textarea
                placeholder="Add a personal note to your invitation..."
                value={personalMessage}
                onChange={(e) => setPersonalMessage(e.target.value)}
                rows={3}
              />
            </div>

            <Button
              onClick={handleSendInvitation}
              disabled={sendInvitationMutation.isPending}
              className="w-full"
            >
              {sendInvitationMutation.isPending ? "Sending..." : "Send Invitation"}
            </Button>
          </CardContent>
        </Card>

        {/* Referral Code & Stats */}
        <div className="space-y-6">
          {/* Referral Code */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5" />
                Your Referral Code
              </CardTitle>
              <CardDescription>
                Share this code for people to sign up with your referral
              </CardDescription>
            </CardHeader>
            <CardContent>
              {referralCodeData?.referralCode ? (
                <div className="flex items-center gap-2">
                  <Input
                    value={referralCodeData.referralCode}
                    readOnly
                    className="font-mono text-lg"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={copyReferralCode}
                  >
                    {copySuccess ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => generateCodeMutation.mutate()}
                  disabled={generateCodeMutation.isPending}
                  className="w-full"
                >
                  {generateCodeMutation.isPending ? "Generating..." : "Generate Referral Code"}
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Referral Stats */}
          {stats && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Your Referral Stats
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div>
                    <div className="text-2xl font-bold text-blue-600">
                      {stats.totalInvitationsSent}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Invitations Sent
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-green-600">
                      {stats.totalInvitationsAccepted}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Accepted
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-orange-600">
                      {stats.contractorReferrals}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Contractors
                    </div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-purple-600">
                      {stats.homeownerReferrals}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Homeowners
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Invitations History */}
      <Card>
        <CardHeader>
          <CardTitle>Your Invitations</CardTitle>
          <CardDescription>
            Track the status of invitations you've sent
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invitationsLoading ? (
            <div className="text-center py-8">Loading invitations...</div>
          ) : !invitations || invitations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No invitations sent yet. Start by sending your first invitation above!
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((invitation: any) => (
                <div
                  key={invitation.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{invitation.email}</div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      Role: {invitation.targetRole} • Code: {invitation.code}
                    </div>
                    {invitation.personalMessage && (
                      <div className="text-sm text-gray-500 mt-1">
                        "{invitation.personalMessage}"
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={getStatusBadgeVariant(invitation.status)}>
                      {invitation.status}
                    </Badge>
                    <div className="text-sm text-gray-500">
                      {new Date(invitation.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}