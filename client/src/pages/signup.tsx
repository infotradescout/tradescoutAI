import { useEffect } from "react";
import { useLocation } from "wouter";

export default function Signup() {
  const [, setLocation] = useLocation();
  useEffect(() => {
    setLocation(`/create-account${window.location.search || ""}`);
  }, [setLocation]);

  return null;
}