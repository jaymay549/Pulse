import { useQuery } from "@tanstack/react-query";
import { useClerkSupabase } from "@/hooks/useClerkSupabase";

export interface BucketDetail {
  headline: string;
  dimension: string;
}

export interface SegmentBucket {
  bucket: string;
  mentions: number;
  positive_pct: number;
  wins: BucketDetail[];
  flags: BucketDetail[];
}

export interface SegmentInsight {
  type: "gap" | "pain" | "strength" | "divergence";
  axis: string;
  bucket: string | null;
  dimension: string;
  headline: string;
  detail: string | null;
  severity: number;
  mention_count: number;
}

export interface VendorSegmentIntel {
  total_attributed: number;
  insights: SegmentInsight[];
  axes: {
    size: SegmentBucket[];
    role: SegmentBucket[];
    geo: SegmentBucket[];
    oem: SegmentBucket[];
  };
}

export type SegmentAxis = keyof VendorSegmentIntel["axes"];

export const AXIS_CONFIG: Record<SegmentAxis, { label: string; description: string }> = {
  size: { label: "Dealership Size", description: "By rooftop count" },
  role: { label: "Role", description: "By job function" },
  geo: { label: "Geography", description: "By region" },
  oem: { label: "OEM Mix", description: "By franchise type" },
};

const DIMENSION_LABELS: Record<string, string> = {
  worth_it: "Value",
  support: "Support",
  integrates: "Integration",
  adopted: "Adoption",
  reliable: "Reliability",
  other: "General",
};

export function dimensionLabel(dim: string): string {
  return DIMENSION_LABELS[dim] ?? dim;
}

export function useVendorSegmentIntel(vendorName: string) {
  const supabase = useClerkSupabase();

  return useQuery({
    queryKey: ["vendor-segment-intel", vendorName],
    queryFn: async (): Promise<VendorSegmentIntel> => {
      const { data, error } = await supabase.rpc(
        "get_vendor_segment_intel" as never,
        { p_vendor_name: vendorName } as never
      );

      if (error) {
        console.error("[Supabase] get_vendor_segment_intel error:", error);
        throw error;
      }

      const result = data as unknown as VendorSegmentIntel;

      const normalizeBuckets = (buckets: SegmentBucket[] | undefined): SegmentBucket[] =>
        (buckets ?? []).map((b) => ({
          ...b,
          wins: b.wins ?? [],
          flags: b.flags ?? [],
        }));

      return {
        total_attributed: result.total_attributed ?? 0,
        insights: result.insights ?? [],
        axes: {
          size: normalizeBuckets(result.axes?.size),
          role: normalizeBuckets(result.axes?.role),
          geo: normalizeBuckets(result.axes?.geo),
          oem: normalizeBuckets(result.axes?.oem),
        },
      };
    },
    enabled: !!vendorName,
    staleTime: 5 * 60 * 1000,
  });
}
