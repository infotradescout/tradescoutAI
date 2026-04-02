import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Signup() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(
      `/pre-scout-setup?mode=create${window.location.search ? `&${window.location.search.slice(1)}` : ""}`
    );
  }, [setLocation]);

  return null;
}
