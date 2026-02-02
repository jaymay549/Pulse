import { useUser } from "@clerk/clerk-react";
import {
  Crown,
  Star,
  Users,
  CreditCard,
  ExternalLink,
  AlertTriangle,
  Check,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";
type ClerkUserTier = "pro" | "community" | "free" | "executive";

interface CirclesMetadata {
  circles?: {
    tier: ClerkUserTier;
    status: SubscriptionStatus;
  };
}

const tierConfig = {
  free: {
    name: "Community",
    description: "Basic access to CDG Circles",
    icon: Users,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-muted",
    benefits: [
      "Access to community discussions",
      "Limited vendor reviews",
      "Basic dealer networking",
    ],
  },
  community: {
    name: "Community",
    description: "Basic access to CDG Circles",
    icon: Users,
    color: "text-muted-foreground",
    bgColor: "bg-muted",
    borderColor: "border-muted",
    benefits: [
      "Access to community discussions",
      "Limited vendor reviews",
      "Basic dealer networking",
    ],
  },
  pro: {
    name: "Pro",
    description: "Full access to dealer intelligence",
    icon: Star,
    color: "text-primary",
    bgColor: "bg-primary/10",
    borderColor: "border-primary/30",
    benefits: [
      "Unlimited vendor reviews",
      "Focused topic chats",
      "OEM dealer chats by franchise",
      "Monthly roundtables with your cohort",
    ],
  },
  executive: {
    name: "Executive",
    description: "Elite dealer network access",
    icon: Crown,
    color: "text-yellow-600",
    bgColor: "bg-yellow-500/10",
    borderColor: "border-yellow-500/30",
    benefits: [
      "Private dealer circles (curated matching)",
      "Elite dealer network access",
      "Executive Retreat 2026 access",
      "Full vendor intel access",
      "Priority support & early access",
    ],
  },
};

const statusConfig: Record<
  SubscriptionStatus,
  { label: string; color: string; bgColor: string; showWarning: boolean }
> = {
  active: {
    label: "Active",
    color: "text-green-600",
    bgColor: "bg-green-500/10",
    showWarning: false,
  },
  past_due: {
    label: "Past Due",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    showWarning: true,
  },
  canceled: {
    label: "Canceled",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    showWarning: true,
  },
  unpaid: {
    label: "Unpaid",
    color: "text-red-600",
    bgColor: "bg-red-500/10",
    showWarning: true,
  },
  paused: {
    label: "Paused",
    color: "text-yellow-600",
    bgColor: "bg-yellow-500/10",
    showWarning: true,
  },
};

const SubscriptionManagement = () => {
  const { user } = useUser();

  if (!user) {
    return (
      <div className="p-6 text-center text-muted-foreground">Loading...</div>
    );
  }

  const metadata = user.publicMetadata as CirclesMetadata;
  const tier: ClerkUserTier = metadata?.circles?.tier || "free";
  const status: SubscriptionStatus = metadata?.circles?.status || "active";
  const config = tierConfig[tier];
  const statusInfo = statusConfig[status];
  const TierIcon = config.icon;

  const isPaidTier = tier === "pro" || tier === "executive";
  const email = user.primaryEmailAddress?.emailAddress;

  const handleManageSubscription = () => {
    if (!email) return;
    const portalUrl = `${
      import.meta.env.VITE_STRIPE_PORTAL_URL
    }?prefilled_email=${encodeURIComponent(email)}`;
    window.open(portalUrl, "_blank");
  };

  return (
    <div className="space-y-6">
      {/* Warning Banner for problematic statuses */}
      {statusInfo.showWarning && (
        <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 border border-red-200">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-red-900">
              {status === "past_due" && "Your payment is past due"}
              {status === "canceled" && "Your subscription has been canceled"}
              {status === "unpaid" && "Your subscription is unpaid"}
              {status === "paused" && "Your subscription is paused"}
            </p>
            <p className="text-sm text-red-700 mt-1">
              {status === "past_due" &&
                "Please update your payment method to maintain access."}
              {status === "canceled" &&
                "Your access will end at the end of your billing period."}
              {status === "unpaid" &&
                "Please update your payment method to restore access."}
              {status === "paused" &&
                "Resume your subscription to regain full access."}
            </p>
          </div>
        </div>
      )}

      {/* Current Plan Card */}
      <div
        className={`p-6 rounded-xl border-2 ${config.borderColor} ${config.bgColor}`}
      >
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div
              className={`p-2.5 rounded-full ${config.bgColor} border ${config.borderColor}`}
            >
              <TierIcon className={`h-6 w-6 ${config.color}`} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-foreground">
                {config.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {config.description}
              </p>
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bgColor} ${statusInfo.color}`}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Benefits List */}
        <div className="mt-4">
          <h4 className="text-sm font-medium text-foreground mb-2">
            Your benefits
          </h4>
          <ul className="space-y-2">
            {config.benefits.map((benefit, index) => (
              <li
                key={index}
                className="flex items-center gap-2 text-sm text-muted-foreground"
              >
                <Check className={`h-4 w-4 ${config.color} flex-shrink-0`} />
                {benefit}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Actions */}
      <div className="space-y-3">
        {isPaidTier ? (
          <Button
            onClick={handleManageSubscription}
            className="w-full"
            variant="outline"
          >
            <CreditCard className="h-4 w-4 mr-2" />
            Manage Subscription
            <ExternalLink className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button
            onClick={handleManageSubscription}
            className="w-full"
            variant="default"
          >
            <Star className="h-4 w-4 mr-2" />
            Upgrade to Pro
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}

        {tier === "pro" && (
          <Button
            onClick={handleManageSubscription}
            variant="yellow"
            className="w-full"
          >
            <Crown className="h-4 w-4 mr-2" />
            Upgrade to Executive
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        )}
      </div>

      {/* Help Text */}
      <p className="text-xs text-center text-muted-foreground">
        Need help? Contact us at{" "}
        <a
          href="mailto:circles@cardealershipguy.com"
          className="text-primary hover:underline"
        >
          circles@cardealershipguy.com
        </a>
      </p>
    </div>
  );
};

export default SubscriptionManagement;
