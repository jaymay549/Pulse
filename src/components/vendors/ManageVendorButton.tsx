import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface ManageVendorButtonProps {
  vendorNames: string[];
  currentVendorName?: string | null;
  onSelectVendor: (vendorName: string) => void;
  getLogoUrl: (vendorName: string) => string | null;
  className?: string;
  showManagingLabel?: boolean;
}

export default function ManageVendorButton({
  vendorNames,
  currentVendorName,
  onSelectVendor,
  getLogoUrl,
  className,
  showManagingLabel = true,
}: ManageVendorButtonProps) {
  const [open, setOpen] = useState(false);
  const hasMultiple = vendorNames.length > 1;

  const currentVendor = useMemo(() => {
    if (!vendorNames.length) return null;
    if (currentVendorName && vendorNames.some((name) => name.toLowerCase() === currentVendorName.toLowerCase())) {
      return vendorNames.find((name) => name.toLowerCase() === currentVendorName.toLowerCase()) || vendorNames[0];
    }
    return vendorNames[0];
  }, [vendorNames, currentVendorName]);

  if (!currentVendor) return null;

  const currentLogo = getLogoUrl(currentVendor);

  const chipContent = (
    <>
      {showManagingLabel ? (
        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
          Managing
        </span>
      ) : (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-primary">
          <ArrowUpRight className="h-3 w-3" />
        </span>
      )}
      <Avatar className="h-5 w-5 border border-border/50">
        <AvatarImage src={currentLogo || undefined} alt={currentVendor} />
        <AvatarFallback className="text-[10px] font-semibold">
          {currentVendor.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="max-w-[140px] truncate text-sm font-medium">{currentVendor}</span>
    </>
  );

  const openCurrentVendor = () => onSelectVendor(currentVendor);

  if (!hasMultiple) {
    return (
      <button
        type="button"
        onClick={openCurrentVendor}
        className={cn(
          "inline-flex h-9 items-center gap-2 rounded-full border border-border/70 bg-white/95 px-2.5 shadow-sm transition-colors hover:bg-muted/40",
          className,
        )}
        aria-label={`Open ${currentVendor}`}
      >
        {chipContent}
      </button>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex h-9 items-center rounded-full border border-border/70 bg-white/95 shadow-sm",
        className,
      )}
    >
      <button
        type="button"
        onClick={openCurrentVendor}
        className="inline-flex h-full items-center gap-2 rounded-l-full px-2.5 transition-colors hover:bg-muted/40"
        aria-label={`Open ${currentVendor}`}
      >
        {chipContent}
      </button>

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Switch managed vendor"
            className="inline-flex h-full items-center justify-center rounded-r-full border-l border-border/60 px-2 transition-colors hover:bg-muted/40"
          >
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-72 p-2">
          <p className="px-2 py-1 text-xs font-semibold text-muted-foreground">
            Switch managed vendor
          </p>
          <div className="mt-1 space-y-1">
            {vendorNames.map((name) => {
              const logoUrl = getLogoUrl(name);
              const isCurrent = name.toLowerCase() === currentVendor.toLowerCase();
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    onSelectVendor(name);
                  }}
                  className={cn(
                    "w-full rounded-md px-2 py-2 text-left transition-colors",
                    "hover:bg-muted/60",
                    isCurrent && "bg-muted",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="h-6 w-6 border border-border/50">
                      <AvatarImage src={logoUrl || undefined} alt={name} />
                      <AvatarFallback className="text-[10px] font-semibold">
                        {name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate text-sm font-medium">{name}</span>
                    {isCurrent && (
                      <span className="text-[10px] font-semibold text-muted-foreground">Current</span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
