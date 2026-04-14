import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { useVendorDataClient } from "@/hooks/useVendorDataClient";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface VendorProfile {
  id: string;
  user_id: string;
  vendor_name: string;
  company_website: string | null;
  company_logo_url: string | null;
  company_description: string | null;
  contact_email: string | null;
  is_approved: boolean;
  tagline: string | null;
  linkedin_url: string | null;
  headquarters: string | null;
  banner_url: string | null;
}

interface ScreenshotFile {
  name: string;
  url: string;
}

const MAX_SCREENSHOTS = 6;

interface DashboardEditProfileProps {
  /** When provided (admin mode), fetch profile by ID instead of current user */
  vendorProfileId?: string;
}

/** Convert a File to base64 string (without the data:... prefix) */
async function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data:...;base64, prefix
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function DashboardEditProfile({ vendorProfileId }: DashboardEditProfileProps): JSX.Element {
  const { user, getToken } = useClerkAuth();
  const supabase = useVendorDataClient();
  const queryClient = useQueryClient();
  const isAdminMode = !!vendorProfileId;

  // Form state
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [headquarters, setHeadquarters] = useState("");

  // Track whether form has been initialized from profile data
  const [formInitialized, setFormInitialized] = useState(false);

  // Upload refs
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const screenshotInputRef = useRef<HTMLInputElement>(null);

  // ---------- Admin edge function helper ----------
  async function adminOp(body: Record<string, unknown>) {
    const token = await getToken();
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/admin-vendor-profile-update`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ ...body, _auth_token: token }),
      }
    );
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || "Admin operation failed");
    }
    return res.json();
  }

  // ---------- Fetch profile ----------
  const profileQueryKey = isAdminMode
    ? ["vendor-edit-profile-admin", vendorProfileId]
    : ["vendor-edit-profile", user?.id];

  const { data: profile, isLoading } = useQuery({
    queryKey: profileQueryKey,
    queryFn: async () => {
      if (isAdminMode) {
        return (await adminOp({
          action: "get-profile",
          profile_id: vendorProfileId,
        })) as VendorProfile | null;
      }

      const { data, error } = await supabase
        .from("vendor_profiles" as never)
        .select("*")
        .eq("user_id", user!.id)
        .eq("is_approved", true)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as VendorProfile | null;
    },
    enabled: isAdminMode ? true : !!user?.id,
  });

  // ---------- Fetch screenshots ----------
  const { data: screenshots = [] } = useQuery({
    queryKey: ["vendor-screenshots", profile?.id],
    queryFn: async () => {
      if (isAdminMode) {
        return (await adminOp({
          action: "list-files",
          bucket: "vendor-screenshots",
          folder: profile!.id,
        })) as ScreenshotFile[];
      }

      const { data: files, error } = await supabase.storage
        .from("vendor-screenshots")
        .list(profile!.id);
      if (error) throw error;
      if (!files || files.length === 0) return [];
      return files
        .filter((f) => f.name !== ".emptyFolderPlaceholder")
        .map((f) => ({
          name: f.name,
          url: supabase.storage
            .from("vendor-screenshots")
            .getPublicUrl(`${profile!.id}/${f.name}`).data.publicUrl,
        })) as ScreenshotFile[];
    },
    enabled: !!profile?.id,
  });

  // ---------- Initialize form from profile ----------
  useEffect(() => {
    if (profile && !formInitialized) {
      setTagline(profile.tagline ?? "");
      setDescription(profile.company_description ?? "");
      setHeadquarters(profile.headquarters ?? "");
      setFormInitialized(true);
    }
  }, [profile, formInitialized]);

  // ---------- Check if form is dirty ----------
  const isFormDirty =
    formInitialized &&
    profile &&
    (tagline !== (profile.tagline ?? "") ||
      description !== (profile.company_description ?? "") ||
      headquarters !== (profile.headquarters ?? ""));

  // ---------- Upload helper (owner mode) ----------
  const handleUpload = async (file: File, bucket: string, path: string) => {
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const {
      data: { publicUrl },
    } = supabase.storage.from(bucket).getPublicUrl(path);
    return publicUrl;
  };

  // ---------- Admin upload helper ----------
  const handleAdminUpload = async (file: File, bucket: string, path: string) => {
    const file_base64 = await fileToBase64(file);
    const result = await adminOp({
      action: "upload-file",
      bucket,
      path,
      file_base64,
      content_type: file.type,
    });
    return result.publicUrl as string;
  };

  // ---------- Banner upload mutation ----------
  const bannerMutation = useMutation({
    mutationFn: async (file: File) => {
      const path = `${profile!.id}/banner`;
      const publicUrl = isAdminMode
        ? await handleAdminUpload(file, "vendor-logos", path)
        : await handleUpload(file, "vendor-logos", path);

      if (isAdminMode) {
        await adminOp({
          action: "update-profile",
          profile_id: profile!.id,
          updates: { banner_url: publicUrl },
        });
      } else {
        const { error } = await supabase
          .from("vendor_profiles" as never)
          .update({ banner_url: publicUrl } as never)
          .eq("id", profile!.id);
        if (error) throw error;
      }
      return publicUrl;
    },
    onSuccess: () => {
      toast.success("Banner updated.");
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
    onError: (err: Error) => toast.error(`Banner upload failed: ${err.message}`),
  });

  // ---------- Logo upload mutation ----------
  const logoMutation = useMutation({
    mutationFn: async (file: File) => {
      const path = `${profile!.id}/logo`;
      const publicUrl = isAdminMode
        ? await handleAdminUpload(file, "vendor-logos", path)
        : await handleUpload(file, "vendor-logos", path);

      if (isAdminMode) {
        await adminOp({
          action: "update-profile",
          profile_id: profile!.id,
          updates: { company_logo_url: publicUrl },
        });
      } else {
        const { error } = await supabase
          .from("vendor_profiles" as never)
          .update({ company_logo_url: publicUrl } as never)
          .eq("id", profile!.id);
        if (error) throw error;
      }
      return publicUrl;
    },
    onSuccess: () => {
      toast.success("Logo updated.");
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
    },
    onError: (err: Error) => toast.error(`Logo upload failed: ${err.message}`),
  });

  // ---------- Screenshot upload mutation ----------
  const screenshotUploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const timestamp = Date.now();
      const path = `${profile!.id}/${timestamp}-${file.name}`;
      if (isAdminMode) {
        await handleAdminUpload(file, "vendor-screenshots", path);
      } else {
        await handleUpload(file, "vendor-screenshots", path);
      }
    },
    onSuccess: () => {
      toast.success("Screenshot added.");
      queryClient.invalidateQueries({ queryKey: ["vendor-screenshots", profile?.id] });
    },
    onError: (err: Error) => toast.error(`Screenshot upload failed: ${err.message}`),
  });

  // ---------- Screenshot delete mutation ----------
  const screenshotDeleteMutation = useMutation({
    mutationFn: async (fileName: string) => {
      if (isAdminMode) {
        await adminOp({
          action: "delete-file",
          bucket: "vendor-screenshots",
          paths: [`${profile!.id}/${fileName}`],
        });
      } else {
        const { error } = await supabase.storage
          .from("vendor-screenshots")
          .remove([`${profile!.id}/${fileName}`]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Screenshot removed.");
      queryClient.invalidateQueries({ queryKey: ["vendor-screenshots", profile?.id] });
    },
    onError: (err: Error) => toast.error(`Failed to remove screenshot: ${err.message}`),
  });

  // ---------- Save profile details mutation ----------
  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = {
        tagline,
        company_description: description,
        headquarters,
      };

      if (isAdminMode) {
        await adminOp({
          action: "update-profile",
          profile_id: profile!.id,
          updates,
        });
      } else {
        const { error } = await supabase
          .from("vendor_profiles" as never)
          .update(updates as never)
          .eq("id", profile!.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Profile saved.");
      queryClient.invalidateQueries({ queryKey: profileQueryKey });
      setFormInitialized(false); // allow re-sync with fresh data
    },
    onError: (err: Error) => toast.error(`Failed to save profile: ${err.message}`),
  });

  // ---------- File change handlers ----------
  const onBannerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) bannerMutation.mutate(file);
    e.target.value = "";
  };

  const onLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) logoMutation.mutate(file);
    e.target.value = "";
  };

  const onScreenshotChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (screenshots.length >= MAX_SCREENSHOTS) {
        toast.error(`Maximum ${MAX_SCREENSHOTS} screenshots allowed.`);
        e.target.value = "";
        return;
      }
      screenshotUploadMutation.mutate(file);
    }
    e.target.value = "";
  };

  // ---------- Loading state ----------
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!profile) {
    return <p className="text-sm text-slate-500">No approved profile found.</p>;
  }

  // ---------- Render ----------
  return (
    <div>
      <h1 className="text-2xl font-semibold text-slate-900">Edit Profile</h1>
      <p className="mt-1 text-sm text-slate-500">
        Manage your brand assets and company information
      </p>

      {/* ---- Section A: Brand Assets ---- */}
      <div className="mt-6 rounded-xl border bg-white">
        {/* Banner */}
        <div className="relative">
          <div
            className="h-[200px] w-full rounded-t-xl bg-slate-200 bg-cover bg-top"
            style={
              profile.banner_url
                ? { backgroundImage: `url(${profile.banner_url})` }
                : undefined
            }
          />
          <button
            type="button"
            className="absolute inset-0 flex items-center justify-center rounded-t-xl bg-black/0 text-transparent transition-all hover:bg-black/30 hover:text-white"
            onClick={() => bannerInputRef.current?.click()}
            disabled={bannerMutation.isPending}
          >
            {bannerMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <span className="flex items-center gap-1.5 text-sm font-medium">
                <ImagePlus className="h-4 w-4" />
                Upload Banner
              </span>
            )}
          </button>
          <input
            ref={bannerInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onBannerChange}
          />
        </div>

        {/* Logo */}
        <div className="relative -mt-10 ml-6">
          <div className="h-20 w-20 overflow-hidden rounded-full border-4 border-white bg-slate-200">
            {profile.company_logo_url ? (
              <img
                src={profile.company_logo_url}
                alt={`${profile.vendor_name} logo`}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-lg font-bold text-slate-400">
                {profile.vendor_name?.charAt(0)?.toUpperCase() ?? "V"}
              </div>
            )}
          </div>
          <button
            type="button"
            className="absolute inset-0 flex h-20 w-20 items-center justify-center rounded-full bg-black/0 text-transparent transition-all hover:bg-black/40 hover:text-white"
            onClick={() => logoInputRef.current?.click()}
            disabled={logoMutation.isPending}
          >
            {logoMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Camera className="h-4 w-4" />
            )}
          </button>
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onLogoChange}
          />
        </div>

        {/* Screenshots Gallery */}
        <div className="p-6 pt-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-slate-900">
              Screenshots ({screenshots.length}/{MAX_SCREENSHOTS})
            </h2>
            <Button
              variant="outline"
              size="sm"
              onClick={() => screenshotInputRef.current?.click()}
              disabled={
                screenshotUploadMutation.isPending ||
                screenshots.length >= MAX_SCREENSHOTS
              }
            >
              {screenshotUploadMutation.isPending ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <ImagePlus className="mr-1.5 h-3.5 w-3.5" />
              )}
              Add Screenshot
            </Button>
            <input
              ref={screenshotInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={onScreenshotChange}
            />
          </div>

          {screenshots.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">
              No screenshots yet. Add up to {MAX_SCREENSHOTS} images to showcase
              your product.
            </p>
          ) : (
            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {screenshots.map((ss) => (
                <div key={ss.name} className="group relative">
                  <img
                    src={ss.url}
                    alt={ss.name}
                    className="h-28 w-full rounded-lg border object-cover"
                  />
                  <button
                    type="button"
                    className="absolute right-1.5 top-1.5 hidden rounded-full bg-black/60 p-1 text-white hover:bg-black/80 group-hover:block"
                    onClick={() => screenshotDeleteMutation.mutate(ss.name)}
                    disabled={screenshotDeleteMutation.isPending}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ---- Section B: Profile Details Form ---- */}
      <div className="mt-6 rounded-xl border bg-white p-6">
        <h2 className="text-lg font-medium text-slate-900">Profile Details</h2>
        <p className="mt-1 text-sm text-slate-500">
          Update your company information visible to the community
        </p>

        <div className="mt-6 space-y-5">
          <div>
            <Label htmlFor="tagline">Tagline</Label>
            <Input
              id="tagline"
              className="mt-1.5"
              placeholder="A short tagline for your company"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              className="mt-1.5"
              rows={4}
              placeholder="Tell the community about your company and products"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="headquarters">Headquarters</Label>
            <Input
              id="headquarters"
              className="mt-1.5"
              placeholder="City, State or Country"
              value={headquarters}
              onChange={(e) => setHeadquarters(e.target.value)}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <Button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || !isFormDirty}
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
