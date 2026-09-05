import { useLocation, useSearch } from "wouter";

export function useDirectConnectLocation() {
  const [pathname, navigate] = useLocation();
  // Wouter's pathname hook does not rerender when only the query changes.
  // Direct Connect also uses that query to select its task and county.
  const search = useSearch();
  return [search ? `${pathname}?${search}` : pathname, navigate] as const;
}
