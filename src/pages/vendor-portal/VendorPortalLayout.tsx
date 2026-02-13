import { Outlet, Link, useLocation, Navigate } from "react-router-dom";
import { OrganizationSwitcher, UserButton } from "@clerk/clerk-react";
import { useVendorAuth } from "@/hooks/useVendorAuth";
import {
  LayoutDashboard,
  MessageSquare,
  Bell,
  Settings,
  Loader2,
  ShieldCheck,
  CreditCard,
  Building2,
} from "lucide-react";

export default function VendorPortalLayout() {
  const { isLoaded, isSignedIn, accessStatus, isPro, organization } = useVendorAuth();

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <Navigate to="/vendor-portal/auth" replace />;
  }

  // Gate screens for non-active vendors
  if (accessStatus !== "active") {
    return (
      <div className="min-h-screen bg-zinc-950 text-white flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto">
            {accessStatus === "no_org" ? (
              <Building2 className="w-8 h-8 text-zinc-400" />
            ) : accessStatus === "pending_verification" ? (
              <ShieldCheck className="w-8 h-8 text-yellow-500" />
            ) : (
              <CreditCard className="w-8 h-8 text-zinc-400" />
            )}
          </div>

          {accessStatus === "no_org" && (
            <>
              <h1 className="text-2xl font-bold">No Organization Found</h1>
              <p className="text-zinc-400">
                Contact CDG to get your vendor organization set up. Once your organization
                is created, you'll receive an invitation to join.
              </p>
              <a
                href="mailto:support@cdgpulse.com"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFD700] text-zinc-900 rounded-lg font-semibold hover:bg-yellow-400 transition-colors"
              >
                Contact CDG
              </a>
            </>
          )}

          {accessStatus === "pending_verification" && (
            <>
              <h1 className="text-2xl font-bold">Verification Pending</h1>
              <p className="text-zinc-400">
                Your subscription is active! A CDG administrator is reviewing your
                organization to verify your identity. You'll gain access once verified.
              </p>
              <div className="flex items-center justify-center gap-2 text-yellow-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Awaiting verification</span>
              </div>
            </>
          )}

          {(accessStatus === "not_paid" || accessStatus === "not_paid_not_verified") && (
            <>
              <h1 className="text-2xl font-bold">Subscription Required</h1>
              <p className="text-zinc-400">
                Choose a plan to access the vendor portal. Your subscription gives you
                real-time access to what dealers are saying about your brand.
              </p>
              <Link
                to="/vendors"
                className="inline-flex items-center gap-2 px-6 py-3 bg-[#FFD700] text-zinc-900 rounded-lg font-semibold hover:bg-yellow-400 transition-colors"
              >
                View Plans
              </Link>
            </>
          )}

          <div className="pt-4">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex">
      {/* Sidebar */}
      <aside className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col">
        <div className="p-4 border-b border-zinc-800">
          <Link to="/vendor-portal/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#FFD700] flex items-center justify-center">
              <span className="text-zinc-900 font-bold text-sm">VP</span>
            </div>
            <div>
              <div className="text-sm font-semibold">Vendor Portal</div>
              <div className="text-xs text-zinc-500">{organization?.name}</div>
            </div>
          </Link>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          <NavLink to="/vendor-portal/dashboard" icon={LayoutDashboard} label="Dashboard" />
          <NavLink
            to="/vendor-portal/reviews"
            icon={MessageSquare}
            label="Reviews & Responses"
            badge={isPro ? undefined : "Pro"}
          />
          <NavLink
            to="/vendor-portal/alerts"
            icon={Bell}
            label="Alerts"
            badge="Soon"
          />
          <NavLink to="/vendor-portal/settings" icon={Settings} label="Settings" />
        </nav>

        <div className="p-3 border-t border-zinc-800 space-y-3">
          <OrganizationSwitcher
            hidePersonal
            appearance={{
              elements: {
                rootBox: "w-full",
                organizationSwitcherTrigger: "w-full justify-start text-zinc-400 hover:text-white",
              },
            }}
          />
          <div className="flex items-center gap-2">
            <UserButton afterSignOutUrl="/" />
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-6">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

function NavLink({
  to,
  icon: Icon,
  label,
  badge,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  badge?: string;
}) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? "bg-zinc-800 text-white font-medium"
          : "text-zinc-400 hover:text-white hover:bg-zinc-800/50"
      }`}
    >
      <Icon className="w-4 h-4" />
      <span className="flex-1">{label}</span>
      {badge && (
        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
          badge === "Pro" ? "bg-purple-900/50 text-purple-300" : "bg-zinc-700 text-zinc-400"
        }`}>
          {badge}
        </span>
      )}
    </Link>
  );
}
