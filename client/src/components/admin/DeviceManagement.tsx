import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Shield, Smartphone, Monitor, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';

interface TrustedDevice {
  id: string;
  deviceName: string;
  userAgent: string;
  ipAddress: string;
  status: 'pending' | 'approved' | 'denied' | 'revoked';
  lastUsedAt: string;
  createdAt: string;
  expiresAt: string;
}

interface PendingDevice {
  id: string;
  userId: string;
  deviceName: string;
  userAgent: string;
  ipAddress: string;
  createdAt: string;
}

export default function DeviceManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: devicesData = { devices: [] as TrustedDevice[] }, isLoading: devicesLoading } = useQuery<{ devices: TrustedDevice[]}>({
    queryKey: ['/api/admin/devices'],
    retry: false,
  });

  const { data: pendingData = { pendingDevices: [] as PendingDevice[] }, isLoading: pendingLoading } = useQuery<{ pendingDevices: PendingDevice[]}>({
    queryKey: ['/api/admin/pending-devices'],
    retry: false,
  });

  const approveMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest('POST', '/api/admin/approve-device', { deviceId });
    },
    onSuccess: () => {
      toast({
        title: "Device Approved",
        description: "Device has been approved for admin access.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/devices'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/pending-devices'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Approval Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const revokeMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      return apiRequest('POST', '/api/admin/revoke-device', { deviceId });
    },
    onSuccess: () => {
      toast({
        title: "Device Revoked",
        description: "Device access has been revoked.",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/devices'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Revoke Failed",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const getDeviceIcon = (userAgent: string) => {
    if (userAgent.includes('Mobile') || userAgent.includes('iPhone') || userAgent.includes('Android')) {
      return <Smartphone className="w-5 h-5" />;
    }
    return <Monitor className="w-5 h-5" />;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'denied':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'revoked':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants = {
      approved: 'default',
      pending: 'secondary',
      denied: 'error',
      revoked: 'error'
    } as const;

    return (
      <Badge variant={variants[status as keyof typeof variants] || 'secondary'} className="capitalize">
        {getStatusIcon(status)}
        <span className="ml-1">{status}</span>
      </Badge>
    );
  };

  if (devicesLoading || pendingLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
      </div>
    );
  }

  const devices = devicesData?.devices || [];
  const pendingDevices = pendingData?.pendingDevices || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="w-6 h-6 text-orange-400" />
        <h2 className="text-2xl font-bold text-white">Device Security Management</h2>
      </div>

      {/* Pending Devices */}
      {pendingDevices.length > 0 && (
        <Card className="border-yellow-500/20 bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-yellow-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              Pending Device Approvals ({pendingDevices.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {pendingDevices.map((device: PendingDevice) => (
              <div key={device.id} className="border border-slate-700 rounded-lg p-4 bg-slate-800/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getDeviceIcon(device.userAgent)}
                    <div>
                      <h4 className="font-medium text-white">{device.deviceName}</h4>
                      <p className="text-sm text-slate-400">{device.ipAddress}</p>
                      <p className="text-xs text-slate-500 truncate max-w-md">{device.userAgent}</p>
                      <p className="text-xs text-slate-400 mt-1">
                        Requested: {format(new Date(device.createdAt), 'MMM dd, yyyy HH:mm')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => approveMutation.mutate(device.id)}
                      disabled={approveMutation.isPending}
                      className="bg-green-600 hover:bg-green-700"
                      data-testid="button-approve-device"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => revokeMutation.mutate(device.id)}
                      disabled={revokeMutation.isPending}
                      data-testid="button-deny-device"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Deny
                    </Button>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Authorized Devices */}
      <Card className="border-slate-700 bg-slate-900/50">
        <CardHeader>
          <CardTitle className="text-white">Authorized Devices ({devices.length})</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {devices.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No devices registered yet.</p>
          ) : (
            devices.map((device: TrustedDevice) => (
              <div key={device.id} className="border border-slate-700 rounded-lg p-4 bg-slate-800/30">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3">
                    {getDeviceIcon(device.userAgent)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white">{device.deviceName}</h4>
                        {getStatusBadge(device.status)}
                      </div>
                      <p className="text-sm text-slate-400">{device.ipAddress}</p>
                      <p className="text-xs text-slate-500 truncate max-w-md">{device.userAgent}</p>
                      <div className="flex gap-4 mt-2 text-xs text-slate-400">
                        <span>Last used: {format(new Date(device.lastUsedAt), 'MMM dd, yyyy HH:mm')}</span>
                        <span>Expires: {format(new Date(device.expiresAt), 'MMM dd, yyyy')}</span>
                      </div>
                    </div>
                  </div>
                  {device.status === 'approved' && (
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => revokeMutation.mutate(device.id)}
                      disabled={revokeMutation.isPending}
                      data-testid="button-revoke-device"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Revoke
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Security Info */}
      <Card className="border-blue-500/20 bg-slate-900/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Shield className="w-5 h-5 text-blue-400 mt-0.5" />
            <div className="space-y-2">
              <h4 className="font-medium text-blue-400">How Device Security Works</h4>
              <ul className="text-sm text-slate-300 space-y-1">
                <li>• Each new device needs approval before accessing admin functions</li>
                <li>• Devices are identified by browser fingerprint and IP address</li>
                <li>• Approved devices stay authorized for 1 year unless revoked</li>
                <li>• You can revoke access from any device immediately</li>
                <li>• Only head admin accounts require device authorization</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}