import React from 'react';
import { useAuth } from '@/hooks/useAuth';
import UserManagement from '@/components/admin/UserManagement';
import RoleSwitcher from '@/components/admin/RoleSwitcher';
import FeatureTogglePanel from '@/components/admin/FeatureTogglePanel';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Users, Settings } from 'lucide-react';

export default function AdminUserManagement() {
  const { user, isAuthenticated } = useAuth();

  // Check if user has admin privileges
  if (!isAuthenticated || !user || !['head_admin', 'ops_admin'].includes(user.role)) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="text-center">
              <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-700 mb-2">Access Denied</h2>
              <p className="text-gray-500">You need admin privileges to access this page.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 space-y-8">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Users className="w-8 h-8" />
            User Management
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Manage user accounts, assign roles, and control platform access
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="px-3 py-1 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-full text-sm font-medium">
            {user.role === 'head_admin' ? 'Master Admin' : 'Admin'}
          </div>
        </div>
      </div>

      {/* Role Switcher (if user has multiple roles) */}
      {user.roles && user.roles.length > 1 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-1">
            <RoleSwitcher />
          </div>
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Multi-Role Dashboard
                </CardTitle>
                <CardDescription>
                  You have multiple roles assigned. Use the role switcher to access different platform features and dashboards seamlessly.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="font-medium">Current Role:</span>
                    <div className="text-primary">{user.activeRole || user.role}</div>
                  </div>
                  <div>
                    <span className="font-medium">Available Roles:</span>
                    <div className="text-muted-foreground">{user.roles?.length || 1} roles assigned</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* User Management Component */}
      <UserManagement />

      {/* Feature Toggle Panel */}
      <FeatureTogglePanel />

      {/* Admin Features Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Admin Features</CardTitle>
          <CardDescription>
            Available tools and capabilities for user management
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Multi-Role Assignment</h3>
              <p className="text-sm text-muted-foreground">
                Users can have multiple roles simultaneously (contractor + realtor + admin)
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Role Switching</h3>
              <p className="text-sm text-muted-foreground">
                Seamless switching between role-specific dashboards and features
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">User Impersonation</h3>
              <p className="text-sm text-muted-foreground">
                Test platform functionality by viewing as any user
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Access Control</h3>
              <p className="text-sm text-muted-foreground">
                Fine-grained permissions and role-based access control
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Account Verification</h3>
              <p className="text-sm text-muted-foreground">
                Track email, address, and social media verification status
              </p>
            </div>
            <div className="p-4 border rounded-lg">
              <h3 className="font-semibold mb-2">Platform Analytics</h3>
              <p className="text-sm text-muted-foreground">
                Monitor user activity, role distribution, and platform health
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}