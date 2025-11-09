import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoleBadge, RoleHierarchy, PermissionIndicator } from "@/components/ui/RoleBadge";
import { TradeBadge, TradeCategoryHeader } from "@/components/ui/TradeBadge";
import { useAuth } from "@/hooks/useAuth";
import { 
  ROLE_CATEGORIES, 
  TRADE_CATEGORIES,
  getRoleDisplayName,
  getTradeDisplayName,
  getRolePermissions,
  getRoleHierarchyLevel
} from "@shared/roles";
import type { UserRole, TradeCategory } from "@shared/roles";
import { Users, Shield, Briefcase, Crown, Star, Building, Hammer } from "lucide-react";

export default function RoleDirectory() {
  const { user, isAuthenticated } = useAuth();

  const currentUserRole = user?.role as UserRole;
  const currentUserLevel = currentUserRole ? getRoleHierarchyLevel(currentUserRole) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-6">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold text-white">TradeScout Role Directory</h1>
          <p className="text-xl text-gray-300 max-w-3xl mx-auto">
            Comprehensive guide to user roles, permissions, and trade categories across the platform
          </p>
          {isAuthenticated && user && (
            <div className="flex items-center justify-center gap-4">
              <span className="text-gray-400">Your Role:</span>
              <RoleBadge role={currentUserRole} size="lg" />
              <RoleHierarchy role={currentUserRole} showLevel />
            </div>
          )}
        </div>

        {/* User Roles Section */}
        <Card className="bg-[#1a2332]/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="h-6 w-6" />
              User Role Hierarchy
            </CardTitle>
            <CardDescription className="text-gray-300">
              Platform roles organized by authority level and permissions
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {Object.entries(ROLE_CATEGORIES).map(([categoryName, roles]) => (
              <div key={categoryName} className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    {categoryName === 'admin' && <Crown className="h-5 w-5 text-red-500" />}
                    {categoryName === 'staff' && <Star className="h-5 w-5 text-yellow-500" />}
                    {categoryName === 'community' && <Users className="h-5 w-5 text-green-500" />}
                    {categoryName === 'service_provider' && <Briefcase className="h-5 w-5 text-blue-500" />}
                    {categoryName === 'customer' && <Building className="h-5 w-5 text-gray-500" />}
                    <h3 className="text-xl font-semibold text-white capitalize">
                      {categoryName.replace('_', ' ')} Roles
                    </h3>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {roles.length} roles
                  </Badge>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {roles.map((role) => {
                    const permissions = getRolePermissions(role as UserRole);
                    const hierarchyLevel = getRoleHierarchyLevel(role as UserRole);
                    const isCurrentRole = currentUserRole === role;
                    
                    return (
                      <Card key={role} className={`bg-slate-700/50 border-slate-600 ${isCurrentRole ? 'ring-2 ring-orange-500' : ''}`}>
                        <CardHeader className="pb-3">
                          <div className="flex items-center justify-between">
                            <RoleBadge role={role as UserRole} size="md" />
                            {isCurrentRole && (
                              <Badge className="bg-orange-500 text-white text-xs">You</Badge>
                            )}
                          </div>
                          <RoleHierarchy role={role as UserRole} showLevel />
                        </CardHeader>
                        <CardContent className="space-y-3">
                          <div className="text-sm text-gray-300">
                            Authority Level: <span className="font-medium text-white">{hierarchyLevel}</span>
                          </div>
                          
                          <div className="space-y-2">
                            <h4 className="text-sm font-medium text-white">Key Permissions</h4>
                            <div className="grid grid-cols-1 gap-1">
                              {Object.entries(permissions)
                                .filter(([, hasPermission]) => hasPermission)
                                .slice(0, 4)
                                .map(([permission]) => (
                                  <PermissionIndicator
                                    key={permission}
                                    hasPermission={true}
                                    permissionName={permission.replace(/([A-Z])/g, ' $1').toLowerCase()}
                                    size="sm"
                                  />
                                ))}
                              {Object.values(permissions).filter(Boolean).length > 4 && (
                                <div className="text-xs text-gray-400 mt-1">
                                  +{Object.values(permissions).filter(Boolean).length - 4} more permissions
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Trade Categories Section */}
        <Card className="bg-[#1a2332]/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Hammer className="h-6 w-6" />
              Trade Categories
            </CardTitle>
            <CardDescription className="text-gray-300">
              Specialized contractor categories organized by industry sector
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-8">
            {Object.entries(TRADE_CATEGORIES).map(([categoryName, trades]) => (
              <div key={categoryName} className="space-y-4">
                <TradeCategoryHeader 
                  category={categoryName as keyof typeof TRADE_CATEGORIES}
                  trades={trades as TradeCategory[]}
                />
                
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                  {trades.map((trade) => (
                    <div key={trade} className="flex justify-center">
                      <TradeBadge trade={trade as TradeCategory} size="sm" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Role Permissions Matrix */}
        <Card className="bg-[#1a2332]/50 border-slate-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Shield className="h-6 w-6" />
              Permissions Overview
            </CardTitle>
            <CardDescription className="text-gray-300">
              Quick reference for role-based permissions across the platform
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-600">
                    <th className="text-left py-2 text-white">Role</th>
                    <th className="text-center py-2 text-white">Level</th>
                    <th className="text-center py-2 text-white">Admin Panel</th>
                    <th className="text-center py-2 text-white">Moderate</th>
                    <th className="text-center py-2 text-white">Manage Users</th>
                    <th className="text-center py-2 text-white">Analytics</th>
                    <th className="text-center py-2 text-white">Payments</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.values(ROLE_CATEGORIES).flat().slice(0, 10).map((role) => {
                    const permissions = getRolePermissions(role as UserRole);
                    const level = getRoleHierarchyLevel(role as UserRole);
                    
                    return (
                      <tr key={role} className="border-b border-slate-700/50">
                        <td className="py-2">
                          <RoleBadge role={role as UserRole} size="sm" />
                        </td>
                        <td className="text-center py-2 text-white">{level}</td>
                        <td className="text-center py-2">
                          {permissions.canAccessAdminPanel ? (
                            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto" />
                          ) : (
                            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto" />
                          )}
                        </td>
                        <td className="text-center py-2">
                          {permissions.canModerateContent ? (
                            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto" />
                          ) : (
                            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto" />
                          )}
                        </td>
                        <td className="text-center py-2">
                          {permissions.canEditUsers ? (
                            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto" />
                          ) : (
                            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto" />
                          )}
                        </td>
                        <td className="text-center py-2">
                          {permissions.canViewAnalytics ? (
                            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto" />
                          ) : (
                            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto" />
                          )}
                        </td>
                        <td className="text-center py-2">
                          {permissions.canManagePayments ? (
                            <div className="w-3 h-3 bg-green-500 rounded-full mx-auto" />
                          ) : (
                            <div className="w-3 h-3 bg-red-500 rounded-full mx-auto" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}