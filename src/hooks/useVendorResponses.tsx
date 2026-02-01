import { useState } from "react";

export interface VendorResponse {
  id: string;
  review_id: number;
  vendor_profile_id: string;
  response_text: string;
  created_at: string;
  updated_at: string;
  vendor_name?: string;
  company_logo_url?: string | null;
}

interface UseVendorResponsesResult {
  responses: Record<number, VendorResponse | null>;
  isLoading: boolean;
  addResponse: (reviewId: number, text: string) => Promise<boolean>;
  updateResponse: (responseId: string, text: string) => Promise<boolean>;
  deleteResponse: (responseId: string) => Promise<boolean>;
}

/**
 * Hook for vendor responses - currently a stub since database tables were removed.
 * Responses functionality is disabled until tables are recreated.
 */
export function useVendorResponses(reviewIds: number[]): UseVendorResponsesResult {
  const [responses] = useState<Record<number, VendorResponse | null>>({});
  const [isLoading] = useState(false);

  const addResponse = async (_reviewId: number, _text: string): Promise<boolean> => {
    console.warn("Vendor responses disabled - database tables not configured");
    return false;
  };

  const updateResponse = async (_responseId: string, _text: string): Promise<boolean> => {
    console.warn("Vendor responses disabled - database tables not configured");
    return false;
  };

  const deleteResponse = async (_responseId: string): Promise<boolean> => {
    console.warn("Vendor responses disabled - database tables not configured");
    return false;
  };

  return {
    responses,
    isLoading,
    addResponse,
    updateResponse,
    deleteResponse,
  };
}
