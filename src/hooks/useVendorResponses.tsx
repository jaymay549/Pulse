import { useState, useEffect, useMemo, useCallback } from "react";
import { useVendorAuth } from "./useVendorAuth";
import { createVendorPortalApi } from "@/lib/vendorPortalApi";

export interface VendorResponse {
  id: string;
  review_id: string;
  vendor_profile_id: string;
  response_text: string;
  created_at: string;
  updated_at: string;
  vendor_name?: string;
  company_logo_url?: string | null;
}

interface UseVendorResponsesResult {
  responses: Record<string, VendorResponse | null>;
  isLoading: boolean;
  addResponse: (reviewId: string, text: string) => Promise<boolean>;
  updateResponse: (responseId: string, text: string) => Promise<boolean>;
  deleteResponse: (responseId: string) => Promise<boolean>;
}

/**
 * Hook for vendor responses - uses the vendor portal API for Pro vendors.
 * Falls back to no-op for non-Pro vendors.
 */
export function useVendorResponses(reviewIds: string[]): UseVendorResponsesResult {
  const { isPro, getToken, getOrgId, organization } = useVendorAuth();
  const api = useMemo(() => createVendorPortalApi(getToken, getOrgId), [getToken, getOrgId]);
  const [responses, setResponses] = useState<Record<string, VendorResponse | null>>({});
  const [isLoading, setIsLoading] = useState(false);

  const fetchResponses = useCallback(async () => {
    if (!isPro || !organization) return;
    setIsLoading(true);
    try {
      const data = await api.getResponses();
      const map: Record<string, VendorResponse | null> = {};
      (data.responses || []).forEach((r: any) => {
        const mentionId = String(r.mention_id || "");
        if (!mentionId) return;
        map[mentionId] = {
          id: String(r.id),
          review_id: mentionId,
          vendor_profile_id: r.org_id,
          response_text: r.response_text,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });
      setResponses(map);
    } catch (error) {
      console.error("[useVendorResponses] Failed to fetch:", error);
    } finally {
      setIsLoading(false);
    }
  }, [isPro, organization, api]);

  useEffect(() => {
    fetchResponses();
  }, [fetchResponses]);

  const addResponse = async (reviewId: string, text: string): Promise<boolean> => {
    if (!isPro) return false;
    try {
      await api.createResponse(reviewId, text);
      await fetchResponses();
      return true;
    } catch (error) {
      console.error("[useVendorResponses] Failed to create:", error);
      return false;
    }
  };

  const updateResponse = async (responseId: string, text: string): Promise<boolean> => {
    if (!isPro) return false;
    try {
      await api.updateResponse(Number(responseId), text);
      await fetchResponses();
      return true;
    } catch (error) {
      console.error("[useVendorResponses] Failed to update:", error);
      return false;
    }
  };

  const deleteResponse = async (responseId: string): Promise<boolean> => {
    if (!isPro) return false;
    try {
      await api.deleteResponse(Number(responseId));
      await fetchResponses();
      return true;
    } catch (error) {
      console.error("[useVendorResponses] Failed to delete:", error);
      return false;
    }
  };

  return {
    responses,
    isLoading,
    addResponse,
    updateResponse,
    deleteResponse,
  };
}
