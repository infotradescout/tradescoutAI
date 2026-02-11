// Legacy admin dashboard has been fully retired.
// Keep this route as a redirect so older /dashboard role routing never lands on a blank page.

import { useEffect } from "react";
import { useLocation } from "wouter";

export default function AdminDashboard() {
  const [, navigate] = useLocation();

  useEffect(() => {
    navigate("/admin", { replace: true } as any);
  }, [navigate]);

  return null;
}
