import { VendorEntry } from "@/hooks/useVendorReviews";
import { VendorResponse } from "@/hooks/useVendorResponses";
import { getVendorNamesFromEntries } from "@/lib/utils";
import VendorCard from "./VendorCard";

interface VendorReviewGridProps {
  entries: VendorEntry[];
  isAuthenticated: boolean;
  isFullAccess: boolean;
  responses: Record<string, VendorResponse | null>;
  isLocked: (entry: VendorEntry) => boolean;
  showVendorNames: (entry: VendorEntry) => boolean;
  getVendorWebsite: (vendorName?: string) => string | null;
  getVendorLogo: (
    vendorName?: string,
    vendorWebsite?: string | null,
  ) => string | null;
  canRespondToVendor: (vendorName?: string) => boolean;
  onAddResponse: (reviewId: string, text: string) => Promise<boolean>;
  onUpdateResponse: (responseId: string, text: string) => Promise<boolean>;
  onDeleteResponse: (responseId: string) => Promise<boolean>;
  onCardClick: (entry: VendorEntry) => void;
  onVendorClick: (vendorName: string) => void;
  onUpgradeClick: () => void;
  /** Override the set of known vendors used for inline chips. Defaults to names derived from entries. */
  knownVendors?: string[];
}

export default function VendorReviewGrid({
  entries,
  isAuthenticated,
  isFullAccess,
  responses,
  isLocked,
  showVendorNames,
  getVendorWebsite,
  getVendorLogo,
  canRespondToVendor,
  onAddResponse,
  onUpdateResponse,
  onDeleteResponse,
  onCardClick,
  onVendorClick,
  onUpgradeClick,
  knownVendors: knownVendorsProp,
}: VendorReviewGridProps) {
  const knownVendors = knownVendorsProp ?? getVendorNamesFromEntries(entries);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
      {entries.map((entry) => {
        const vendorName = entry.vendorName || undefined;
        const vendorWebsite = getVendorWebsite(vendorName);
        const vendorLogo = getVendorLogo(vendorName, vendorWebsite);

        const hookResponse = responses[String(entry.id)] || null;
        const apiResponse = (entry as any).vendorResponse;
        const vendorResponse =
          hookResponse ||
          (apiResponse
            ? {
                id: "",
                review_id: String(entry.id),
                vendor_profile_id: "",
                response_text: apiResponse.responseText,
                created_at: apiResponse.respondedAt,
                updated_at: apiResponse.respondedAt,
              }
            : null);

        return (
          <VendorCard
            key={entry.id}
            entry={entry}
            isLocked={isLocked(entry)}
            showVendorNames={showVendorNames(entry)}
            isFullAccess={isFullAccess}
            isAuthenticated={isAuthenticated}
            vendorResponse={vendorResponse}
            vendorWebsite={vendorWebsite}
            vendorLogo={vendorLogo}
            canRespondAsVendor={canRespondToVendor(vendorName)}
            onAddResponse={(text) => onAddResponse(String(entry.id), text)}
            onUpdateResponse={onUpdateResponse}
            onDeleteResponse={onDeleteResponse}
            onCardClick={onCardClick}
            onVendorClick={onVendorClick}
            onUpgradeClick={onUpgradeClick}
            knownVendors={knownVendors}
          />
        );
      })}
    </div>
  );
}
