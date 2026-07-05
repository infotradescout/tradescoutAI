export type NavSection = {
  label: string;
  href: string;
};

// Primary app sections Scout should understand and link to
export const NAV_SECTIONS: NavSection[] = [
  { label: "Direct Connect", href: "/direct-connect" },
  { label: "Community", href: "/community" },
  { label: "Exchange", href: "/exchange" },
  { label: "Asset Management", href: "/homes" },
  { label: "Messages", href: "/messages" },
  { label: "Connections", href: "/connections" },
  { label: "Leaderboard", href: "/leaderboard" },
  { label: "Help", href: "/help" },
];
