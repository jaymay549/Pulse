import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Image, Loader2, Trash2, ArrowUp, ArrowDown, UploadCloud, AlertCircle } from "lucide-react";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";
import { useVendorScreenshots, type VendorScreenshot } from "@/hooks/useVendorScreenshots";
import { cn } from "@/lib/utils";

const MAX_SCREENSHOTS = 8;
const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

interface DashboardScreenshotsProps {
  vendorName: string;
}

export function DashboardScreenshots({ vendorName }: DashboardScreenshotsProps) {
  const supabase = useClerkSupabase();
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
        const path = `${vendorName}/${crypto.randomUUID()}.${ext}`;

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

  const canUpload = screenshots.length < MAX_SCREENSHOTS && !uploading;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <Image className="h-5 w-5 text-slate-400" />
          Product Screenshots
        </h2>
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

      {/* Screenshot list */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : screenshots.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-4">
          No screenshots yet. Upload your first one above.
        </p>
      ) : (
        <div className="space-y-3">
          {screenshots.map((shot, index) => (
            <div
              key={shot.id}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-2"
            >
              {/* Thumbnail */}
              <div className="flex-none w-32 aspect-video rounded-lg overflow-hidden border border-slate-100 bg-slate-50">
                <img
                  src={shot.url}
                  alt={`Screenshot ${index + 1}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>

              {/* Label */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700 truncate">
                  Screenshot {index + 1}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">16:9 · shown on public profile</p>
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
          ))}
        </div>
      )}
    </div>
  );
}
