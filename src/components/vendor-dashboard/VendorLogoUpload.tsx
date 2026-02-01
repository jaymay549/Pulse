import { useState, useRef } from "react";
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

/**
 * Vendor logo upload component - currently disabled since database tables were removed.
 * Shows the current logo but upload functionality is disabled.
 */
export function VendorLogoUpload({
  profileId,
  vendorName,
  currentLogoUrl,
  onLogoUpdated,
}: VendorLogoUploadProps) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading] = useState(false);
  const [isRemoving] = useState(false);

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    toast({
      title: "Feature disabled",
      description: "Logo upload is temporarily unavailable.",
      variant: "destructive",
    });
  };

  const handleRemoveLogo = async () => {
    toast({
      title: "Feature disabled",
      description: "Logo removal is temporarily unavailable.",
      variant: "destructive",
    });
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
