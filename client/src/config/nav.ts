export type NavSection = {
  label: string;
  href: string;
};

// Primary app sections Scout should understand and link to
export const NAV_SECTIONS: NavSection[] = [
  { label: "Direct Connect", href: "/direct-connect" },
  { label: "Find Local Businesses", href: "/find-local-businesses" },
  { label: "For Businesses", href: "/for-businesses" },
  { label: "Community", href: "/community" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Groups / HOA", href: "/groups" },
  { label: "Messages", href: "/messages" },
  { label: "Connections", href: "/connections" },
  { label: "Dashboard", href: "/hoa-dashboard" },
];
