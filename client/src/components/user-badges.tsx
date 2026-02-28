import * as React from "react";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  Shield,
  Star,
  Compass,
  HeartHandshake,
  Crown,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeSize = "sm" | "md" | "lg";

type BadgeRarity = "common" | "rare" | "epic" | "legendary" | "secret";

type BadgeUiConfig = {
  icon: LucideIcon;
  rarity: BadgeRarity;
  priority: number;
};

const badgeUiRegistry: Record<string, BadgeUiConfig> = {
  founder: { icon: Crown, rarity: "legendary", priority: 0 },
  verified: { icon: Shield, rarity: "epic", priority: 5 },
  helper: { icon: HeartHandshake, rarity: "rare", priority: 10 },
  explorer: { icon: Compass, rarity: "rare", priority: 12 },
  regular: { icon: Star, rarity: "common", priority: 20 },
  record_keeper: { icon: Award, rarity: "rare", priority: 22 },
  community_builder: { icon: Award, rarity: "epic", priority: 2 },
  secret: { icon: Sparkles, rarity: "secret", priority: 50 },
};

function normalizeLabel(label: string): string {
  return label.trim().toLowerCase();
}

function resolveBadgeKey(label: string): string {
  const lower = normalizeLabel(label);

  if (lower.startsWith("founder")) return "founder";
  if (lower.includes("community builder")) return "community_builder";
  if (lower.includes("verified")) return "verified";
  if (lower.includes("helper")) return "helper";
  if (lower.includes("explorer")) return "explorer";
  if (lower.includes("regular")) return "regular";
  if (lower.includes("record")) return "record_keeper";
  if (lower.includes("secret")) return "secret";

  return lower.replace(/[^a-z0-9]+/g, "_") || "generic";
}

function getConfigForLabel(label: string): { key: string; config: BadgeUiConfig } {
  const key = resolveBadgeKey(label);
  const fromRegistry = badgeUiRegistry[key];

  if (fromRegistry) return { key, config: fromRegistry };

  return {
    key,
    config: {
      icon: Star,
      rarity: "common",
      priority: 40,
    },
  };
}

function sizeToClasses(size: BadgeSize): { icon: string; container: string; label: string } {
  if (size === "sm") {
    return {
      icon: "h-3.5 w-3.5",
      container: "h-5 w-5",
      label: "text-[0.65rem]",
    };
  }
  if (size === "lg") {
    return {
      icon: "h-6 w-6",
      container: "h-10 w-10",
      label: "text-xs",
    };
  }
  return {
    icon: "h-4.5 w-4.5",
    container: "h-7 w-7",
    label: "text-[0.7rem]",
  };
}

function rarityClasses(rarity: BadgeRarity): string {
  switch (rarity) {
    case "legendary":
      return "bg-amber-900/40 text-amber-100 border-amber-400/80 ring-1 ring-amber-300/80 shadow-[0_0_14px_rgba(250,204,21,0.7)]";
    case "epic":
      return "bg-purple-900/40 text-purple-100 border-purple-400/80 ring-1 ring-purple-300/70 shadow-[0_0_12px_rgba(168,85,247,0.6)]";
    case "rare":
      return "bg-emerald-900/40 text-emerald-100 border-emerald-400/80 ring-1 ring-emerald-300/70 shadow-[0_0_10px_rgba(16,185,129,0.5)]";
    case "secret":
      return "bg-sky-900/40 text-sky-100 border-sky-400/80 ring-1 ring-sky-300/70 shadow-[0_0_10px_rgba(56,189,248,0.5)]";
    case "common":
    default:
      return "bg-tsCard/95 text-white border-white/15";
  }
}

export interface UserBadgesProps {
  badges?: string[] | null;
  size?: BadgeSize;
  maxVisible?: number;
  showLabels?: boolean;
  className?: string;
}

export function UserBadges({
  badges,
  size = "sm",
  maxVisible = 3,
  showLabels = false,
  className,
}: UserBadgesProps) {
  if (!badges || badges.length === 0) return null;

  const labelByKey = new Map<string, string>();
  const configByKey = new Map<string, BadgeUiConfig>();

  for (const raw of badges) {
    if (typeof raw !== "string" || !raw.trim()) continue;
    const { key, config } = getConfigForLabel(raw);
    if (!labelByKey.has(key)) {
      labelByKey.set(key, raw);
      configByKey.set(key, config);
    }
  }

  if (labelByKey.size === 0) return null;

  const entries = Array.from(labelByKey.entries()).map(([key, label]) => ({
    key,
    label,
    config: configByKey.get(key)!,
  }));

  entries.sort((a, b) => {
    if (a.config.priority !== b.config.priority) {
      return a.config.priority - b.config.priority;
    }
    return a.label.localeCompare(b.label);
  });

  const { icon: iconClass, container: containerClass, label: labelClass } = sizeToClasses(size);

  const limited = entries.slice(0, maxVisible);

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {limited.map(({ key, label, config }) => {
        const Icon = config.icon;
        return (
          <div
            key={key}
            className={cn(
              "inline-flex items-center justify-center rounded-full border shadow-sm",
              rarityClasses(config.rarity),
              containerClass,
            )}
            title={label}
          >
            <Icon className={iconClass} />
            {showLabels && (
              <span className={cn("ml-2 max-w-[9rem] truncate font-medium", labelClass)}>{label}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
