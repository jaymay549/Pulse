import { Bell, Mail, AlertTriangle, ToggleLeft } from "lucide-react";

export default function VendorAlerts() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Alerts</h1>
        <p className="text-zinc-400 text-sm mt-1">
          Get notified when dealers mention your brand.
        </p>
      </div>

      {/* Coming Soon Overlay */}
      <div className="relative">
        <div className="absolute inset-0 bg-zinc-950/80 backdrop-blur-sm rounded-xl z-10 flex items-center justify-center">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center mx-auto">
              <Bell className="w-8 h-8 text-[#FFD700]" />
            </div>
            <h2 className="text-xl font-bold text-white">Coming Soon</h2>
            <p className="text-zinc-400 text-sm max-w-sm mx-auto">
              Email alerts for new mentions are being built. You'll be able to
              configure which types of reviews trigger notifications.
            </p>
          </div>
        </div>

        {/* Disabled Mockup */}
        <div className="space-y-4 opacity-50 pointer-events-none select-none">
          <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/50 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300">Alert Configuration</h3>

            <div className="space-y-3">
              <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                  <div>
                    <div className="text-sm text-zinc-200">Negative Reviews</div>
                    <div className="text-xs text-zinc-500">Get alerted for negative mentions</div>
                  </div>
                </div>
                <ToggleLeft className="w-8 h-8 text-zinc-600" />
              </div>

              <div className="flex items-center justify-between py-3 border-b border-zinc-800">
                <div className="flex items-center gap-3">
                  <Bell className="w-5 h-5 text-blue-400" />
                  <div>
                    <div className="text-sm text-zinc-200">All Reviews</div>
                    <div className="text-xs text-zinc-500">Get alerted for every mention</div>
                  </div>
                </div>
                <ToggleLeft className="w-8 h-8 text-zinc-600" />
              </div>
            </div>
          </div>

          <div className="border border-zinc-800 rounded-xl p-6 bg-zinc-900/50 space-y-4">
            <h3 className="text-sm font-semibold text-zinc-300">Notification Emails</h3>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 text-zinc-500" />
              <div className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-500">
                alerts@yourcompany.com
              </div>
              <button className="px-3 py-2 bg-zinc-800 text-zinc-500 rounded-lg text-sm">
                Add Email
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
