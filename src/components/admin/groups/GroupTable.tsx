import { Eye, Star, MessageSquare } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import type { WhatsAppGroup } from "@/types/admin";

interface GroupTableProps {
  groups: WhatsAppGroup[];
  onToggleMonitoring: (id: number, monitored: boolean) => void;
  onToggleFavorite: (id: number, favorite: boolean) => void;
  onSelectGroup: (group: WhatsAppGroup) => void;
}

const GroupTable = ({
  groups,
  onToggleMonitoring,
  onToggleFavorite,
  onSelectGroup,
}: GroupTableProps) => {
  return (
    <div className="border border-zinc-800 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-zinc-800 bg-zinc-900/50">
            <th className="text-left px-3 py-2 text-zinc-500 font-medium">Name</th>
            <th className="text-center px-3 py-2 text-zinc-500 font-medium w-20">
              <Eye className="h-3 w-3 mx-auto" />
            </th>
            <th className="text-center px-3 py-2 text-zinc-500 font-medium w-20">
              <Star className="h-3 w-3 mx-auto" />
            </th>
            <th className="text-right px-3 py-2 text-zinc-500 font-medium w-24">Messages</th>
            <th className="text-right px-3 py-2 text-zinc-500 font-medium w-28">Last Activity</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr
              key={group.id}
              className="border-b border-zinc-800/50 hover:bg-zinc-900/40 transition-colors cursor-pointer"
              onClick={() => onSelectGroup(group)}
            >
              <td className="px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-100 font-medium truncate max-w-[300px]">
                    {group.name}
                  </span>
                  {group.is_monitored && (
                    <Badge variant="outline" className="text-[9px] px-1 py-0 text-green-400 border-green-800">
                      monitored
                    </Badge>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                <Switch
                  checked={group.is_monitored}
                  onCheckedChange={(checked) => onToggleMonitoring(group.id, checked)}
                  className="scale-75"
                />
              </td>
              <td className="px-3 py-2 text-center" onClick={(e) => e.stopPropagation()}>
                <button
                  onClick={() => onToggleFavorite(group.id, !group.is_favorite)}
                  className={`${group.is_favorite ? "text-amber-500" : "text-zinc-700 hover:text-amber-400"} transition-colors`}
                >
                  <Star className={`h-3.5 w-3.5 ${group.is_favorite ? "fill-current" : ""}`} />
                </button>
              </td>
              <td className="px-3 py-2 text-right text-zinc-400">
                <span className="flex items-center gap-1 justify-end">
                  <MessageSquare className="h-3 w-3" />
                  {group.message_count?.toLocaleString() || 0}
                </span>
              </td>
              <td className="px-3 py-2 text-right text-zinc-600">
                {group.last_message_at
                  ? new Date(group.last_message_at).toLocaleDateString("en-GB", { day: "numeric", month: "short" })
                  : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default GroupTable;
