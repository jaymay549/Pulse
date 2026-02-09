import { OrganizationProfile } from "@clerk/clerk-react";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import { ExternalLink } from "lucide-react";

export default function VendorSettings() {
  const { vendorTier, vendorNames } = useVendorAuth();

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Manage your organization and subscription.
        </p>
      </div>

      {/* Subscription Info */}
      <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/50 space-y-4">
        <h2 className="text-lg font-semibold">Subscription</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-zinc-500">Current Plan</div>
            <div className="text-sm text-white font-medium capitalize">
              {vendorTier || "No plan"}
            </div>
          </div>
          <div>
            <div className="text-xs text-zinc-500">Tracked Vendors</div>
            <div className="text-sm text-white font-medium">
              {vendorNames.length > 0 ? vendorNames.join(", ") : "None assigned"}
            </div>
          </div>
        </div>
        <a
          href="https://billing.stripe.com/p/login/test_placeholder"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 text-sm text-[#FFD700] hover:text-yellow-400"
        >
          Manage Subscription <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Organization Management */}
      <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/50 space-y-4">
        <h2 className="text-lg font-semibold">Organization</h2>
        <p className="text-sm text-zinc-400">
          Manage team members and organization settings.
        </p>
        <OrganizationProfile
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-zinc-900 border-zinc-800 shadow-none",
            },
          }}
        />
      </div>
    </div>
  );
}
