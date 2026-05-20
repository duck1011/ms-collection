import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FilePlus,
  History,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import logoSrc from "../assets/logo.png";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Buat Nota", icon: FilePlus },
  { href: "/history", label: "Riwayat", icon: History },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-sidebar shrink-0">
        <div className="flex items-center gap-3 px-6 py-6 border-b border-border">
          <img src={logoSrc} alt="MS Collection Logo" className="w-9 h-9 object-contain" />
          <div>
            <p className="text-sm font-semibold text-sidebar-foreground leading-none">MS Collection</p>
            <p className="text-xs text-muted-foreground mt-0.5">Manajemen Nota</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = location === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href}>
                <div
                  data-testid={`nav-${item.href.replace("/", "") || "dashboard"}`}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer",
                    active
                      ? "bg-sidebar-primary text-sidebar-primary-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                  {item.label}
                </div>
              </Link>
            );
          })}
        </nav>

        <div className="px-6 py-4 border-t border-border">
          <p className="text-xs text-muted-foreground">© 2026 MS Collection</p>
        </div>
      </aside>

      {/* Mobile top header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar border-b border-border flex items-center gap-3 px-4 py-3">
        <img src={logoSrc} alt="MS Collection Logo" className="w-8 h-8 object-contain" />
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground leading-none">MS Collection</p>
          <p className="text-xs text-muted-foreground">Manajemen Nota</p>
        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-sidebar border-t border-border flex">
        {navItems.map((item) => {
          const active = location === item.href;
          const Icon = item.icon;
          return (
            <Link key={item.href} href={item.href} className="flex-1">
              <div
                className={cn(
                  "flex flex-col items-center gap-1 py-3 text-xs font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="w-5 h-5" />
                <span>{item.label}</span>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 md:pb-0 pt-14 md:pt-0">
        <motion.div
          key={location}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="min-h-full"
        >
          {children}
        </motion.div>
      </main>
    </div>
  );
}
