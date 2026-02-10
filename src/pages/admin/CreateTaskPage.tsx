import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useCreateTask } from "@/hooks/useTasks";
import { useAdminGroups } from "@/hooks/useAdminGroups";
import { useActivePrompt } from "@/hooks/usePrompts";
import { toast } from "sonner";
import type { PromptTimeframe } from "@/types/admin";

const TIMEFRAMES = [
  { value: "last1day", label: "Last 1 Day" },
  { value: "last7days", label: "Last 7 Days" },
  { value: "all", label: "All Time" },
  { value: "custom", label: "Custom" },
];

const REPEAT_TYPES = [
  { value: "none", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "weekdays", label: "Weekdays (Mon–Fri)" },
  { value: "monthly", label: "Monthly" },
];

const PDF_MODES = [
  { value: "individual", label: "Individual (one PDF per group)" },
  { value: "combined", label: "Combined (single PDF)" },
];

const CreateTaskPage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const createTask = useCreateTask();
  const { data: groups } = useAdminGroups();

  const [name, setName] = useState("");
  const [timeframe, setTimeframe] = useState<PromptTimeframe>("last7days");
  const [repeatType, setRepeatType] = useState("none");
  const [pdfMode, setPdfMode] = useState("individual");
  const [pdfFilenameTemplate, setPdfFilenameTemplate] = useState("");
  const [prompt, setPrompt] = useState("");
  const [selectedGroupIds, setSelectedGroupIds] = useState<Set<number>>(new Set());
  const [recipientGroupIds, setRecipientGroupIds] = useState<Set<number>>(new Set());
  const [notifyAdmin, setNotifyAdmin] = useState(false);
  const [adminPhone, setAdminPhone] = useState("");

  // Pre-populate from copy state
  useEffect(() => {
    const copyFrom = (location.state as any)?.copyFrom;
    if (!copyFrom) return;
    setName(copyFrom.name ? `${copyFrom.name} (Copy)` : "");
    setTimeframe(copyFrom.timeframe || "last7days");
    setRepeatType(copyFrom.repeat_type || "none");
    setPdfMode(copyFrom.pdf_mode || "individual");
    setPdfFilenameTemplate(copyFrom.pdf_filename_template || "");
    setPrompt(copyFrom.prompt || "");
    setNotifyAdmin(copyFrom.notify_admin || false);
    setAdminPhone(copyFrom.admin_phone || "");
    if (copyFrom.group_ids) setSelectedGroupIds(new Set(copyFrom.group_ids));
    if (copyFrom.recipient_group_ids) setRecipientGroupIds(new Set(copyFrom.recipient_group_ids));
  }, [location.state]);

  // Load default prompt for selected timeframe
  const { data: activePrompt } = useActivePrompt(timeframe);
  const loadDefaultPrompt = () => {
    if (activePrompt) setPrompt(activePrompt.prompt);
  };

  const toggleGroup = (id: number, set: Set<number>, setter: (s: Set<number>) => void) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setter(next);
  };

  const handleCreate = async () => {
    if (!name.trim() || !prompt.trim() || selectedGroupIds.size === 0) {
      toast.error("Please fill in name, prompt, and select at least one group");
      return;
    }

    const selectedGroups = groups?.filter((g) => selectedGroupIds.has(g.id)) || [];
    const recipientGroups = groups?.filter((g) => recipientGroupIds.has(g.id)) || [];

    try {
      await createTask.mutateAsync({
        name: name.trim(),
        group_ids: Array.from(selectedGroupIds),
        group_names: selectedGroups.map((g) => g.name),
        recipient_group_ids: recipientGroupIds.size > 0 ? Array.from(recipientGroupIds) : null,
        recipient_group_names: recipientGroups.length > 0 ? recipientGroups.map((g) => g.name) : null,
        prompt,
        timeframe,
        custom_start_date: null,
        custom_end_date: null,
        pdf_mode: pdfMode,
        admin_phone: adminPhone || null,
        notify_admin: notifyAdmin,
        repeat_type: repeatType === "none" ? null : repeatType,
        pdf_filename_template: pdfFilenameTemplate || null,
        is_archived: false,
      });
      toast.success("Task created");
      navigate("/admin/tasks");
    } catch (err: any) {
      toast.error(err?.message || "Failed to create task");
    }
  };

  // Filename template preview
  const filenamePreview = pdfFilenameTemplate
    ? pdfFilenameTemplate
        .replace("{date}", new Date().toISOString().slice(0, 10))
        .replace("{group}", "GroupName")
        .replace("{timeframe}", timeframe)
    : null;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="ghost"
          className="h-7 px-2 text-zinc-500"
          onClick={() => navigate("/admin/tasks")}
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold text-zinc-100">Create Task</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Configure a new scheduled report generation task.
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {/* Name */}
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">Task Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekly Summary Report"
            className="bg-zinc-900 border-zinc-700 text-zinc-100"
          />
        </div>

        {/* Schedule */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Timeframe</Label>
            <Select value={timeframe} onValueChange={(v) => setTimeframe(v as PromptTimeframe)}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {TIMEFRAMES.map((tf) => (
                  <SelectItem key={tf.value} value={tf.value} className="text-zinc-300">
                    {tf.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">Repeat</Label>
            <Select value={repeatType} onValueChange={setRepeatType}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {REPEAT_TYPES.map((rt) => (
                  <SelectItem key={rt.value} value={rt.value} className="text-zinc-300">
                    {rt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* PDF mode + filename template */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">PDF Mode</Label>
            <Select value={pdfMode} onValueChange={setPdfMode}>
              <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-300">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-zinc-900 border-zinc-700">
                {PDF_MODES.map((pm) => (
                  <SelectItem key={pm.value} value={pm.value} className="text-zinc-300">
                    {pm.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-zinc-400">PDF Filename Template</Label>
            <Input
              value={pdfFilenameTemplate}
              onChange={(e) => setPdfFilenameTemplate(e.target.value)}
              placeholder="{group}-{date}-report"
              className="bg-zinc-900 border-zinc-700 text-zinc-100 text-xs"
            />
            {filenamePreview && (
              <p className="text-[10px] text-zinc-600">
                Preview: {filenamePreview}.pdf
              </p>
            )}
          </div>
        </div>

        {/* Source groups */}
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">
            Source Groups ({selectedGroupIds.size} selected)
          </Label>
          <ScrollArea className="max-h-40 border border-zinc-800 rounded-lg">
            <div className="p-2 space-y-1">
              {groups?.map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-900/60 cursor-pointer"
                >
                  <Checkbox
                    checked={selectedGroupIds.has(g.id)}
                    onCheckedChange={() => toggleGroup(g.id, selectedGroupIds, setSelectedGroupIds)}
                    className="border-zinc-700"
                  />
                  <span className="text-xs text-zinc-300 truncate">{g.name}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Prompt */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-zinc-400">Prompt</Label>
            <Button
              size="sm"
              variant="ghost"
              className="h-6 text-[10px] text-zinc-500"
              onClick={loadDefaultPrompt}
              disabled={!activePrompt}
            >
              Load Default ({timeframe})
            </Button>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            className="bg-zinc-900 border-zinc-700 text-zinc-200 font-mono text-xs min-h-[160px] resize-y"
            placeholder="Enter the summary prompt..."
          />
        </div>

        {/* Recipient groups */}
        <div className="space-y-1.5">
          <Label className="text-xs text-zinc-400">
            Recipient Groups (optional, {recipientGroupIds.size} selected)
          </Label>
          <ScrollArea className="max-h-32 border border-zinc-800 rounded-lg">
            <div className="p-2 space-y-1">
              {groups?.map((g) => (
                <label
                  key={g.id}
                  className="flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-900/60 cursor-pointer"
                >
                  <Checkbox
                    checked={recipientGroupIds.has(g.id)}
                    onCheckedChange={() => toggleGroup(g.id, recipientGroupIds, setRecipientGroupIds)}
                    className="border-zinc-700"
                  />
                  <span className="text-xs text-zinc-300 truncate">{g.name}</span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>

        {/* Notifications */}
        <div className="flex items-center gap-3">
          <Switch checked={notifyAdmin} onCheckedChange={setNotifyAdmin} className="scale-75" />
          <Label className="text-xs text-zinc-400">Notify admin</Label>
          {notifyAdmin && (
            <Input
              value={adminPhone}
              onChange={(e) => setAdminPhone(e.target.value)}
              placeholder="Admin phone"
              className="h-7 text-xs bg-zinc-900 border-zinc-700 text-zinc-300 w-40"
            />
          )}
        </div>

        {/* Submit */}
        <div className="flex items-center gap-3 pt-2">
          <Button
            onClick={handleCreate}
            disabled={createTask.isPending || !name.trim() || !prompt.trim() || selectedGroupIds.size === 0}
          >
            {createTask.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1" />
            ) : null}
            Create Task
          </Button>
          <Button variant="ghost" className="text-zinc-500" onClick={() => navigate("/admin/tasks")}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
};

export default CreateTaskPage;
