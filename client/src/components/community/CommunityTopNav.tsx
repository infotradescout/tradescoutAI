import React, { useMemo } from "react";
import { useLocation } from "wouter";

type CommunityScope =
  | "for_you"
  | "following"
  | "nearby"
  | "recent"
  | "recommendations"
  | "vault";

type NavItem = {
  key: CommunityScope;
  label: string;
  icon: React.ReactNode;
  href: string;
};

function useQueryParam(key: string): string | null {
  const [route] = useLocation();
  return useMemo(() => {
    const idx = route.indexOf("?");
    const search = idx >= 0 ? route.slice(idx + 1) : "";
    return new URLSearchParams(search).get(key);
  }, [route, key]);
}

function setQueryParam(pathname: string, search: string, key: string, value: string) {
  const sp = new URLSearchParams(search);
  sp.set(key, value);
  const qs = sp.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

const IconWrap: React.FC<{ active: boolean; children: React.ReactNode }> = ({ active, children }) => {
  return (
    <div
      className={[
        "h-11 w-11 rounded-2xl flex items-center justify-center",
        "border transition-all",
        active
          ? "bg-neutral-900 border-neutral-700 shadow-sm"
          : "bg-neutral-950/40 border-neutral-800 hover:bg-neutral-900/60",
      ].join(" ")}
    >
      {children}
    </div>
  );
};

const Label: React.FC<{ active: boolean; children: React.ReactNode }> = ({ active, children }) => (
  <div className={["text-xs mt-1", active ? "text-white" : "text-neutral-400"].join(" ")}>{children}</div>
);

const Svg: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" className="text-white">
    {children}
  </svg>
);

const Icons = {
  ForYou: (
    <Svg>
      <path
        d="M12 3l2.2 5.6L20 9l-4.5 3.6L16.9 19 12 15.9 7.1 19l1.4-6.4L4 9l5.8-.4L12 3z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </Svg>
  ),
  Following: (
    <Svg>
      <path
        d="M16 11c1.7 0 3-1.3 3-3s-1.3-3-3-3-3 1.3-3 3 1.3 3 3 3z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M8 11c1.7 0 3-1.3 3-3S9.7 5 8 5 5 6.3 5 8s1.3 3 3 3z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M4.5 19c.7-2.4 2.8-4 5.5-4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
      <path
        d="M13 15c3 0 5.2 1.6 6 4"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
      />
    </Svg>
  ),
  Nearby: (
    <Svg>
      <path
        d="M12 22s7-5.3 7-12a7 7 0 10-14 0c0 6.7 7 12 7 12z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 11.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </Svg>
  ),
  Recent: (
    <Svg>
      <path d="M12 8v5l3 2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M21 12a9 9 0 11-2.6-6.4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M21 4v5h-5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  ),
  Recs: (
    <Svg>
      <path
        d="M4 12c2.5-6 13.5-6 16 0-2.5 6-13.5 6-16 0z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 100-6 3 3 0 000 6z"
        stroke="currentColor"
        strokeWidth="1.7"
      />
    </Svg>
  ),
  Vault: (
    <Svg>
      <path
        d="M4 7h16v10H4V7z"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <path d="M8 7V5h8v2" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M12 10v4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      <path d="M10 12h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  ),
};

export const CommunityTopNav: React.FC<{
  basePath?: string; // default /community-feed
}> = ({ basePath = "/community-feed" }) => {
  const [route, navigate] = useLocation();
  const scope = (useQueryParam("scope") as CommunityScope | null) ?? "for_you";

  const items: NavItem[] = [
    { key: "for_you", label: "For You", icon: Icons.ForYou, href: basePath },
    { key: "following", label: "Following", icon: Icons.Following, href: basePath },
    { key: "nearby", label: "Nearby", icon: Icons.Nearby, href: basePath },
    { key: "recent", label: "Recent", icon: Icons.Recent, href: basePath },
    { key: "recommendations", label: "Recs", icon: Icons.Recs, href: basePath },
    { key: "vault", label: "Vault", icon: Icons.Vault, href: "/community-vault" },
  ];

  const onClick = (item: NavItem) => {
    if (item.key === "vault") {
      navigate(item.href);
      return;
    }

    const idx = route.indexOf("?");
    const currentSearch = idx >= 0 ? route.slice(idx + 1) : "";
    const url = setQueryParam(basePath, currentSearch, "scope", item.key);
    navigate(url);
  };

  return (
    <div className="w-full">
      <div className="flex items-center justify-between gap-2 px-3 pt-2">
        {items.map((item) => {
          const isVaultRoute = route.startsWith("/community-vault");
          const active =
            item.key === scope || (item.key === "vault" && isVaultRoute);
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onClick(item)}
              className="flex flex-col items-center select-none"
              aria-pressed={active}
            >
              <IconWrap active={active}>{item.icon}</IconWrap>
              <Label active={active}>{item.label}</Label>
            </button>
          );
        })}
      </div>
      <div className="mt-3 border-b border-neutral-900" />
    </div>
  );
};
