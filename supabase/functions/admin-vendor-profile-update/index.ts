import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.0";
import { decode as decodeBase64 } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-organization-id",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function verifyAdmin(token: string): { isAdmin: boolean; userId: string } {
  const payload = JSON.parse(atob(token.split(".")[1]));
  const userId = payload.sub || "";
  const isAdmin = payload.user_role === "admin";
  return { isAdmin, userId };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { action, _auth_token } = body;

    // Auth token passed in body (avoids Supabase gateway rejecting Clerk JWTs)
    const authToken = _auth_token || req.headers.get("Authorization")?.replace("Bearer ", "");
    if (!authToken) throw new Error("Missing auth token");

    const { isAdmin, userId } = verifyAdmin(authToken);
    if (!isAdmin) {
      throw new Error(
        `permission denied: admin role required (user: ${userId}). ` +
        `Add this ID to ADMIN_CLERK_IDS secret.`
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── GET PROFILE ─────────────────────────────────────────────
    if (action === "get-profile") {
      const { profile_id } = body;
      if (!profile_id) throw new Error("profile_id is required");

      const { data, error } = await supabase
        .from("vendor_profiles")
        .select("*")
        .eq("id", profile_id)
        .maybeSingle();
      if (error) throw error;

      return jsonResponse(data);
    }

    // ── UPDATE PROFILE ──────────────────────────────────────────
    if (action === "update-profile") {
      const { profile_id, updates } = body;
      if (!profile_id) throw new Error("profile_id is required");

      const allowedFields = [
        "tagline",
        "company_description",
        "company_website",
        "linkedin_url",
        "headquarters",
        "contact_email",
        "banner_url",
        "company_logo_url",
      ];
      const safeUpdates: Record<string, unknown> = {};
      for (const key of allowedFields) {
        if (key in updates) safeUpdates[key] = updates[key];
      }

      const { error } = await supabase
        .from("vendor_profiles")
        .update(safeUpdates)
        .eq("id", profile_id);
      if (error) throw error;

      // Sync ALL profile fields to vendor_metadata so the public page reflects changes.
      // Read back the full profile (includes banner/logo set by earlier uploads).
      const { data: fullProfile } = await supabase
        .from("vendor_profiles")
        .select("vendor_name, company_website, company_logo_url, company_description, linkedin_url, banner_url, tagline, headquarters")
        .eq("id", profile_id)
        .single();

      if (fullProfile?.vendor_name) {
        // Upsert so it works even if vendor_metadata has no row yet
        await supabase
          .from("vendor_metadata")
          .upsert({
            vendor_name: fullProfile.vendor_name,
            website_url: fullProfile.company_website || null,
            company_logo_url: fullProfile.company_logo_url || null,
            description: fullProfile.company_description || null,
            linkedin_url: fullProfile.linkedin_url || null,
            banner_url: fullProfile.banner_url || null,
            tagline: fullProfile.tagline || null,
            headquarters: fullProfile.headquarters || null,
          }, { onConflict: "vendor_name" });
      }

      return jsonResponse({ ok: true });
    }

    // ── UPLOAD FILE ─────────────────────────────────────────────
    if (action === "upload-file") {
      const { bucket, path, file_base64, content_type } = body;
      if (!bucket || !path || !file_base64) {
        throw new Error("bucket, path, and file_base64 are required");
      }

      const allowedBuckets = ["vendor-logos", "vendor-screenshots"];
      if (!allowedBuckets.includes(bucket)) {
        throw new Error(`Bucket not allowed: ${bucket}`);
      }

      const fileBytes = decodeBase64(file_base64);
      const { error } = await supabase.storage
        .from(bucket)
        .upload(path, fileBytes, {
          upsert: true,
          contentType: content_type || "application/octet-stream",
        });
      if (error) throw error;

      const {
        data: { publicUrl },
      } = supabase.storage.from(bucket).getPublicUrl(path);

      return jsonResponse({ publicUrl });
    }

    // ── DELETE FILE ─────────────────────────────────────────────
    if (action === "delete-file") {
      const { bucket, paths } = body;
      if (!bucket || !paths) {
        throw new Error("bucket and paths are required");
      }

      const allowedBuckets = ["vendor-logos", "vendor-screenshots"];
      if (!allowedBuckets.includes(bucket)) {
        throw new Error(`Bucket not allowed: ${bucket}`);
      }

      const { error } = await supabase.storage.from(bucket).remove(paths);
      if (error) throw error;

      return jsonResponse({ ok: true });
    }

    // ── LIST FILES ──────────────────────────────────────────────
    if (action === "list-files") {
      const { bucket, folder } = body;
      if (!bucket || !folder) {
        throw new Error("bucket and folder are required");
      }

      const { data: files, error } = await supabase.storage
        .from(bucket)
        .list(folder);
      if (error) throw error;

      const result = (files || [])
        .filter((f: { name: string }) => f.name !== ".emptyFolderPlaceholder")
        .map((f: { name: string }) => ({
          name: f.name,
          url: supabase.storage
            .from(bucket)
            .getPublicUrl(`${folder}/${f.name}`).data.publicUrl,
        }));

      return jsonResponse(result);
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (error) {
    return jsonResponse(
      { error: error instanceof Error ? error.message : "Unknown error" },
      400
    );
  }
});
