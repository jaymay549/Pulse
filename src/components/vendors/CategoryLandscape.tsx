import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building2 } from "lucide-react";

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

  // Track which logo images have errored so we can hide them
  const [logoErrors, setLogoErrors] = useState<Set<string>>(new Set());

  const sortedVendors = [...vendors].sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  const totalMentions = vendors.reduce((sum, v) => sum + v.count, 0);

  // Empty state
  if (vendors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <Building2 className="h-10 w-10 text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-500">
          No vendors found in this category yet.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-zinc-100">
          {categoryLabel}
        </h2>
        <p className="text-sm text-zinc-500 mt-1">
          {vendors.length} vendor{vendors.length !== 1 ? "s" : ""}
          {" \u00B7 "}
          {totalMentions.toLocaleString()} mention{totalMentions !== 1 ? "s" : ""}
        </p>
      </div>

      {/* Vendor grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {sortedVendors.map((vendor) => (
          <button
            key={vendor.name}
            onClick={() =>
              navigate(`/vendors/${encodeURIComponent(vendor.name)}`)
            }
            className="flex items-center gap-3 border border-zinc-800 bg-zinc-900/50 rounded-xl p-4 text-left transition-colors hover:border-zinc-600 group"
          >
            {/* Vendor logo */}
            {!logoErrors.has(vendor.name) && (
              <img
                src={getLogoUrl(vendor.name)}
                alt={vendor.name}
                className="h-8 w-8 rounded-md bg-white p-0.5 object-contain shrink-0"
                onError={() =>
                  setLogoErrors((prev) => new Set(prev).add(vendor.name))
                }
              />
            )}

            {/* Vendor info */}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-zinc-200 truncate">
                {vendor.name}
              </p>
              <p className="text-xs text-zinc-500">
                {vendor.count} mention{vendor.count !== 1 ? "s" : ""}
              </p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
