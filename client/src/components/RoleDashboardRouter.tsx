import { memo, lazy, Suspense } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { Loader2 } from 'lucide-react';

// Import all role-specific dashboards
const SimpleHome = lazy(() => import('@/pages/SimpleHome'));
const ContractorDashboard = lazy(() => import('@/pages/contractor-dashboard'));
const RealtorDashboard = lazy(() => import('@/pages/realtor-dashboard'));
const DealerDashboard = lazy(() => import('@/pages/dealer-dashboard'));
const CarSalesmanDashboard = lazy(() => import('@/pages/car-salesman-dashboard'));
const InsuranceAgentDashboard = lazy(() => import('@/pages/insurance-agent-dashboard'));
const MortgageBrokerDashboard = lazy(() => import('@/pages/mortgage-broker-dashboard'));
const PropertyManagerDashboard = lazy(() => import('@/pages/property-manager-dashboard'));
const HOADashboard = lazy(() => import('@/pages/hoa-dashboard'));
const BusinessOwnerDashboard = lazy(() => import('@/pages/business-owner-dashboard'));
const AdminDashboard = lazy(() => import('@/pages/admin-dashboard'));
const StaffDashboard = lazy(() => import('@/pages/staff-dashboard'));
const HelperDashboard = lazy(() => import('@/pages/helper-dashboard'));

const RoleDashboardRouter = memo(function RoleDashboardRouter() {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
      </div>
    );
  }

  if (!user) {
    setLocation('/login');
    return null;
  }

  // Use activeRole if available, otherwise use primary role
  const currentRole = user.activeRole || user.role || 'homeowner';

  // Map roles to their dashboards
  const getDashboardComponent = () => {
    switch (currentRole) {
      // Contractor roles
      case 'contractor_user':
      case 'service_provider':
      case 'accelerator_member':
        return ContractorDashboard;
      
      // Professional service roles
      case 'realtor':
        return RealtorDashboard;
      
      case 'car_salesman':
        return CarSalesmanDashboard;
      
      case 'vehicle_dealer':
        return DealerDashboard;
      
      case 'insurance_agent':
        return InsuranceAgentDashboard;
      
      case 'mortgage_broker':
        return MortgageBrokerDashboard;
      
      case 'property_manager':
        return PropertyManagerDashboard;
      
      // HOA roles
      case 'hoa_admin':
      case 'hoa_board':
      case 'hoa_manager':
        return HOADashboard;
      
      // Business owner
      case 'business_owner':
        return BusinessOwnerDashboard;
      
      // Staff/Admin roles
      case 'admin':
      case 'super_admin':
        return AdminDashboard;
      
      case 'support_agent':
      case 'content_moderator':
      case 'territory_manager':
      case 'contractor_success':
      case 'content_seo':
      case 'operations':
      case 'staff':
        return StaffDashboard;
      
      // Helper/Worker
      case 'helper':
        return HelperDashboard;
      
      // Default: Homeowner/Community Member
      case 'homeowner':
      case 'community_member':
      case 'community_moderator':
      case 'community_leader':
      default:
        return SimpleHome;
    }
  };

  const DashboardComponent = getDashboardComponent();

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          <Loader2 className="w-8 h-8 animate-spin text-orange-600" />
        </div>
      }
    >
      <DashboardComponent />
    </Suspense>
  );
});

export default RoleDashboardRouter;
