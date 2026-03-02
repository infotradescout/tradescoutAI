export type NavSection = {
  label: string;
  href: string;
};

// Primary app sections Scout should understand and link to
export const NAV_SECTIONS: NavSection[] = [
  { label: "Community", href: "/community" },
  { label: "Marketplace", href: "/marketplace" },
  { label: "Groups / HOA", href: "/groups" },
  { label: "Messages", href: "/messages" },
  { label: "Connections", href: "/connections" },
  { label: "Dashboard", href: "/hoa-dashboard" },
];
