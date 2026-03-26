import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2, ArrowRight } from "lucide-react";

interface Vendor {
  name: string;
  count: number;
}

interface CategoryLandscapeProps {
  categoryId: string;
  categoryLabel: string;
  vendors: Vendor[];
  getLogoUrl: (vendorName: string) => string;
}

export function CategoryLandscape({
  categoryId,
  categoryLabel,
  vendors,
  getLogoUrl,
}: CategoryLandscapeProps) {
  const navigate = useNavigate();
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());

  const sortedVendors = [...vendors].sort((a, b) => b.count - a.count);
  const totalMentions = vendors.reduce((sum, v) => sum + v.count, 0);

  if (vendors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-10 w-10 text-muted-foreground/40 mb-3" />
        <p className="text-sm text-muted-foreground">
          No vendors found in this category yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-bold text-foreground">
          {categoryLabel}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
          {" · "}
          {totalMentions.toLocaleString()} discussion{totalMentions !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Vendor grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedVendors.map((vendor) => {
          const showLogo = !logoErrors.has(vendor.name);
          const initials = vendor.name.slice(0, 2).toUpperCase();

          return (
            <button
              key={vendor.name}
              onClick={() => navigate(`/vendors/${encodeURIComponent(vendor.name)}`)}
              className="group flex flex-col gap-3 bg-white border border-border rounded-xl p-4 text-left hover:border-primary/40 hover:shadow-md transition-all"
            >
              {/* Logo / fallback */}
              {showLogo ? (
                <img
                  src={getLogoUrl(vendor.name)}
                  alt={vendor.name}
                  className="h-10 w-10 rounded-lg border border-border/50 object-contain bg-white p-0.5 shrink-0"
                  onError={() =>
                    setLogoErrors((prev) => new Set(prev).add(vendor.name))
                  }
                />
              ) : (
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-bold text-primary">{initials}</span>
                </div>
              )}

              {/* Vendor name + mention count */}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors truncate">
                  {vendor.name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {vendor.count} discussion{vendor.count !== 1 ? "s" : ""}
                </p>
              </div>

              {/* Arrow on hover */}
              <ArrowRight className="h-3.5 w-3.5 text-primary opacity-0 group-hover:opacity-100 transition-opacity self-end" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
