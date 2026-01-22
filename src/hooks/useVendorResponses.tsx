import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

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

export function useVendorResponses(reviewIds: number[]): UseVendorResponsesResult {
  const [responses, setResponses] = useState<Record<number, VendorResponse | null>>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (reviewIds.length === 0) return;
    fetchResponses();
  }, [reviewIds.join(",")]);

  const fetchResponses = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("vendor_responses")
        .select(`
          *,
          vendor_profiles!vendor_responses_vendor_profile_id_fkey (
            vendor_name,
            company_logo_url
          )
        `)
        .in("review_id", reviewIds);

      if (error) throw error;

      const responseMap: Record<number, VendorResponse | null> = {};
      reviewIds.forEach((id) => (responseMap[id] = null));

      (data || []).forEach((r: any) => {
        responseMap[r.review_id] = {
          id: r.id,
          review_id: r.review_id,
          vendor_profile_id: r.vendor_profile_id,
          response_text: r.response_text,
          created_at: r.created_at,
          updated_at: r.updated_at,
          vendor_name: r.vendor_profiles?.vendor_name,
          company_logo_url: r.vendor_profiles?.company_logo_url,
        };
      });

      setResponses(responseMap);
    } catch (err) {
      console.error("Failed to fetch vendor responses:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const addResponse = async (reviewId: number, text: string): Promise<boolean> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      // Get vendor profile
      const { data: profile } = await supabase
        .from("vendor_profiles")
        .select("id, vendor_name, company_logo_url")
        .eq("user_id", user.id)
        .eq("is_approved", true)
        .single();

      if (!profile) return false;

      const { data, error } = await supabase
        .from("vendor_responses")
        .insert({
          review_id: reviewId,
          vendor_profile_id: profile.id,
          response_text: text,
        })
        .select()
        .single();

      if (error) throw error;

      setResponses((prev) => ({
        ...prev,
        [reviewId]: {
          ...data,
          vendor_name: profile.vendor_name,
          company_logo_url: profile.company_logo_url,
        },
      }));

      return true;
    } catch (err) {
      console.error("Failed to add response:", err);
      return false;
    }
  };

  const updateResponse = async (responseId: string, text: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("vendor_responses")
        .update({ response_text: text })
        .eq("id", responseId);

      if (error) throw error;

      setResponses((prev) => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          if (updated[Number(key)]?.id === responseId) {
            updated[Number(key)] = {
              ...updated[Number(key)]!,
              response_text: text,
              updated_at: new Date().toISOString(),
            };
          }
        }
        return updated;
      });

      return true;
    } catch (err) {
      console.error("Failed to update response:", err);
      return false;
    }
  };

  const deleteResponse = async (responseId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("vendor_responses")
        .delete()
        .eq("id", responseId);

      if (error) throw error;

      setResponses((prev) => {
        const updated = { ...prev };
        for (const key of Object.keys(updated)) {
          if (updated[Number(key)]?.id === responseId) {
            updated[Number(key)] = null;
          }
        }
        return updated;
      });

      return true;
    } catch (err) {
      console.error("Failed to delete response:", err);
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
