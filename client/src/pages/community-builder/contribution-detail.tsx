import React, { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation, useRoute } from 'wouter';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  FileText, 
  Upload,
  Trash2,
  Edit
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Contribution {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  estimatedValue: string;
  estimatedHours?: string;
  actualValue?: string;
  actualHours?: string;
  proposedStartDate?: string;
  proposedEndDate?: string;
  actualStartDate?: string;
  actualEndDate?: string;
  approvedAt?: string;
  verifiedAt?: string;
  evidence?: Array<{
    type: string;
    url: string;
    description?: string;
    uploadedAt: string;
  }>;
  auditLogs?: Array<{
    id: string;
    action: string;
    auditorId: string;
    notes?: string;
    createdAt: string;
  }>;
}

const statusColors: Record<string, string> = {
  proposed: 'bg-blue-100 text-blue-800',
  pending_approval: 'bg-yellow-100 text-yellow-800',
  approved: 'bg-green-100 text-green-800',
  in_progress: 'bg-purple-100 text-purple-800',
  completed: 'bg-teal-100 text-teal-800',
  verified: 'bg-emerald-100 text-emerald-800',
  disputed: 'bg-red-100 text-red-800',
  cancelled: 'bg-gray-100 text-gray-800',
};

const statusIcons: Record<string, React.ReactNode> = {
  proposed: <Clock className="w-4 h-4" />,
  approved: <CheckCircle className="w-4 h-4" />,
  verified: <CheckCircle className="w-4 h-4" />,
  cancelled: <AlertCircle className="w-4 h-4" />,
};

export default function ContributionDetail() {
  const [match, params] = useRoute('/community-builder/contributions/:id');
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const { data: contribution, isLoading } = useQuery<Contribution>({
    queryKey: ['contribution', params?.id],
    queryFn: async () => {
      const res = await fetch(`/api/community-builder/contributions/${params?.id}`);
      if (!res.ok) throw new Error('Failed to fetch contribution');
      return res.json();
    },
    enabled: !!params?.id,
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const res = await fetch(`/api/community-builder/contributions/${params?.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update contribution');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Updated', description: 'Contribution updated successfully' });
      setIsEditing(false);
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update contribution', variant: 'destructive' });
    },
  });

  const addEvidenceMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch(`/api/community-builder/contributions/${params?.id}/evidence`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) throw new Error('Failed to add evidence');
      return res.json();
    },
    onSuccess: () => {
      toast({ title: 'Success', description: 'Evidence added successfully' });
    },
  });

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  if (!contribution) {
    return <div className="min-h-screen flex items-center justify-center">Contribution not found</div>;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-8 px-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Back Button */}
        <Button 
          variant="ghost"
          onClick={() => navigate('/community-builder/dashboard')}
        >
          ← Back to Dashboard
        </Button>

        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h1 className="text-3xl font-bold">{contribution.title}</h1>
              <p className="text-gray-600 mt-2">{contribution.description}</p>
            </div>
            <Badge className={statusColors[contribution.status]}>
              <span className="flex items-center gap-1">
                {statusIcons[contribution.status]}
                {contribution.status.replace('_', ' ').toUpperCase()}
              </span>
            </Badge>
          </div>
        </div>

        {/* Edit Section (if proposed) */}
        {contribution.status === 'proposed' && (
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Edit Contribution</span>
                {!isEditing && (
                  <Button 
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditTitle(contribution.title);
                      setEditDescription(contribution.description);
                      setIsEditing(true);
                    }}
                  >
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                )}
              </CardTitle>
            </CardHeader>
            {isEditing && (
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <input
                    type="text"
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full mt-1 px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <Textarea
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    rows={5}
                    className="mt-1"
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    onClick={() => updateMutation.mutate()}
                    disabled={updateMutation.isPending}
                  >
                    Save Changes
                  </Button>
                  <Button 
                    variant="outline"
                    onClick={() => setIsEditing(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Details Grid */}
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Contribution Type</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline">{contribution.type}</Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Estimated Value</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">${contribution.estimatedValue}</p>
              {contribution.actualValue && (
                <p className="text-sm text-gray-600 mt-1">
                  Verified: ${contribution.actualValue}
                </p>
              )}
            </CardContent>
          </Card>

          {contribution.estimatedHours && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Estimated Hours</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{contribution.estimatedHours}h</p>
                {contribution.actualHours && (
                  <p className="text-sm text-gray-600 mt-1">
                    Verified: {contribution.actualHours}h
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-1">
                {contribution.proposedStartDate && (
                  <p>Proposed: {new Date(contribution.proposedStartDate).toLocaleDateString()}</p>
                )}
                {contribution.actualStartDate && (
                  <p>Started: {new Date(contribution.actualStartDate).toLocaleDateString()}</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Approval Timeline */}
        <Card>
          <CardHeader>
            <CardTitle>Approval Timeline</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {contribution.approvedAt && (
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 mt-1" />
                <div>
                  <p className="font-semibold">Approved</p>
                  <p className="text-sm text-gray-600">
                    {new Date(contribution.approvedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {contribution.verifiedAt && (
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-emerald-600 mt-1" />
                <div>
                  <p className="font-semibold">Verified</p>
                  <p className="text-sm text-gray-600">
                    {new Date(contribution.verifiedAt).toLocaleString()}
                  </p>
                </div>
              </div>
            )}
            {!contribution.approvedAt && (
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-yellow-600 mt-1" />
                <div>
                  <p className="font-semibold">Pending Review</p>
                  <p className="text-sm text-gray-600">Awaiting admin approval</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evidence */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Evidence & Documentation
            </CardTitle>
            <CardDescription>
              {contribution.evidence?.length || 0} file(s) attached
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {contribution.evidence && contribution.evidence.length > 0 ? (
              <div className="space-y-2">
                {contribution.evidence.map((file, i) => (
                  <a
                    key={i}
                    href={file.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-3 border rounded-lg hover:bg-gray-50"
                  >
                    <Upload className="w-4 h-4" />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{file.type}</p>
                      {file.description && (
                        <p className="text-sm text-gray-600">{file.description}</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No evidence attached yet</p>
            )}
          </CardContent>
        </Card>

        {/* Audit History */}
        {contribution.auditLogs && contribution.auditLogs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Audit History</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {contribution.auditLogs.map((log) => (
                <div key={log.id} className="p-3 border rounded-lg">
                  <p className="font-semibold">{log.action.replace('_', ' ').toUpperCase()}</p>
                  {log.notes && <p className="text-sm text-gray-600 mt-1">{log.notes}</p>}
                  <p className="text-xs text-gray-500 mt-2">
                    {new Date(log.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
