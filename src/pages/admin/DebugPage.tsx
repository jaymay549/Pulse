import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Play, FileText, Send as SendIcon, FolderOpen } from "lucide-react";
import { useWamApi } from "@/hooks/useWamApi";

// ── Gemini Debug Tab ──
const GeminiDebugTab = () => {
  const wam = useWamApi();
  const [requestType, setRequestType] = useState<"summary" | "chat">("chat");
  const [groupIds, setGroupIds] = useState("1,2");
  const [userMessage, setUserMessage] = useState("Summarize the latest discussions");
  const [customPrompt, setCustomPrompt] = useState("");
  const [errorSimulation, setErrorSimulation] = useState("none");
  const [response, setResponse] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ERROR_TYPES = [
    "none", "missing_api_key", "invalid_api_key", "rate_limit", "bad_request",
    "content_policy", "invalid_model", "internal_error", "service_unavailable",
    "gateway_timeout", "empty_response", "malformed_response", "streaming_error",
    "connection_timeout", "network_failure",
  ];

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResponse(null);
    try {
      const ids = groupIds.split(",").map((s) => parseInt(s.trim())).filter(Boolean);
      const result = await wam.testGeminiRequest({
        type: requestType,
        groupIds: ids,
        userMessage,
        customPrompt: customPrompt || undefined,
        mockGeminiError: errorSimulation !== "none" ? errorSimulation : undefined,
      });
      setResponse(JSON.stringify(result, null, 2));
    } catch (e: any) {
      setError(JSON.stringify(e, null, 2));
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-zinc-400 mb-1 block">Request Type</label>
          <Select value={requestType} onValueChange={(v) => setRequestType(v as "summary" | "chat")}>
            <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-300 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700">
              <SelectItem value="summary" className="text-zinc-300">Summary</SelectItem>
              <SelectItem value="chat" className="text-zinc-300">Chat</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-400 mb-1 block">Group IDs (comma-separated)</label>
          <Input value={groupIds} onChange={(e) => setGroupIds(e.target.value)} className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-400 mb-1 block">User Message</label>
          <Textarea value={userMessage} onChange={(e) => setUserMessage(e.target.value)} rows={3} className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-400 mb-1 block">Custom Prompt (optional)</label>
          <Textarea value={customPrompt} onChange={(e) => setCustomPrompt(e.target.value)} rows={3} className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-400 mb-1 block">Error Simulation</label>
          <Select value={errorSimulation} onValueChange={setErrorSimulation}>
            <SelectTrigger className="bg-zinc-900 border-zinc-700 text-zinc-300 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-zinc-900 border-zinc-700 max-h-60">
              {ERROR_TYPES.map((t) => (
                <SelectItem key={t} value={t} className="text-zinc-300 text-xs">{t}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleTest} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          Test
        </Button>
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-4 min-h-[300px]">
        <h3 className="text-xs font-medium text-zinc-400 mb-2">Response</h3>
        {error ? (
          <pre className="text-xs text-red-400 whitespace-pre-wrap overflow-auto max-h-[500px]">{error}</pre>
        ) : response ? (
          <pre className="text-xs text-zinc-300 whitespace-pre-wrap overflow-auto max-h-[500px]">{response}</pre>
        ) : (
          <div className="text-zinc-600 text-sm text-center py-12">Run a test to see results</div>
        )}
      </div>
    </div>
  );
};

// ── PDF Debug Tab ──
const PdfDebugTab = () => {
  const wam = useWamApi();
  const [title, setTitle] = useState("Test PDF");
  const [markdown, setMarkdown] = useState("# Test Report\n\nThis is a test PDF generation.\n\n## Section 1\n\nSome content here.");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [htmlPreview, setHtmlPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await wam.generatePdf({
        summaryContent: markdown,
        groupIds: [],
        title,
      });
      const blob = await wam.downloadPdf(result.id);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (e: any) {
      setError(e?.error?.error || e?.message || "Failed to generate PDF");
    }
    setLoading(false);
  };

  const handlePreview = async () => {
    try {
      const result = await wam.previewPdfHtml({ summaryContent: markdown, title });
      setHtmlPreview(result.html);
    } catch {}
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="space-y-4">
        <div>
          <label className="text-xs font-medium text-zinc-400 mb-1 block">Title</label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm" />
        </div>
        <div>
          <label className="text-xs font-medium text-zinc-400 mb-1 block">Markdown Content</label>
          <Textarea value={markdown} onChange={(e) => setMarkdown(e.target.value)} rows={15} className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm font-mono" />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={loading} className="flex-1 bg-blue-600 hover:bg-blue-700">
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <FileText className="h-4 w-4 mr-2" />}
            Generate PDF
          </Button>
          <Button onClick={handlePreview} variant="outline" className="border-zinc-700 text-zinc-300">
            Preview HTML
          </Button>
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden min-h-[400px]">
        {pdfUrl ? (
          <iframe src={pdfUrl} className="w-full h-[500px] border-0" title="PDF Preview" />
        ) : htmlPreview ? (
          <iframe srcDoc={htmlPreview} className="w-full h-[500px] border-0" title="HTML Preview" />
        ) : (
          <div className="text-zinc-600 text-sm text-center py-24">Generate a PDF or preview HTML</div>
        )}
      </div>
    </div>
  );
};

// ── WhatsApp Debug Tab ──
const WhatsAppDebugTab = () => {
  const wam = useWamApi();
  const [methods, setMethods] = useState<string[]>([]);
  const [selectedMethod, setSelectedMethod] = useState("");
  const [args, setArgs] = useState("[]");
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [methodSearch, setMethodSearch] = useState("");

  const loadMethods = async () => {
    try {
      const res = await wam.getWhatsAppMethods();
      setMethods(res.methods || []);
    } catch {}
  };

  const handleCall = async () => {
    setLoading(true);
    try {
      const parsedArgs = JSON.parse(args);
      const result = await wam.callWhatsAppMethod(selectedMethod, parsedArgs);
      setHistory((prev) => [
        { methodName: selectedMethod, args: parsedArgs, result, success: true, timestamp: new Date().toISOString() },
        ...prev,
      ]);
    } catch (e: any) {
      setHistory((prev) => [
        { methodName: selectedMethod, args, error: e?.message || "Failed", success: false, timestamp: new Date().toISOString() },
        ...prev,
      ]);
    }
    setLoading(false);
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-zinc-400">Methods</h3>
          <Button variant="outline" size="sm" onClick={loadMethods} className="text-xs h-7 border-zinc-700 text-zinc-300">
            Load
          </Button>
        </div>
        <Input placeholder="Search..." value={methodSearch} onChange={(e) => setMethodSearch(e.target.value)} className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm" />
        <div className="space-y-0.5 max-h-[400px] overflow-y-auto">
          {methods
            .filter((m) => m.toLowerCase().includes(methodSearch.toLowerCase()))
            .map((m) => (
              <button
                key={m}
                onClick={() => setSelectedMethod(m)}
                className={`w-full text-left px-2 py-1.5 rounded text-xs ${
                  selectedMethod === m ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-900"
                }`}
              >
                {m}
              </button>
            ))}
        </div>
      </div>
      <div className="space-y-3">
        <h3 className="text-xs font-medium text-zinc-400">Arguments</h3>
        <div className="text-xs text-zinc-300 font-mono bg-zinc-900 px-2 py-1 rounded">{selectedMethod || "Select a method"}</div>
        <Textarea value={args} onChange={(e) => setArgs(e.target.value)} rows={6} placeholder="[arg1, arg2]" className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm font-mono" />
        <Button onClick={handleCall} disabled={loading || !selectedMethod} className="w-full bg-blue-600 hover:bg-blue-700">
          {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
          Call
        </Button>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-zinc-400">History</h3>
          <Button variant="ghost" size="sm" onClick={() => setHistory([])} className="text-xs h-7 text-zinc-500">
            Clear
          </Button>
        </div>
        <div className="space-y-2 max-h-[450px] overflow-y-auto">
          {history.map((h, i) => (
            <div key={i} className={`bg-zinc-900 border rounded p-2 text-xs ${h.success ? "border-zinc-800" : "border-red-900"}`}>
              <div className="font-medium text-zinc-300">{h.methodName}</div>
              <pre className="text-zinc-500 mt-1 max-h-24 overflow-auto whitespace-pre-wrap">
                {h.success ? JSON.stringify(h.result, null, 2) : h.error}
              </pre>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ── File Browser Tab ──
const FileBrowserTab = () => {
  const wam = useWamApi();
  const [path, setPath] = useState("/");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDirectory = async (dirPath: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await wam.call(`/api/filebrowser/list?path=${encodeURIComponent(dirPath)}&skipSizes=true`);
      setPath(res.currentPath || dirPath);
      setItems(res.items || []);
    } catch (e: any) {
      setError(e?.error?.error || "Failed to load directory");
    }
    setLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input value={path} onChange={(e) => setPath(e.target.value)} className="bg-zinc-900 border-zinc-700 text-zinc-200 text-sm font-mono" />
        <Button onClick={() => loadDirectory(path)} className="bg-blue-600 hover:bg-blue-700">
          <FolderOpen className="h-4 w-4 mr-2" />
          Browse
        </Button>
      </div>
      {error && <div className="text-xs text-red-400">{error}</div>}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
        </div>
      ) : (
        <div className="border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-zinc-900">
              <tr className="text-zinc-400 text-xs">
                <th className="p-2 text-left">Name</th>
                <th className="p-2 text-right">Size</th>
                <th className="p-2 text-right">Modified</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800">
              {items.map((item: any, i: number) => (
                <tr key={i} className="hover:bg-zinc-900/50">
                  <td className="p-2">
                    {item.type === "directory" ? (
                      <button
                        onClick={() => loadDirectory(item.path)}
                        className="text-blue-400 hover:text-blue-300"
                      >
                        {item.name}/
                      </button>
                    ) : (
                      <span className="text-zinc-300">{item.name}</span>
                    )}
                  </td>
                  <td className="p-2 text-right text-zinc-500 text-xs">
                    {item.size != null ? `${(item.size / 1024).toFixed(1)}KB` : "—"}
                  </td>
                  <td className="p-2 text-right text-zinc-500 text-xs">
                    {item.modified ? new Date(item.modified).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
              {items.length === 0 && !loading && (
                <tr>
                  <td colSpan={3} className="p-8 text-center text-zinc-500">
                    {error ? "Error loading" : "Click Browse to load directory"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Main Debug Page ──
const DebugPage = () => {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-bold text-zinc-100">Debug Tools</h1>
      <Tabs defaultValue="gemini">
        <TabsList className="bg-zinc-800">
          <TabsTrigger value="gemini" className="text-xs">Gemini</TabsTrigger>
          <TabsTrigger value="pdf" className="text-xs">PDF</TabsTrigger>
          <TabsTrigger value="whatsapp" className="text-xs">WhatsApp</TabsTrigger>
          <TabsTrigger value="filebrowser" className="text-xs">File Browser</TabsTrigger>
        </TabsList>
        <TabsContent value="gemini" className="mt-4">
          <GeminiDebugTab />
        </TabsContent>
        <TabsContent value="pdf" className="mt-4">
          <PdfDebugTab />
        </TabsContent>
        <TabsContent value="whatsapp" className="mt-4">
          <WhatsAppDebugTab />
        </TabsContent>
        <TabsContent value="filebrowser" className="mt-4">
          <FileBrowserTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DebugPage;
