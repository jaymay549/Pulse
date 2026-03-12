import { useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useVendorScreenshots } from "@/hooks/useVendorScreenshots";

interface ProductScreenshotsProps {
  vendorName: string;
}

export function ProductScreenshots({ vendorName }: ProductScreenshotsProps) {
  const { data: screenshots = [] } = useVendorScreenshots(vendorName);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  if (screenshots.length === 0) return null;

  const prev = () =>
    setLightboxIndex((i) => (i === null ? null : (i - 1 + screenshots.length) % screenshots.length));
  const next = () =>
    setLightboxIndex((i) => (i === null ? null : (i + 1) % screenshots.length));

  return (
    <div className="mt-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
        Screenshots
      </p>

      {/* Horizontal scroll strip — App Store style */}
      <div
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {screenshots.map((shot, index) => (
          <button
            key={shot.id}
            onClick={() => setLightboxIndex(index)}
            className="flex-none snap-start w-[72vw] sm:w-[380px] md:w-[420px] aspect-video rounded-xl overflow-hidden border border-slate-200 hover:opacity-90 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <img
              src={shot.url}
              alt={`${vendorName} screenshot ${index + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </button>
        ))}
      </div>

      {/* Lightbox */}
      <Dialog open={lightboxIndex !== null} onOpenChange={() => setLightboxIndex(null)}>
        <DialogContent className="max-w-4xl w-full p-0 bg-black border-zinc-800 overflow-hidden">
          {lightboxIndex !== null && (
            <div className="relative">
              <img
                src={screenshots[lightboxIndex].url}
                alt={`${vendorName} screenshot ${lightboxIndex + 1}`}
                className="w-full aspect-video object-contain"
              />

              {/* Counter */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 text-[11px] text-white/60 bg-black/50 px-2 py-0.5 rounded-full">
                {lightboxIndex + 1} / {screenshots.length}
              </div>

              {/* Prev / Next */}
              {screenshots.length > 1 && (
                <>
                  <button
                    onClick={prev}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    aria-label="Previous screenshot"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    onClick={next}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                    aria-label="Next screenshot"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}

              {/* Close */}
              <button
                onClick={() => setLightboxIndex(null)}
                className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
