import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useClerkSupabase } from "./useClerkSupabase";
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

const QUERY_KEY = ["admin-sidebar-config"];

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

/** Add any new NAV_ITEMS not present in the stored config */
function withForwardCompat(config: SidebarConfig): SidebarConfig {
  const knownIds = new Set([...config.activeIds, ...config.unusedIds]);
  const newIds = NAV_ITEMS.map((i) => i.id).filter((id) => !knownIds.has(id));
  if (newIds.length === 0) return config;
  return { activeIds: [...config.activeIds, ...newIds], unusedIds: config.unusedIds };
}

function resolveItems(ids: string[]): NavItem[] {
  return ids
    .map((id) => NAV_ITEMS.find((item) => item.id === id))
    .filter((item): item is NavItem => !!item);
}

/**
 * Hook that manages the admin sidebar configuration with Supabase persistence.
 * The config is shared across all admins — any admin's reorder is visible to everyone.
 */
export function useAdminSidebarConfig(userId: string | undefined) {
  const supabase = useClerkSupabase();
  const queryClient = useQueryClient();

  // Local optimistic state so drag-and-drop feels instant
  const [localConfig, setLocalConfig] = useState<SidebarConfig>(getDefaultConfig);
  const hasAppliedRemote = useRef(false);

  // Fetch shared config from Supabase
  const { data: remoteConfig } = useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("admin_sidebar_config")
        .select("active_ids, unused_ids")
        .eq("id", 1)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;
      return withForwardCompat({
        activeIds: data.active_ids as string[],
        unusedIds: data.unused_ids as string[],
      });
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // refetch every 30s to pick up other admins' changes
    refetchOnWindowFocus: true,
  });

  // Sync remote → local when remote data arrives
  useEffect(() => {
    if (remoteConfig) {
      setLocalConfig(remoteConfig);
      hasAppliedRemote.current = true;
    }
  }, [remoteConfig]);

  // Upsert mutation
  const { mutate: saveConfig } = useMutation({
    mutationFn: async (config: SidebarConfig) => {
      const { error } = await supabase
        .from("admin_sidebar_config")
        .upsert(
          {
            id: 1,
            active_ids: config.activeIds,
            unused_ids: config.unusedIds,
            updated_at: new Date().toISOString(),
            updated_by: userId ?? null,
          },
          { onConflict: "id" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY });
    },
  });

  const persist = useCallback(
    (newConfig: SidebarConfig) => {
      if (userId) {
        saveConfig(newConfig);
      }
    },
    [userId, saveConfig]
  );

  /**
   * Move an item to a different section (or same section at a new index).
   */
  const moveItem = useCallback(
    (itemId: string, toSection: "active" | "unused", newIndex?: number) => {
      setLocalConfig((prev) => {
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
      setLocalConfig((prev) => {
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
    activeItems: resolveItems(localConfig.activeIds),
    unusedItems: resolveItems(localConfig.unusedIds),
    moveItem,
    reorderSection,
  };
}
