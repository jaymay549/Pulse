import React from "react";
import { Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface VendorMentionProps {
  vendorName: string;
  className?: string;
  showLogo?: boolean;
}

/**
 * Renders a vendor name as a clickable link with logo
 */
export const VendorMention: React.FC<VendorMentionProps> = ({
  vendorName,
  className = "",
  showLogo = true,
}) => {
  const logoDevToken = import.meta.env.VITE_LOGO_DEV_TOKEN;

  // Generate logo URL from vendor name
  const getLogoUrl = () => {
    if (!logoDevToken) return null;
    const domain =
      vendorName
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9.-]/g, "") + ".com";
    return `https://img.logo.dev/${domain}?token=${logoDevToken}&size=64&format=png&fallback=monogram`;
  };

  const logoUrl = getLogoUrl();
  const vendorSlug = encodeURIComponent(vendorName);

  return (
    <Link
      to={`/vendors/${vendorSlug}`}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 hover:bg-primary/20 text-primary font-medium text-sm transition-colors no-underline",
        className,
      )}
      onClick={(e) => e.stopPropagation()}
    >
      {showLogo && (
        <Avatar className="h-4 w-4 border border-primary/20">
          <AvatarImage src={logoUrl || undefined} alt={vendorName} />
          <AvatarFallback className="bg-primary/20 text-primary text-[8px] font-bold">
            {vendorName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
      )}
      <span>{vendorName}</span>
    </Link>
  );
};

export default VendorMention;
