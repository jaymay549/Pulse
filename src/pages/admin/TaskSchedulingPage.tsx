import { useState, useEffect } from "react";
import { Loader2, Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import TaskDefinitionCard from "@/components/admin/tasks/TaskDefinitionCard";
import { useTaskDefinitions, useArchiveTask } from "@/hooks/useTasks";
import { useWamApi } from "@/hooks/useWamApi";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TaskSchedulingPage = () => {
  const [showArchived, setShowArchived] = useState(false);
  const { data: tasks, isLoading } = useTaskDefinitions(showArchived);
  const archiveTask = useArchiveTask();
  const wamApi = useWamApi();
  const queryClient = useQueryClient();

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ["task-definitions"] });
    }, 30000);
    return () => clearInterval(interval);
  }, [queryClient]);

  const handleArchive = async (id: number, currentlyArchived: boolean) => {
    try {
      await archiveTask.mutateAsync({ id, archived: !currentlyArchived });
      toast.success(currentlyArchived ? "Task unarchived" : "Task archived");
    } catch (err: any) {
      toast.error(err?.message || "Failed to update task");
    }
  };

  const handleTriggerGenerate = async (occurrenceId: number) => {
    try {
      await wamApi.triggerTaskGenerate(occurrenceId);
      toast.success("Generation triggered");
    } catch {
      toast.error("Failed to trigger generation");
    }
  };

  const handleTriggerSend = async (occurrenceId: number) => {
    try {
      await wamApi.triggerTaskSend(occurrenceId);
      toast.success("Send triggered");
    } catch {
      toast.error("Failed to trigger send");
    }
  };

  const handleRejectOccurrence = async (occurrenceId: number) => {
    try {
      await wamApi.rejectOccurrence(occurrenceId);
      queryClient.invalidateQueries({ queryKey: ["task-definitions"] });
      toast.success("Occurrence rejected");
    } catch {
      toast.error("Failed to reject occurrence");
    }
  };

  const handleSendOccurrence = async (occurrenceId: number) => {
    try {
      await wamApi.sendOccurrence(occurrenceId);
      queryClient.invalidateQueries({ queryKey: ["task-definitions"] });
      toast.success("Occurrence sent");
    } catch {
      toast.error("Failed to send occurrence");
    }
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Task Scheduling</h1>
          <p className="text-sm text-zinc-500 mt-1">
            Manage automated report generation and delivery tasks.
          </p>
        </div>
        <Link to="/admin/tasks/create">
          <Button size="sm" className="h-8 text-xs">
            <Plus className="h-3 w-3 mr-1" />
            New Task
          </Button>
        </Link>
      </div>

      {/* Toggle archived */}
      <div className="flex items-center gap-2">
        <Switch
          checked={showArchived}
          onCheckedChange={setShowArchived}
          className="scale-75"
        />
        <Label className="text-xs text-zinc-500">Show archived</Label>
        {tasks && (
          <span className="text-xs text-zinc-600 ml-2">
            {tasks.length} task{tasks.length !== 1 ? "s" : ""}
          </span>
        )}
      </div>

      {/* Task list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <p className="text-sm text-zinc-500 text-center py-8">No tasks found.</p>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <TaskDefinitionCard
              key={task.id}
              task={task}
              onArchive={() => handleArchive(task.id, task.is_archived)}
              onTriggerGenerate={handleTriggerGenerate}
              onTriggerSend={handleTriggerSend}
              onRejectOccurrence={handleRejectOccurrence}
              onSendOccurrence={handleSendOccurrence}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default TaskSchedulingPage;
