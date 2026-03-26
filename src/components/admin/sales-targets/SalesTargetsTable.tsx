import { useState, useMemo } from "react";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import type {
  SalesOpportunityRow,
  SalesOpportunitySignal,
  SalesSynopsis,
  SortField,
  SortDirection,
} from "@/types/sales-targets";
import { SalesTargetsRow } from "./SalesTargetsRow";

interface SalesTargetsTableProps {
  rows: SalesOpportunityRow[];
  synopsisCache: Record<string, SalesSynopsis>;
  synopsisLoading: Record<string, boolean>;
  synopsisErrors: Record<string, string>;
  onGenerateSynopsis: (signal: SalesOpportunitySignal) => void;
  onRetrySynopsis: (signal: SalesOpportunitySignal) => void;
}

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "vendor_name", label: "Vendor" },
  { key: "category", label: "Category" },
  { key: "mentions_30d", label: "30d" },
  { key: "total_mentions", label: "Total" },
  { key: "negative_pct", label: "Neg %" },
  { key: "nps_score", label: "NPS" },
  { key: "health_score", label: "Health" },
  { key: "trend_direction", label: "Trend" },
  { key: "feature_gap_count", label: "Gaps" },
  { key: "known_dealers", label: "Dealers" },
  { key: "has_profile", label: "Profile" },
  { key: "pain_score", label: "Pain" },
  { key: "buzz_score", label: "Buzz" },
  { key: "gap_score", label: "Gap" },
];

function compareValues(a: any, b: any, dir: SortDirection): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;

  if (typeof a === "boolean") {
    const diff = (b === true ? 1 : 0) - (a === true ? 1 : 0);
    return dir === "asc" ? -diff : diff;
  }

  if (typeof a === "string") {
    const cmp = a.localeCompare(b);
    return dir === "asc" ? cmp : -cmp;
  }

  const diff = (a as number) - (b as number);
  return dir === "asc" ? diff : -diff;
}

export function SalesTargetsTable({
  rows,
  synopsisCache,
  synopsisLoading,
  synopsisErrors,
  onGenerateSynopsis,
  onRetrySynopsis,
}: SalesTargetsTableProps) {
  const [sortField, setSortField] = useState<SortField>("mentions_30d");
  const [sortDir, setSortDir] = useState<SortDirection>("desc");

  const sorted = useMemo(() => {
    return [...rows].sort((a, b) =>
      compareValues(
        a[sortField as keyof SalesOpportunityRow],
        b[sortField as keyof SalesOpportunityRow],
        sortDir
      )
    );
  }, [rows, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field)
      return <ArrowUpDown className="h-3 w-3 text-zinc-600" />;
    return sortDir === "asc" ? (
      <ArrowUp className="h-3 w-3 text-zinc-300" />
    ) : (
      <ArrowDown className="h-3 w-3 text-zinc-300" />
    );
  };

  if (rows.length === 0) {
    return (
      <div className="text-center py-12 text-zinc-500">
        No vendors match the current filters.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-800">
            {COLUMNS.map((col) => (
              <th
                key={col.key}
                className="py-2 px-4 text-left text-xs font-medium text-zinc-500 uppercase tracking-wider cursor-pointer hover:text-zinc-300 transition-colors select-none"
                onClick={() => handleSort(col.key)}
              >
                <div className="flex items-center gap-1">
                  {col.label}
                  <SortIcon field={col.key} />
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <SalesTargetsRow
              key={row.vendor_name}
              row={row}
              synopsisCache={synopsisCache}
              synopsisLoading={synopsisLoading}
              synopsisErrors={synopsisErrors}
              onGenerateSynopsis={onGenerateSynopsis}
              onRetrySynopsis={onRetrySynopsis}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
