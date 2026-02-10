import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useSavePrompt } from "@/hooks/usePrompts";
import { toast } from "sonner";
import type { SummaryPrompt } from "@/types/admin";

interface PromptEditorProps {
  activePrompt: SummaryPrompt | null;
  timeframe: string;
}

const PromptEditor = ({ activePrompt, timeframe }: PromptEditorProps) => {
  const [text, setText] = useState(activePrompt?.prompt || "");
  const saveMutation = useSavePrompt();

  useEffect(() => {
    setText(activePrompt?.prompt || "");
  }, [activePrompt]);

  const isDirty = text !== (activePrompt?.prompt || "");

  const handleSave = async () => {
    try {
      const result = await saveMutation.mutateAsync({
        timeframe,
        prompt: text,
      });
      toast.success(`Saved as version ${result.version}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save prompt");
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-zinc-400">
            {activePrompt
              ? `Active: v${activePrompt.version}`
              : "No active prompt"}
          </span>
          {isDirty && (
            <span className="text-[10px] text-amber-500">Modified</span>
          )}
        </div>
        <span className="text-[10px] text-zinc-600">
          {text.length.toLocaleString()} chars
        </span>
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        className="bg-zinc-900 border-zinc-700 text-zinc-200 font-mono text-xs min-h-[240px] resize-y"
        placeholder="Enter the summary prompt..."
      />

      <div className="flex items-center gap-2 justify-end">
        {isDirty && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 text-xs text-zinc-500"
            onClick={() => setText(activePrompt?.prompt || "")}
          >
            Discard Changes
          </Button>
        )}
        <Button
          size="sm"
          className="h-7 text-xs"
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending || !text.trim()}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-3 w-3 animate-spin mr-1" />
          ) : null}
          Save as New Version
        </Button>
      </div>
    </div>
  );
};

export default PromptEditor;
