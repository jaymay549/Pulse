import { RotateCcw, Trash2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useRestorePrompt, useDeletePrompt } from "@/hooks/usePrompts";
import { toast } from "sonner";
import type { SummaryPrompt } from "@/types/admin";

interface VersionHistoryProps {
  versions: SummaryPrompt[];
}

const VersionHistory = ({ versions }: VersionHistoryProps) => {
  const restoreMutation = useRestorePrompt();
  const deleteMutation = useDeletePrompt();

  const handleRestore = async (id: number, version: number) => {
    try {
      await restoreMutation.mutateAsync(id);
      toast.success(`Restored version ${version}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to restore");
    }
  };

  const handleDelete = async (id: number, version: number) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast.success(`Deleted version ${version}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to delete");
    }
  };

  if (versions.length === 0) {
    return <p className="text-xs text-zinc-600 py-4">No versions found.</p>;
  }

  return (
    <div className="space-y-1">
      <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
        Version History
      </span>
      {versions.map((v) => (
        <div
          key={v.id}
          className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-900/60 transition-colors group"
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-zinc-300">v{v.version}</span>
              {v.is_active && (
                <Badge
                  variant="outline"
                  className="text-[9px] px-1 py-0 bg-green-900/30 text-green-400 border-green-800"
                >
                  Active
                </Badge>
              )}
              <span className="text-[10px] text-zinc-600">
                {new Date(v.created_at).toLocaleString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <p className="text-[10px] text-zinc-600 truncate mt-0.5">
              {v.prompt.slice(0, 120)}...
            </p>
          </div>
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            {!v.is_active && (
              <>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-zinc-500 hover:text-green-400"
                  onClick={() => handleRestore(v.id, v.version)}
                  disabled={restoreMutation.isPending}
                >
                  {restoreMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <RotateCcw className="h-3 w-3" />
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-1.5 text-zinc-500 hover:text-red-400"
                  onClick={() => handleDelete(v.id, v.version)}
                  disabled={deleteMutation.isPending}
                >
                  {deleteMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <Trash2 className="h-3 w-3" />
                  )}
                </Button>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default VersionHistory;
