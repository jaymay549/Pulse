import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Camera, Loader2, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface VendorLogoUploadProps {
  profileId: string;
  vendorName: string;
  currentLogoUrl: string | null;
  onLogoUpdated: (url: string | null) => void;
}

export function VendorLogoUpload({
  profileId,
  vendorName,
  currentLogoUrl,
  onLogoUpdated,
}: VendorLogoUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      toast({
        title: "Invalid file type",
        description: "Please upload an image file (JPG, PNG, etc.)",
        variant: "destructive",
      });
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please upload an image smaller than 2MB",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    try {
      // Generate unique filename
      const fileExt = file.name.split(".").pop();
      const fileName = `${profileId}/logo.${fileExt}`;

      // Delete existing logo if present
      if (currentLogoUrl) {
        const oldPath = currentLogoUrl.split("/vendor-logos/")[1];
        if (oldPath) {
          await supabase.storage.from("vendor-logos").remove([oldPath]);
        }
      }

      // Upload new logo
      const { error: uploadError } = await supabase.storage
        .from("vendor-logos")
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from("vendor-logos")
        .getPublicUrl(fileName);

      const publicUrl = `${urlData.publicUrl}?t=${Date.now()}`;

      // Update profile with new logo URL
      const { error: updateError } = await supabase
        .from("vendor_profiles")
        .update({ company_logo_url: publicUrl })
        .eq("id", profileId);

      if (updateError) throw updateError;

      onLogoUpdated(publicUrl);
      toast({ title: "Logo updated successfully!" });
    } catch (err) {
      console.error("Failed to upload logo:", err);
      toast({
        title: "Upload failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleRemoveLogo = async () => {
    if (!currentLogoUrl) return;

    setIsRemoving(true);

    try {
      // Extract path from URL
      const path = currentLogoUrl.split("/vendor-logos/")[1]?.split("?")[0];
      if (path) {
        await supabase.storage.from("vendor-logos").remove([path]);
      }

      // Update profile to remove logo URL
      const { error: updateError } = await supabase
        .from("vendor_profiles")
        .update({ company_logo_url: null })
        .eq("id", profileId);

      if (updateError) throw updateError;

      onLogoUpdated(null);
      toast({ title: "Logo removed" });
    } catch (err) {
      console.error("Failed to remove logo:", err);
      toast({
        title: "Failed to remove logo",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsRemoving(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative group">
        <Avatar className="h-24 w-24 border-2 border-border">
          <AvatarImage src={currentLogoUrl || undefined} alt={vendorName} />
          <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">
            {getInitials(vendorName)}
          </AvatarFallback>
        </Avatar>

        {/* Upload overlay */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer disabled:cursor-wait"
        >
          {isUploading ? (
            <Loader2 className="h-6 w-6 text-white animate-spin" />
          ) : (
            <Camera className="h-6 w-6 text-white" />
          )}
        </button>

        {/* Remove button */}
        {currentLogoUrl && !isUploading && (
          <button
            onClick={handleRemoveLogo}
            disabled={isRemoving}
            className="absolute -top-1 -right-1 h-6 w-6 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center hover:bg-destructive/90 transition-colors"
          >
            {isRemoving ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <X className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />

      <div className="text-center">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Camera className="h-4 w-4 mr-2" />
              {currentLogoUrl ? "Change Logo" : "Upload Logo"}
            </>
          )}
        </Button>
        <p className="text-xs text-muted-foreground mt-1">
          JPG or PNG, max 2MB
        </p>
      </div>
    </div>
  );
}
