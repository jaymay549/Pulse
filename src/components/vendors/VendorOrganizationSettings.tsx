import { OrganizationProfile } from "@clerk/clerk-react";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { CreditCard, ExternalLink } from "lucide-react";

export default function VendorOrganizationSettings() {
  const { vendorTier, vendorNames, membership, user } = useVendorAuth();
  const membershipRole = (membership?.role || "").toLowerCase();
  const isOrgAdmin =
    membershipRole === "org:admin" ||
    membershipRole === "admin" ||
    membershipRole.endsWith(":admin");
  const email = user?.primaryEmailAddress?.emailAddress;
  const vendorBillingUrl = email
    ? `${import.meta.env.VITE_STRIPE_PORTAL_URL}?prefilled_email=${encodeURIComponent(email)}`
    : import.meta.env.VITE_STRIPE_PORTAL_URL;

  return (
    <OrganizationProfile
      appearance={{
        elements: {
          rootBox: "w-full",
          card: "bg-zinc-900 border border-zinc-800 shadow-none rounded-lg",
        },
      }}
    >
      <OrganizationProfile.Page
        label="Subscription"
        labelIcon={<CreditCard className="w-4 h-4" />}
        url="subscription"
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-xs text-zinc-500">Current Plan</div>
              <div className="text-sm font-medium capitalize">
                {vendorTier || "No plan"}
              </div>
            </div>
            {isOrgAdmin ? (
              <a
                href={vendorBillingUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg bg-[#FFD700] text-zinc-900 hover:bg-yellow-400 transition-colors"
              >
                Manage Vendor Subscription <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <p className="text-sm text-zinc-400 max-w-xs">
                Only organization admins can manage vendor billing.
              </p>
            )}
          </div>
          <div>
            <div className="text-xs text-zinc-500">Tracked Vendors</div>
            <div className="text-sm font-medium">
              {vendorNames.length > 0 ? vendorNames.join(", ") : "None assigned"}
            </div>
            <a
              href="mailto:circles@cardealershipguy.com"
              className="inline-flex items-center gap-2 mt-2 text-sm font-medium px-4 py-2 rounded-lg bg-[#FFD700] text-zinc-900 hover:bg-yellow-400 transition-colors"
            >
              Edit vendors
            </a>
          </div>
        </div>
      </OrganizationProfile.Page>
    </OrganizationProfile>
  );
}
