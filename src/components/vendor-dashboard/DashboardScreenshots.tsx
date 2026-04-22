import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image, Loader2, Trash2, ArrowUp, ArrowDown, UploadCloud, AlertCircle, Check } from "lucide-react";
import { useVendorDataClient } from "@/hooks/useVendorDataClient";
import { useVendorScreenshots, type VendorScreenshot } from "@/hooks/useVendorScreenshots";
import { cn } from "@/lib/utils";
import { GatedCard } from "./GatedCard";

const MAX_SCREENSHOTS = 8;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface DashboardScreenshotsProps {
  vendorName: string;
}

export function DashboardScreenshots({ vendorName }: DashboardScreenshotsProps) {
  const supabase = useVendorDataClient();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: screenshots = [], isLoading } = useVendorScreenshots(vendorName);

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ["vendor-screenshots", vendorName] });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    // Validate
    const remaining = MAX_SCREENSHOTS - screenshots.length;
    if (files.length > remaining) {
      setError(`You can only add ${remaining} more screenshot${remaining === 1 ? "" : "s"} (max ${MAX_SCREENSHOTS}).`);
      e.target.value = "";
      return;
    }
    for (const file of files) {
      if (!ACCEPTED_TYPES.includes(file.type)) {
        setError("Only JPG, PNG, and WebP images are allowed.");
        e.target.value = "";
        return;
      }
      if (file.size > MAX_FILE_BYTES) {
        setError(`"${file.name}" exceeds the 5 MB limit.`);
        e.target.value = "";
        return;
      }
    }

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const ext = file.name.split(".").pop() ?? "jpg";
        const uid = crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
        const path = `${vendorName}/${uid}.${ext}`;

        const { error: uploadError } = await supabase.storage
          .from("vendor-screenshots")
          .upload(path, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from("vendor-screenshots")
          .getPublicUrl(path);

        const { error: insertError } = await supabase
          .from("vendor_screenshots" as never)
          .insert({
            vendor_name: vendorName,
            url: publicUrl,
            sort_order: screenshots.length + i,
          } as never);
        if (insertError) throw insertError;
      }
      await invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  async function handleDelete(shot: VendorScreenshot) {
    setError(null);
    setDeletingId(shot.id);
    try {
      // Extract storage path from URL: everything after /vendor-screenshots/
      const marker = "/vendor-screenshots/";
      const idx = shot.url.indexOf(marker);
      if (idx !== -1) {
        const storagePath = shot.url.slice(idx + marker.length);
        await supabase.storage.from("vendor-screenshots").remove([storagePath]);
      }

      const { error: deleteError } = await supabase
        .from("vendor_screenshots" as never)
        .delete()
        .eq("id", shot.id as never);
      if (deleteError) throw deleteError;

      await invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleMove(index: number, direction: "up" | "down") {
    setError(null);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= screenshots.length) return;

    const a = screenshots[index];
    const b = screenshots[swapIndex];

    try {
      await Promise.all([
        supabase
          .from("vendor_screenshots" as never)
          .update({ sort_order: b.sort_order } as never)
          .eq("id", a.id as never),
        supabase
          .from("vendor_screenshots" as never)
          .update({ sort_order: a.sort_order } as never)
          .eq("id", b.id as never),
      ]);
      await invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Reorder failed.");
    }
  }

  const [savingField, setSavingField] = useState<string | null>(null);

  async function handleUpdateField(
    shot: VendorScreenshot,
    field: "title" | "description",
    value: string,
  ) {
    const trimmed = value.trim() || null;
    if (trimmed === (shot[field] ?? null)) return;
    const key = `${shot.id}-${field}`;
    setSavingField(key);
    try {
      const { error: updateError } = await supabase
        .from("vendor_screenshots" as never)
        .update({ [field]: trimmed } as never)
        .eq("id", shot.id as never);
      if (updateError) throw updateError;
      await invalidate();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setSavingField(null);
    }
  }

  const canUpload = screenshots.length < MAX_SCREENSHOTS && !uploading;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Visual Gallery</h1>
        <p className="mt-1 text-sm text-slate-500">
          Show dealers what your product looks like. Screenshots appear on your public profile
          in the order listed below.
        </p>
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Upload area */}
      <GatedCard componentKey="screenshots.upload">
      <div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={handleFileChange}
          disabled={!canUpload}
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={!canUpload}
          className={cn(
            "w-full flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 text-sm transition-colors",
            canUpload
              ? "border-slate-200 text-slate-400 hover:border-primary/50 hover:text-primary cursor-pointer"
              : "border-slate-100 text-slate-300 cursor-not-allowed"
          )}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Uploading…</span>
            </>
          ) : (
            <>
              <UploadCloud className="h-6 w-6" />
              <span>
                {screenshots.length >= MAX_SCREENSHOTS
                  ? `Maximum of ${MAX_SCREENSHOTS} screenshots reached`
                  : "Click to upload screenshots (JPG, PNG, WebP · max 5 MB each)"}
              </span>
            </>
          )}
        </button>
        <p className="mt-2 text-xs text-slate-400 text-right">
          {screenshots.length} / {MAX_SCREENSHOTS} screenshots
        </p>
      </div>
      </GatedCard>

      {/* Screenshot list */}
      <GatedCard componentKey="screenshots.gallery">
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          <p className="text-sm text-slate-500">Loading screenshots...</p>
        </div>
      ) : screenshots.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 space-y-2">
          <p className="text-sm font-medium text-slate-500">No screenshots yet.</p>
          <p className="text-xs text-slate-400">Upload your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {screenshots.map((shot, index) => (
            <div
              key={shot.id}
              className="rounded-xl border border-slate-200 bg-white p-3"
            >
              <div className="flex items-center gap-3">
                {/* Thumbnail */}
                <div className="flex-none w-32 aspect-video rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                  <img
                    src={shot.url}
                    alt={`Screenshot ${index + 1}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Title + hint */}
                <div className="flex-1 min-w-0">
                  <input
                    type="text"
                    defaultValue={shot.title ?? ""}
                    placeholder="Screenshot title"
                    maxLength={80}
                    onBlur={(e) => handleUpdateField(shot, "title", e.target.value)}
                    className="w-full text-sm font-medium text-slate-700 placeholder:text-slate-300 bg-transparent border-b border-transparent hover:border-slate-200 focus:border-primary focus:outline-none pb-0.5 transition-colors"
                  />
                  <p className="text-xs text-slate-400 mt-1">
                    {savingField === `${shot.id}-title` ? (
                      <span className="inline-flex items-center gap-1 text-green-600">
                        <Check className="h-3 w-3" /> Saved
                      </span>
                    ) : (
                      <>Screenshot {index + 1} · shown on public profile</>
                    )}
                  </p>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleMove(index, "up")}
                    disabled={index === 0 || !!deletingId}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move up"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleMove(index, "down")}
                    disabled={index === screenshots.length - 1 || !!deletingId}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Move down"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(shot)}
                    disabled={!!deletingId}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Delete"
                  >
                    {deletingId === shot.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Description */}
              <div className="mt-2 pl-[calc(8rem+0.75rem)]">
                <textarea
                  defaultValue={shot.description ?? ""}
                  placeholder="Brief description (2-3 sentences)..."
                  maxLength={300}
                  rows={2}
                  onBlur={(e) => handleUpdateField(shot, "description", e.target.value)}
                  className="w-full text-sm text-slate-600 placeholder:text-slate-300 bg-transparent border border-transparent rounded-lg px-2 py-1 hover:border-slate-200 focus:border-primary focus:outline-none resize-none transition-colors"
                />
                {savingField === `${shot.id}-description` && (
                  <p className="text-xs text-green-600 inline-flex items-center gap-1 mt-0.5">
                    <Check className="h-3 w-3" /> Saved
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      </GatedCard>
    </div>
  );
}
