import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useWamApi } from "@/hooks/useWamApi";
import { toast } from "sonner";

interface ProcessorInfo {
  version: string;
  model?: string;
  features?: string[];
  extractionPrompt?: string;
  responseSchema?: Record<string, unknown>;
  changelog?: Array<{ version: string; date: string; changes: string[] }>;
}

const VendorProcessorTab = () => {
  const wamApi = useWamApi();
  const [info, setInfo] = useState<ProcessorInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);

  useEffect(() => {
    loadInfo();
  }, []);

  const loadInfo = async () => {
    setLoading(true);
    try {
      const data = await wamApi.getVendorVersion();
      setInfo(data);
    } catch {
      setInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRerunAll = async () => {
    setRerunning(true);
    try {
      await wamApi.processAllQueue([], true);
      toast.success("Rerun started for all queue items");
    } catch {
      toast.error("Failed to start rerun");
    } finally {
      setRerunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!info) {
    return (
      <div className="text-center py-8 space-y-2">
        <p className="text-sm text-zinc-500">
          Could not connect to WAM API. Make sure the WAM password is set.
        </p>
        <Button size="sm" variant="outline" className="text-xs border-zinc-700 text-zinc-400" onClick={loadInfo}>
          <RefreshCw className="h-3 w-3 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="text-xs px-2 py-0.5 text-zinc-300 border-zinc-700">
            v{info.version}
          </Badge>
          {info.model && (
            <span className="text-xs text-zinc-500">Model: {info.model}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" className="h-7 text-xs text-zinc-500" onClick={loadInfo}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Refresh
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs border-zinc-700 text-zinc-400"
            onClick={handleRerunAll}
            disabled={rerunning}
          >
            {rerunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
            Rerun All Queue Items
          </Button>
        </div>
      </div>

      {/* Features */}
      {info.features && info.features.length > 0 && (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Features</span>
          <div className="flex flex-wrap gap-1.5">
            {info.features.map((f) => (
              <Badge key={f} variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-400 border-zinc-700">
                {f}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Extraction prompt */}
      {info.extractionPrompt && (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Extraction Prompt</span>
          <ScrollArea className="max-h-60 border border-zinc-800 rounded-lg">
            <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed p-3">
              {info.extractionPrompt}
            </pre>
          </ScrollArea>
        </div>
      )}

      {/* Response schema */}
      {info.responseSchema && (
        <div className="space-y-1">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Response Schema</span>
          <ScrollArea className="max-h-40 border border-zinc-800 rounded-lg">
            <pre className="text-[10px] text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed p-3">
              {JSON.stringify(info.responseSchema, null, 2)}
            </pre>
          </ScrollArea>
        </div>
      )}

      {/* Changelog */}
      {info.changelog && info.changelog.length > 0 && (
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Changelog</span>
          {info.changelog.map((entry) => (
            <div key={entry.version} className="border border-zinc-800 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-zinc-300">v{entry.version}</span>
                <span className="text-[10px] text-zinc-600">{entry.date}</span>
              </div>
              <ul className="space-y-0.5">
                {entry.changes.map((change, i) => (
                  <li key={i} className="text-[10px] text-zinc-500">• {change}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default VendorProcessorTab;
