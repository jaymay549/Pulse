import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useVendorScreenshots } from "@/hooks/useVendorScreenshots";
import { cn } from "@/lib/utils";

interface ProductScreenshotsProps {
  vendorName: string;
}

export function ProductScreenshots({ vendorName }: ProductScreenshotsProps) {
  const { data: screenshots = [] } = useVendorScreenshots(vendorName);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Track which thumbnail is most visible via IntersectionObserver
  const observerRef = useRef<IntersectionObserver | null>(null);

  const setupObserver = useCallback(() => {
    const container = scrollRef.current;
    if (!container) return;

    observerRef.current?.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.6) {
            const idx = Number((entry.target as HTMLElement).dataset.index);
            if (!isNaN(idx)) setActiveIndex(idx);
          }
        }
      },
      { root: container, threshold: 0.6 },
    );

    container.querySelectorAll("[data-index]").forEach((el) => {
      observerRef.current!.observe(el);
    });

    return () => observerRef.current?.disconnect();
  }, []);

  useEffect(() => {
    const cleanup = setupObserver();
    return cleanup;
  }, [screenshots.length, setupObserver]);

  if (screenshots.length === 0) return null;

  const scrollTo = (index: number) => {
    const container = scrollRef.current;
    if (!container) return;
    const child = container.children[index] as HTMLElement | undefined;
    child?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "start" });
  };

  const prev = () =>
    setLightboxIndex((i) =>
      i === null ? null : (i - 1 + screenshots.length) % screenshots.length,
    );
  const next = () =>
    setLightboxIndex((i) =>
      i === null ? null : (i + 1) % screenshots.length,
    );

  const canScrollPrev = activeIndex > 0;
  const canScrollNext = activeIndex < screenshots.length - 1;

  return (
    <div className="mt-5">
      <p className="text-xs font-medium text-slate-400 uppercase tracking-wide mb-3">
        Screenshots
      </p>

      {/* Carousel wrapper */}
      <div className="relative group">
        {/* Left arrow */}
        {canScrollPrev && (
          <button
            onClick={() => scrollTo(activeIndex - 1)}
            className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white/90 shadow-md text-slate-600 hover:bg-white hover:text-slate-900 transition-all opacity-0 group-hover:opacity-100"
            aria-label="Previous screenshot"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
        )}

        {/* Right arrow */}
        {canScrollNext && (
          <button
            onClick={() => scrollTo(activeIndex + 1)}
            className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-1.5 rounded-full bg-white/90 shadow-md text-slate-600 hover:bg-white hover:text-slate-900 transition-all opacity-0 group-hover:opacity-100"
            aria-label="Next screenshot"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        )}

        {/* Horizontal scroll strip */}
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {screenshots.map((shot, index) => (
            <button
              key={shot.id}
              data-index={index}
              onClick={() => setLightboxIndex(index)}
              className="relative flex-none snap-start w-[72vw] sm:w-[380px] md:w-[420px] aspect-video rounded-xl overflow-hidden border border-slate-200 group/thumb focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <img
                src={shot.url}
                alt={shot.title || `${vendorName} screenshot ${index + 1}`}
                className="w-full h-full object-cover transition-transform duration-300 group-hover/thumb:scale-[1.02]"
                loading="lazy"
              />

              {/* Hover overlay with title + description */}
              {(shot.title || shot.description) && (
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/40 to-transparent px-4 pb-3 pt-10 opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-200">
                  {shot.title && (
                    <p className="text-sm font-semibold text-white leading-tight">
                      {shot.title}
                    </p>
                  )}
                  {shot.description && (
                    <p className="text-xs text-white/80 mt-1 line-clamp-2 leading-snug">
                      {shot.description}
                    </p>
                  )}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Dot indicators */}
      {screenshots.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-3">
          {screenshots.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              aria-label={`Go to screenshot ${index + 1}`}
              className={cn(
                "w-2 h-2 rounded-full transition-all duration-200",
                index === activeIndex
                  ? "bg-slate-700 scale-110"
                  : "bg-slate-300 hover:bg-slate-400",
              )}
            />
          ))}
        </div>
      )}

      {/* Lightbox */}
      <Dialog
        open={lightboxIndex !== null}
        onOpenChange={() => setLightboxIndex(null)}
      >
        <DialogContent className="max-w-4xl w-full p-0 bg-black border-zinc-800 overflow-hidden">
          {lightboxIndex !== null && (
            <div className="relative">
              <img
                src={screenshots[lightboxIndex].url}
                alt={
                  screenshots[lightboxIndex].title ||
                  `${vendorName} screenshot ${lightboxIndex + 1}`
                }
                className="w-full aspect-video object-contain"
              />

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

              {/* Caption bar — title, description, counter */}
              {(screenshots[lightboxIndex].title ||
                screenshots[lightboxIndex].description ||
                screenshots.length > 1) && (
                <div className="px-5 py-3 bg-zinc-900">
                  {screenshots[lightboxIndex].title && (
                    <p className="text-sm font-semibold text-white">
                      {screenshots[lightboxIndex].title}
                    </p>
                  )}
                  {screenshots[lightboxIndex].description && (
                    <p className="text-xs text-white/70 mt-1 leading-relaxed">
                      {screenshots[lightboxIndex].description}
                    </p>
                  )}
                  {screenshots.length > 1 && (
                    <p className="text-[11px] text-white/40 mt-2">
                      {lightboxIndex + 1} / {screenshots.length}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
