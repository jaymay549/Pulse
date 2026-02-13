import { WAM_URL } from "@/config/wam";

// Helper to make authenticated requests to the vendor portal API
async function vendorPortalRequest(
  endpoint: string,
  getToken: () => Promise<string | null>,
  getOrgId: () => string | null,
  options: RequestInit = {}
) {
  const token = await getToken();
  const orgId = getOrgId();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  // Fallback: send org_id as header if JWT doesn't include it
  if (orgId) {
    headers["X-Organization-Id"] = orgId;
  }

  const response = await fetch(`${WAM_URL}/api${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: response.statusText }));
    throw { status: response.status, ...error };
  }

  return response.json();
}

export interface VendorMention {
  id: string;
  vendorName: string;
  title: string;
  quote: string;
  explanation?: string;
  type: "positive" | "warning";
  category: string;
  conversation_time: string;
  response?: VendorResponseItem | null;
}

export interface VendorMentionsResponse {
  mentions: VendorMention[];
  total: number;
  page: number;
  limit: number;
}

export interface VendorStats {
  total: number;
  positive: number;
  negative: number;
}

export interface VendorResponseItem {
  id: number;
  mention_id: string;
  org_id: string;
  responder_user_id: string;
  response_text: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface AccessStatusResponse {
  paid: boolean;
  verified: boolean;
  tier: string | null;
  status: string | null;
  vendorNames: string[];
}

export function createVendorPortalApi(
  getToken: () => Promise<string | null>,
  getOrgId: () => string | null
) {
  return {
    getAccessStatus: (): Promise<AccessStatusResponse> =>
      vendorPortalRequest("/vendor-portal/access-status", getToken, getOrgId),

    getMentions: (params: {
      category?: string;
      type?: string;
      search?: string;
      page?: number;
      limit?: number;
      includeResponses?: boolean;
    } = {}): Promise<VendorMentionsResponse> => {
      const searchParams = new URLSearchParams();
      if (params.category) searchParams.set("category", params.category);
      if (params.type) searchParams.set("type", params.type);
      if (params.search) searchParams.set("search", params.search);
      if (params.page) searchParams.set("page", params.page.toString());
      if (params.limit) searchParams.set("limit", params.limit.toString());
      if (params.includeResponses) searchParams.set("includeResponses", "1");
      const qs = searchParams.toString();
      return vendorPortalRequest(`/vendor-portal/mentions${qs ? `?${qs}` : ""}`, getToken, getOrgId);
    },

    getStats: (): Promise<VendorStats> =>
      vendorPortalRequest("/vendor-portal/mentions/stats", getToken, getOrgId),

    getResponses: (): Promise<{ responses: VendorResponseItem[] }> =>
      vendorPortalRequest("/vendor-portal/responses", getToken, getOrgId),

    createResponse: (mentionId: string, responseText: string) =>
      vendorPortalRequest(`/vendor-portal/mentions/${mentionId}/response`, getToken, getOrgId, {
        method: "POST",
        body: JSON.stringify({ responseText }),
      }),

    updateResponse: (responseId: number, responseText: string) =>
      vendorPortalRequest(`/vendor-portal/responses/${responseId}`, getToken, getOrgId, {
        method: "PUT",
        body: JSON.stringify({ responseText }),
      }),

    deleteResponse: (responseId: number) =>
      vendorPortalRequest(`/vendor-portal/responses/${responseId}`, getToken, getOrgId, {
        method: "DELETE",
      }),
  };
}
