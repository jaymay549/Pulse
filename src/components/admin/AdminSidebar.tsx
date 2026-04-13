import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ListChecks,
  MessageSquare,
  Radio,
  CalendarClock,
  FileText,
  Settings,
  ArrowLeft,
  Sparkles,
  Send,
  Users,
  TrendingUp,
  Bug,
  BadgeCheck,
  Target,
  Store,
} from "lucide-react";

const navItems = [
  { to: "/admin", icon: LayoutDashboard, label: "Dashboard", end: true },
  { to: "/admin/sales-targets", icon: Target, label: "Sales Targets" },
  { to: "/admin/vendors", icon: Store, label: "Vendor Management" },
  { to: "/admin/chat", icon: Sparkles, label: "AI Chat" },
  { to: "/admin/queue", icon: ListChecks, label: "Vendor Queue" },
  { to: "/admin/claims", icon: BadgeCheck, label: "Claims" },
  { to: "/admin/topics", icon: MessageSquare, label: "Topics" },
  { to: "/admin/groups", icon: Radio, label: "Groups" },
  { to: "/admin/members", icon: Users, label: "Members" },
  { to: "/admin/tasks", icon: CalendarClock, label: "Tasks" },
  { to: "/admin/send", icon: Send, label: "Send Message" },
  { to: "/admin/prompts", icon: FileText, label: "Prompts" },
  { to: "/admin/trends", icon: TrendingUp, label: "Trends" },
  { to: "/admin/debug", icon: Bug, label: "Debug" },
  { to: "/admin/settings", icon: Settings, label: "Settings" },
];

const AdminSidebar = () => {
  return (
    <aside className="w-56 border-r border-zinc-800 bg-zinc-950 flex flex-col h-full">
      <div className="p-4 border-b border-zinc-800">
        <h2 className="text-sm font-bold text-zinc-100 tracking-wide uppercase">
          CDG Admin
        </h2>
      </div>

      <nav className="flex-1 p-2 space-y-0.5">
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-zinc-800 text-zinc-100"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900"
              }`
            }
          >
            <Icon className="h-4 w-4 flex-shrink-0" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="p-2 border-t border-zinc-800">
        <NavLink
          to="/vendors"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Pulse
        </NavLink>
      </div>
    </aside>
  );
};

export default AdminSidebar;
