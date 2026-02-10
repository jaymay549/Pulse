import { useState, useEffect } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useWamApi } from "@/hooks/useWamApi";
import { toast } from "sonner";

interface VersionInfo {
  version: string;
  model?: string;
  features?: string[];
  lastUpdated?: string;
}

const VersionInfoPanel = () => {
  const wamApi = useWamApi();
  const [versionInfo, setVersionInfo] = useState<VersionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState(false);
  const [includeCurrentVersion, setIncludeCurrentVersion] = useState(false);

  useEffect(() => {
    loadVersion();
  }, []);

  const loadVersion = async () => {
    setLoading(true);
    try {
      const data = await wamApi.getVendorVersion();
      setVersionInfo(data);
    } catch {
      setVersionInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleRerunAll = async () => {
    setRerunning(true);
    try {
      await wamApi.rerunAll(includeCurrentVersion);
      toast.success(
        includeCurrentVersion
          ? "Rerun started for ALL queue items (including current version)"
          : "Rerun started for items with older processor versions"
      );
    } catch {
      toast.error("Failed to start rerun");
    } finally {
      setRerunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-zinc-500">
        <Loader2 className="h-3 w-3 animate-spin" />
        Loading version info...
      </div>
    );
  }

  if (!versionInfo) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-600">Version info unavailable</span>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-zinc-500"
          onClick={loadVersion}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Badge variant="outline" className="text-[10px] px-1.5 py-0 text-zinc-400 border-zinc-700">
        Processor v{versionInfo.version}
      </Badge>
      {versionInfo.model && (
        <span className="text-[10px] text-zinc-500">Model: {versionInfo.model}</span>
      )}
      <div className="flex items-center gap-2 ml-auto">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <Checkbox
            checked={includeCurrentVersion}
            onCheckedChange={(v) => setIncludeCurrentVersion(!!v)}
            className="border-zinc-700 h-3.5 w-3.5"
          />
          <span className="text-[10px] text-zinc-500">Include current version</span>
        </label>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 px-2 text-xs text-zinc-500"
          onClick={loadVersion}
        >
          <RefreshCw className="h-3 w-3" />
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 text-xs border-zinc-700 text-zinc-400"
          onClick={handleRerunAll}
          disabled={rerunning}
        >
          {rerunning ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
          Rerun All
        </Button>
      </div>
    </div>
  );
};

export default VersionInfoPanel;
