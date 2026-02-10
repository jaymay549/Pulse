import { Outlet } from "react-router-dom";
import { useState } from "react";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useClerkAuth } from "@/hooks/useClerkAuth";
import AdminSidebar from "./AdminSidebar";

const AdminLayout = () => {
  const { user } = useClerkAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex">
      {/* Desktop sidebar */}
      <div className="hidden lg:flex">
        <AdminSidebar />
      </div>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-zinc-950 border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
          <SheetTrigger asChild>
            <button className="text-zinc-400 hover:text-zinc-100">
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <span className="text-sm font-bold text-zinc-100 tracking-wide uppercase">
            CDG Admin
          </span>
          <div className="w-5" />
        </div>
        <SheetContent side="left" className="p-0 w-56 bg-zinc-950 border-zinc-800">
          <AdminSidebar />
        </SheetContent>
      </Sheet>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar (desktop) */}
        <header className="hidden lg:flex items-center justify-end px-6 py-3 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-400">{user?.name || user?.email}</span>
            {user?.imageUrl && (
              <img
                src={user.imageUrl}
                alt=""
                className="h-7 w-7 rounded-full ring-1 ring-zinc-700"
              />
            )}
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto p-6 lg:pt-6 pt-16">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
