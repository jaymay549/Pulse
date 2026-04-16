import { useState, useEffect, useCallback } from "react";
import {
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Radio,
  CalendarClock,
  FileText,
  Settings,
  Sparkles,
  Send,
  Users,
  TrendingUp,
  Bug,
  BadgeCheck,
  Target,
  Store,
  Sliders,
  Eye,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  id: string;
  to: string;
  icon: LucideIcon;
  label: string;
  end?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { id: "dashboard", to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { id: "sales-targets", to: "/admin/sales-targets", icon: Target, label: "Sales Targets" },
  { id: "vendors", to: "/admin/vendors", icon: Store, label: "Vendor Management" },
  { id: "tier-config", to: "/admin/tier-config", icon: Sliders, label: "Tier Config" },
  { id: "tier-preview", to: "/admin/tier-preview", icon: Eye, label: "Tier Preview" },
  { id: "chat", to: "/admin/chat", icon: Sparkles, label: "AI Chat" },
  { id: "queue", to: "/admin/queue", icon: ListChecks, label: "Vendor Queue" },
  { id: "claims", to: "/admin/claims", icon: BadgeCheck, label: "Claims" },
  { id: "topics", to: "/admin/topics", icon: MessageSquare, label: "Topics" },
  { id: "groups", to: "/admin/groups", icon: Radio, label: "Groups" },
  { id: "members", to: "/admin/members", icon: Users, label: "Members" },
  { id: "tasks", to: "/admin/tasks", icon: CalendarClock, label: "Tasks" },
  { id: "send", to: "/admin/send", icon: Send, label: "Send Message" },
  { id: "prompts", to: "/admin/prompts", icon: FileText, label: "Prompts" },
  { id: "trends", to: "/admin/trends", icon: TrendingUp, label: "Trends" },
  { id: "debug", to: "/admin/debug", icon: Bug, label: "Debug" },
  { id: "settings", to: "/admin/settings", icon: Settings, label: "Settings" },
];

const DEFAULT_UNUSED_IDS = ["send", "prompts", "trends", "debug"];

interface SidebarConfig {
  activeIds: string[];
  unusedIds: string[];
}

function getDefaultConfig(): SidebarConfig {
  const allIds = NAV_ITEMS.map((item) => item.id);
  return {
    activeIds: allIds.filter((id) => !DEFAULT_UNUSED_IDS.includes(id)),
    unusedIds: DEFAULT_UNUSED_IDS,
  };
}

function getStorageKey(userId: string): string {
  return `admin-sidebar-config-${userId}`;
}

function resolveItems(ids: string[]): NavItem[] {
  return ids
    .map((id) => NAV_ITEMS.find((item) => item.id === id))
    .filter((item): item is NavItem => !!item);
}

/**
 * Hook that manages the admin sidebar configuration with localStorage persistence.
 * Keyed by Clerk userId so each admin gets their own layout.
 */
export function useAdminSidebarConfig(userId: string | undefined) {
  const [config, setConfig] = useState<SidebarConfig>(() => {
    // Initial load from localStorage if userId is available
    if (userId) {
      try {
        const stored = localStorage.getItem(getStorageKey(userId));
        if (stored) {
          const parsed = JSON.parse(stored) as SidebarConfig;
          // Forward-compatibility: add any new items not in stored config
          const knownIds = new Set([...parsed.activeIds, ...parsed.unusedIds]);
          const newIds = NAV_ITEMS.map((i) => i.id).filter((id) => !knownIds.has(id));
          if (newIds.length > 0) {
            return {
              activeIds: [...parsed.activeIds, ...newIds],
              unusedIds: parsed.unusedIds,
            };
          }
          return parsed;
        }
      } catch {
        // Ignore parse errors, fall through to default
      }
    }
    return getDefaultConfig();
  });

  // Re-read from localStorage when userId becomes available (e.g., after auth loads)
  useEffect(() => {
    if (!userId) return;
    try {
      const stored = localStorage.getItem(getStorageKey(userId));
      if (stored) {
        const parsed = JSON.parse(stored) as SidebarConfig;
        const knownIds = new Set([...parsed.activeIds, ...parsed.unusedIds]);
        const newIds = NAV_ITEMS.map((i) => i.id).filter((id) => !knownIds.has(id));
        setConfig({
          activeIds: newIds.length > 0 ? [...parsed.activeIds, ...newIds] : parsed.activeIds,
          unusedIds: parsed.unusedIds,
        });
      } else {
        setConfig(getDefaultConfig());
      }
    } catch {
      setConfig(getDefaultConfig());
    }
  }, [userId]);

  const persist = useCallback(
    (newConfig: SidebarConfig) => {
      if (userId) {
        try {
          localStorage.setItem(getStorageKey(userId), JSON.stringify(newConfig));
        } catch {
          // Ignore storage errors (e.g., private browsing quota)
        }
      }
    },
    [userId]
  );

  /**
   * Move an item to a different section (or same section at a new index).
   */
  const moveItem = useCallback(
    (itemId: string, toSection: "active" | "unused", newIndex?: number) => {
      setConfig((prev) => {
        const nextActive = prev.activeIds.filter((id) => id !== itemId);
        const nextUnused = prev.unusedIds.filter((id) => id !== itemId);

        if (toSection === "active") {
          if (newIndex !== undefined && newIndex >= 0 && newIndex <= nextActive.length) {
            nextActive.splice(newIndex, 0, itemId);
          } else {
            nextActive.push(itemId);
          }
        } else {
          if (newIndex !== undefined && newIndex >= 0 && newIndex <= nextUnused.length) {
            nextUnused.splice(newIndex, 0, itemId);
          } else {
            nextUnused.push(itemId);
          }
        }

        const next = { activeIds: nextActive, unusedIds: nextUnused };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  /**
   * Reorder items within a section.
   */
  const reorderSection = useCallback(
    (section: "active" | "unused", orderedIds: string[]) => {
      setConfig((prev) => {
        const next =
          section === "active"
            ? { ...prev, activeIds: orderedIds }
            : { ...prev, unusedIds: orderedIds };
        persist(next);
        return next;
      });
    },
    [persist]
  );

  return {
    activeItems: resolveItems(config.activeIds),
    unusedItems: resolveItems(config.unusedIds),
    moveItem,
    reorderSection,
  };
}
