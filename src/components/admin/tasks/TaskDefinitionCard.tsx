import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, Archive, RotateCcw, Clock, Users, Copy, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import OccurrenceRow from "./OccurrenceRow";
import type { TaskDefinition } from "@/types/admin";

interface TaskDefinitionCardProps {
  task: TaskDefinition;
  onArchive: () => void;
  onTriggerGenerate: (occurrenceId: number) => Promise<void>;
  onTriggerSend: (occurrenceId: number) => Promise<void>;
  onRejectOccurrence?: (occurrenceId: number) => Promise<void>;
  onSendOccurrence?: (occurrenceId: number) => Promise<void>;
}

const TaskDefinitionCard = ({
  task,
  onArchive,
  onTriggerGenerate,
  onTriggerSend,
  onRejectOccurrence,
  onSendOccurrence,
}: TaskDefinitionCardProps) => {
  const navigate = useNavigate();
  const occurrences = task.task_occurrences || [];
  const hasReady = occurrences.some((o) => o.status === "ready");
  const [expanded, setExpanded] = useState(hasReady);
  const latestOccurrence = occurrences[0];

  // Auto-expand when a "ready" occurrence appears
  useEffect(() => {
    if (hasReady) setExpanded(true);
  }, [hasReady]);

  const handleCopy = () => {
    navigate("/admin/tasks/create", {
      state: {
        copyFrom: {
          name: `${task.name} (Copy)`,
          group_ids: task.group_ids,
          recipient_group_ids: task.recipient_group_ids,
          prompt: task.prompt,
          timeframe: task.timeframe,
          custom_start_date: task.custom_start_date,
          custom_end_date: task.custom_end_date,
          pdf_mode: task.pdf_mode,
          admin_phone: task.admin_phone,
          notify_admin: task.notify_admin,
          repeat_type: task.repeat_type,
          pdf_filename_template: task.pdf_filename_template,
        },
      },
    });
  };

  return (
    <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl overflow-hidden">
      {/* Header */}
      <button
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-zinc-800/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex items-center gap-3 min-w-0">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-zinc-500 flex-shrink-0" />
          ) : (
            <ChevronRight className="h-4 w-4 text-zinc-500 flex-shrink-0" />
          )}
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-zinc-100 text-sm truncate">{task.name}</span>
              {task.is_archived && (
                <Badge variant="outline" className="text-[9px] px-1 py-0 text-zinc-600 border-zinc-700">
                  archived
                </Badge>
              )}
              {task.repeat_type && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-700">
                  {task.repeat_type}
                </Badge>
              )}
              {task.pdf_mode && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-500 border-zinc-700">
                  <FileText className="h-2.5 w-2.5 mr-0.5" />
                  {task.pdf_mode}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-[10px] text-zinc-600 mt-0.5">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {task.group_names?.length || 0} groups
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" />
                {task.timeframe}
              </span>
              {occurrences.length > 0 && (
                <span>{occurrences.length} occurrences</span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
          {latestOccurrence && (
            <Badge
              variant="outline"
              className={`text-[10px] px-1.5 py-0 ${
                latestOccurrence.status === "sent"
                  ? "text-green-400 border-green-800"
                  : latestOccurrence.status === "failed"
                  ? "text-red-400 border-red-800"
                  : latestOccurrence.status === "pending"
                  ? "text-amber-400 border-amber-800"
                  : "text-zinc-400 border-zinc-700"
              }`}
            >
              {latestOccurrence.status}
            </Badge>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-zinc-500 hover:text-zinc-300"
            onClick={handleCopy}
            title="Copy task"
          >
            <Copy className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-zinc-500 hover:text-zinc-300"
            onClick={onArchive}
          >
            {task.is_archived ? (
              <RotateCcw className="h-3.5 w-3.5" />
            ) : (
              <Archive className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </button>

      {/* Expanded: occurrences */}
      {expanded && (
        <div className="border-t border-zinc-800 px-4 py-3 space-y-2">
          {/* Groups */}
          {task.group_names && task.group_names.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.group_names.map((name) => (
                <Badge key={name} variant="outline" className="text-[9px] px-1 py-0 text-zinc-500 border-zinc-800">
                  {name}
                </Badge>
              ))}
            </div>
          )}

          {/* Prompt preview */}
          <div className="text-[10px] text-zinc-600 border border-zinc-800 rounded-lg p-2 max-h-20 overflow-hidden">
            {task.prompt.slice(0, 200)}...
          </div>

          {/* Occurrences */}
          {occurrences.length > 0 ? (
            <div className="space-y-1">
              <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">
                Occurrences
              </span>
              {occurrences.map((occ) => (
                <OccurrenceRow
                  key={occ.id}
                  occurrence={occ}
                  onTriggerGenerate={() => onTriggerGenerate(occ.id)}
                  onTriggerSend={() => onTriggerSend(occ.id)}
                  onReject={onRejectOccurrence ? () => onRejectOccurrence(occ.id) : undefined}
                  onSend={onSendOccurrence ? () => onSendOccurrence(occ.id) : undefined}
                />
              ))}
            </div>
          ) : (
            <p className="text-xs text-zinc-600 italic">No occurrences yet.</p>
          )}
        </div>
      )}
    </div>
  );
};

export default TaskDefinitionCard;
