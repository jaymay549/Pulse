import { useState, useMemo } from "react";
import { Search, ArrowUpDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import type { WhatsAppGroup } from "@/types/admin";

type SortField = "name" | "message_count" | "last_message_at";

interface GroupSelectionTableProps {
  groups: WhatsAppGroup[];
  selectedIds: number[];
  onSelectionChange: (ids: number[]) => void;
  onStartChat: () => void;
}

const GroupSelectionTable = ({
  groups,
  selectedIds,
  onSelectionChange,
  onStartChat,
}: GroupSelectionTableProps) => {
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("name");
  const [sortAsc, setSortAsc] = useState(true);
  const [showUnmonitored, setShowUnmonitored] = useState(false);

  const filtered = useMemo(() => {
    let list = groups;
    if (!showUnmonitored) list = list.filter((g) => g.is_monitored);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((g) => g.name.toLowerCase().includes(q));
    }
    list = [...list].sort((a, b) => {
      let cmp = 0;
      if (sortField === "name") cmp = a.name.localeCompare(b.name);
      else if (sortField === "message_count")
        cmp = (a.message_count || 0) - (b.message_count || 0);
      else if (sortField === "last_message_at")
        cmp =
          new Date(a.last_message_at || 0).getTime() -
          new Date(b.last_message_at || 0).getTime();
      return sortAsc ? cmp : -cmp;
    });
    return list;
  }, [groups, search, sortField, sortAsc, showUnmonitored]);

  const toggleAll = () => {
    if (selectedIds.length === filtered.length) {
      onSelectionChange([]);
    } else {
      onSelectionChange(filtered.map((g) => g.id));
    }
  };

  const toggleOne = (id: number) => {
    onSelectionChange(
      selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
    );
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortAsc(!sortAsc);
    else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <Input
            placeholder="Search groups..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 h-9 text-sm bg-zinc-900 border-zinc-700 text-zinc-200"
          />
        </div>
        <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
          <Checkbox
            checked={showUnmonitored}
            onCheckedChange={(v) => setShowUnmonitored(!!v)}
            className="border-zinc-600"
          />
          Show unmonitored
        </label>
      </div>

      <div className="border border-zinc-800 rounded-lg overflow-hidden max-h-[400px] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-900 sticky top-0">
            <tr className="text-zinc-400 text-xs">
              <th className="p-2 w-8">
                <Checkbox
                  checked={
                    filtered.length > 0 &&
                    selectedIds.length === filtered.length
                  }
                  onCheckedChange={toggleAll}
                  className="border-zinc-600"
                />
              </th>
              <th
                className="p-2 text-left cursor-pointer select-none"
                onClick={() => handleSort("name")}
              >
                <span className="flex items-center gap-1">
                  Name <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
              <th
                className="p-2 text-right cursor-pointer select-none"
                onClick={() => handleSort("message_count")}
              >
                <span className="flex items-center justify-end gap-1">
                  Messages <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
              <th
                className="p-2 text-right cursor-pointer select-none"
                onClick={() => handleSort("last_message_at")}
              >
                <span className="flex items-center justify-end gap-1">
                  Last Active <ArrowUpDown className="h-3 w-3" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {filtered.map((g) => (
              <tr
                key={g.id}
                className={`hover:bg-zinc-900/50 cursor-pointer ${
                  selectedIds.includes(g.id) ? "bg-zinc-900/30" : ""
                }`}
                onClick={() => toggleOne(g.id)}
              >
                <td className="p-2">
                  <Checkbox
                    checked={selectedIds.includes(g.id)}
                    onCheckedChange={() => toggleOne(g.id)}
                    className="border-zinc-600"
                  />
                </td>
                <td className="p-2 text-zinc-200">
                  <div className="flex items-center gap-2">
                    {g.name}
                    {!g.is_monitored && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-500">
                        unmonitored
                      </span>
                    )}
                  </div>
                </td>
                <td className="p-2 text-right text-zinc-400">
                  {g.message_count?.toLocaleString() || "—"}
                </td>
                <td className="p-2 text-right text-zinc-400 text-xs">
                  {g.last_message_at
                    ? new Date(g.last_message_at).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="p-8 text-center text-zinc-500 text-sm">
                  No groups found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs text-zinc-500">
          {selectedIds.length} of {filtered.length} selected
        </span>
        <Button
          onClick={onStartChat}
          disabled={selectedIds.length === 0}
          size="sm"
          className="bg-blue-600 hover:bg-blue-700"
        >
          Start Chat
        </Button>
      </div>
    </div>
  );
};

export default GroupSelectionTable;
