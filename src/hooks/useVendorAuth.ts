import { useOrganization, useAuth, useUser } from "@clerk/clerk-react";
import { useMemo, useCallback } from "react";

export type VendorTier = "viewer" | "pro";

export type VendorAccessStatus =
  | "unauthenticated"
  | "no_org"
  | "not_paid_not_verified"
  | "not_paid"
  | "pending_verification"
  | "active";

interface VendorMetadata {
  vendor?: {
    paid?: boolean;
    verified?: boolean;
    tier?: VendorTier;
    status?: string;
    vendorNames?: string[];
    [key: string]: unknown;
  };
}

function extractVendorNames(vendor: VendorMetadata["vendor"] | undefined): string[] {
  if (!vendor) return [];

  const fromArray = Array.isArray(vendor.vendorNames)
    ? vendor.vendorNames.filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    : [];

  if (fromArray.length > 0) return fromArray;

  // Backward compatibility: some org metadata stores vendor names as numeric keys: { "0": "...", "1": "..." }
  const fromIndexedKeys = Object.entries(vendor)
    .filter(([key, value]) => /^\d+$/.test(key) && typeof value === "string" && value.trim().length > 0)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([, value]) => value as string);

  return fromIndexedKeys;
}

export function useVendorAuth() {
  const { organization, membership, isLoaded: orgLoaded } = useOrganization();
  const { getToken, isSignedIn, isLoaded: authLoaded } = useAuth();
  const { user, isLoaded: userLoaded } = useUser();
  
  const isLoaded = authLoaded && orgLoaded && userLoaded;

  const vendorMeta = useMemo(() => {
    return (organization?.publicMetadata as VendorMetadata)?.vendor;
  }, [organization]);

  const isPaid = vendorMeta?.paid === true;
  const isVerified = vendorMeta?.verified === true;
  const isActive = isPaid && isVerified;
  const vendorTier = vendorMeta?.tier || null;
  const isPro = isActive && vendorTier === "pro";
  const vendorNames: string[] = useMemo(() => extractVendorNames(vendorMeta), [vendorMeta]);

  const accessStatus: VendorAccessStatus = useMemo(() => {
    if (!isSignedIn) return "unauthenticated";
    if (!organization) return "no_org";
    if (!isPaid && !isVerified) return "not_paid_not_verified";
    if (!isPaid) return "not_paid";
    if (!isVerified) return "pending_verification";
    return "active";
  }, [isSignedIn, organization, isPaid, isVerified]);

  // Get token with org context - ensures JWT includes org_id
  const getOrgToken = useCallback(async () => {
    if (!organization) {
      console.warn("[useVendorAuth] No organization found - user may need to select an org");
      return null;
    }
    try {
      // Try multiple approaches to get org-scoped token
      // 1. Try with organizationId parameter
      let token = await getToken({ organizationId: organization.id }).catch(() => null);
      
      // 2. If that fails, try with template (if configured)
      if (!token) {
        token = await getToken({ template: "org-token" }).catch(() => null);
      }
      
      // 3. Fallback to regular token (should include org_id if org is active)
      if (!token) {
        token = await getToken();
      }

      // Debug: decode token to check if org_id is present
      if (token && process.env.NODE_ENV === "development") {
        try {
          const payload = JSON.parse(atob(token.split(".")[1]));
          if (!payload.org_id) {
            console.warn("[useVendorAuth] Token does not include org_id:", {
              orgId: organization.id,
              payloadKeys: Object.keys(payload),
            });
          }
        } catch (e) {
          // Ignore decode errors
        }
      }

      return token;
    } catch (error) {
      console.error("[useVendorAuth] Failed to get org token:", error);
      return null;
    }
  }, [getToken, organization]);

  const fetchWithVendorAuth = useCallback(
    async (url: string, options: RequestInit = {}) => {
      const token = await getOrgToken();
      const headers = new Headers(options.headers);
      if (token) {
        headers.set("Authorization", `Bearer ${token}`);
      }
      if (organization?.id) {
        headers.set("X-Organization-Id", organization.id);
      }
      headers.set("Content-Type", "application/json");
      return fetch(url, { ...options, headers });
    },
    [getOrgToken, organization?.id]
  );

  const getOrgId = useCallback(() => {
    return organization?.id || null;
  }, [organization]);

  return {
    isLoaded,
    isSignedIn: isSignedIn ?? false,
    user,
    organization,
    membership,
    vendorTier,
    isPaid,
    isVerified,
    isActive,
    isPro,
    vendorNames,
    accessStatus,
    getToken: getOrgToken, // Return org-aware token getter
    getOrgId, // Return org ID getter for header fallback
    fetchWithVendorAuth,
  };
}
