import { memo, useEffect } from 'react';
import { useLocation } from 'wouter';

const AdminDashboard = memo(function AdminDashboard() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Retire legacy dashboard in favor of the Ops workspace
    setLocation('/admin/workspace');
  }, [setLocation]);

  return null;
});

export default AdminDashboard;