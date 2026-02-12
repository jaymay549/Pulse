import { useCallback } from "react";
import { WAM_URL } from "@/config/wam";

/**
 * Hook for calling WAM Railway API endpoints that require
 * WhatsApp/AI/PDF operations (can't be done via Supabase alone).
 *
 * For Phase 0 this calls the WAM API directly with the WAM password.
 * In a future phase this will be replaced with a Supabase edge function proxy.
 */
export const useWamApi = () => {
  const callWam = useCallback(
    async (
      endpoint: string,
      options: RequestInit = {}
    ): Promise<any> => {
      const headers = new Headers(options.headers);
      headers.set("Content-Type", "application/json");

      // WAM uses X-Password for auth — stored in sessionStorage by admin
      const wamPassword = sessionStorage.getItem("wam_password");
      if (wamPassword) {
        headers.set("X-Password", wamPassword);
      }

      const res = await fetch(`${WAM_URL}${endpoint}`, {
        ...options,
        headers,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: res.statusText }));
        throw { status: res.status, error: body };
      }

      return res.json();
    },
    []
  );

  return {
    // Vendor queue operations
    processQueueItem: (id: number, forceReprocess = false) =>
      callWam(`/api/vendor-pulse/queue/${id}/process`, {
        method: "POST",
        body: JSON.stringify({ forceReprocess }),
      }),

    processAllQueue: (queueIds: number[], forceReprocess = false) =>
      callWam(`/api/vendor-pulse/queue/process-all`, {
        method: "POST",
        body: JSON.stringify({ queueIds, forceReprocess }),
      }),

    getVendorVersion: () => callWam(`/api/vendor-pulse/version`),

    // Task operations
    triggerTaskGenerate: (occurrenceId: number) =>
      callWam(`/api/debug/tasks/${occurrenceId}/trigger-generate`, {
        method: "POST",
      }),

    triggerTaskSend: (occurrenceId: number) =>
      callWam(`/api/debug/tasks/${occurrenceId}/trigger-send`, {
        method: "POST",
      }),

    // ── AI Chat ──
    chatWithAI: (params: {
      groupIds: number[];
      messages: { role: string; content: string }[];
      userMessage: string;
      startDate?: string;
      endDate?: string;
      uploadedFiles?: { name: string; content: string }[];
    }) =>
      callWam("/api/ai/chat", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    // ── Conversations ──
    saveConversation: (params: {
      id?: number;
      title: string;
      groupIds?: number[];
      groupNames?: string[];
      messages: { role: string; content: string }[];
      contextGroupIds?: number[];
      dateRangePreset?: string;
      customStartDate?: string;
      customEndDate?: string;
      pdfIds?: number[];
    }) =>
      callWam("/api/chat", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    deleteConversation: (id: number) =>
      callWam(`/api/chat/${id}`, { method: "DELETE" }),

    // ── PDF ──
    generatePdf: (params: {
      summaryContent: string;
      groupIds: number[];
      title?: string;
      startDate?: string;
      endDate?: string;
    }) =>
      callWam("/api/pdf/generate", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    previewPdfHtml: (params: {
      summaryContent: string;
      title?: string;
      startDate?: string;
      endDate?: string;
    }) =>
      callWam("/api/pdf/preview", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    downloadPdf: async (id: number): Promise<Blob> => {
      const headers = new Headers();
      const wamPassword = sessionStorage.getItem("wam_password");
      if (wamPassword) headers.set("X-Password", wamPassword);
      const res = await fetch(`${WAM_URL}/api/pdf/${id}/download`, { headers });
      if (!res.ok) throw new Error("Failed to download PDF");
      return res.blob();
    },

    deletePdf: (id: number) =>
      callWam(`/api/pdf/${id}`, { method: "DELETE" }),

    sendPdfToGroups: (id: number, groupIds: number[], caption?: string) =>
      callWam(`/api/pdf/${id}/send`, {
        method: "POST",
        body: JSON.stringify({ groupIds, caption }),
      }),

    updatePdfFilename: (id: number, filename: string) =>
      callWam(`/api/pdf/${id}/filename`, {
        method: "PUT",
        body: JSON.stringify({ filename }),
      }),

    // ── Send Message ──
    sendMessage: (params: {
      groupIds: number[];
      message: string;
      scheduledFor?: string;
      pdfId?: number;
    }) =>
      callWam("/api/send", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    cancelScheduledMessage: (id: number) =>
      callWam(`/api/scheduled/${id}`, { method: "DELETE" }),

    // ── Task occurrence operations ──
    updateOccurrenceHtml: (occurrenceId: number, html: string) =>
      callWam(`/api/occurrences/${occurrenceId}/html`, {
        method: "PUT",
        body: JSON.stringify({ html }),
      }),

    rejectOccurrence: (occurrenceId: number) =>
      callWam(`/api/occurrences/${occurrenceId}/reject`, { method: "POST" }),

    sendOccurrence: (occurrenceId: number) =>
      callWam(`/api/occurrences/${occurrenceId}/send`, { method: "POST" }),

    // ── Enhanced queue operations ──
    deleteQueueItem: (id: number) =>
      callWam(`/api/vendor-pulse/queue/${id}`, { method: "DELETE" }),

    processAllQueueItems: (queueIds: number[], forceReprocess = false) =>
      callWam("/api/vendor-pulse/queue/process-all", {
        method: "POST",
        body: JSON.stringify({ queueIds, forceReprocess }),
      }),

    rejectMention: (
      queueId: number,
      mentionIndex: number,
      addToIgnore: boolean,
      reason?: string
    ) =>
      callWam(
        `/api/vendor-pulse/queue/${queueId}/mentions/${mentionIndex}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ addToIgnore, reason }),
        }
      ),

    getMentionThinking: (queueId: number, mentionIndex: number) =>
      callWam(
        `/api/vendor-pulse/queue/${queueId}/mentions/${mentionIndex}/thinking`
      ),

    rerunAll: (includeCurrentVersion = false) =>
      callWam("/api/vendor-pulse/queue/rerun-all", {
        method: "POST",
        body: JSON.stringify({ includeCurrentVersion }),
      }),

    // ── Trends ──
    generateTrendReport: (params: {
      type: "daily" | "weekly";
      startDate?: string;
      endDate?: string;
      customInstructions?: string;
    }) =>
      callWam("/api/trends/generate", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    // ── Debug ──
    testGeminiRequest: (params: Record<string, unknown>) =>
      callWam("/api/debug/gemini", {
        method: "POST",
        body: JSON.stringify(params),
      }),

    getWhatsAppMethods: () => callWam("/api/debug/whatsapp/methods"),

    callWhatsAppMethod: (methodName: string, args: unknown[]) =>
      callWam("/api/debug/whatsapp/call", {
        method: "POST",
        body: JSON.stringify({ methodName, args }),
      }),

    // Generic call for anything else
    call: callWam,
  };
};
