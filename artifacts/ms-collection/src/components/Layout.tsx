import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  FilePlus,
  History,
  Settings,
  DollarSign,
  Plus,
} from "lucide-react";
import { motion } from "framer-motion";
import logoSrc from "../assets/logo.png";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/create", label: "Buat Nota", icon: FilePlus },
  { href: "/history", label: "Riwayat", icon: History },
  { href: "/financial", label: "Keuangan", icon: DollarSign },
  { href: "/settings", label: "Pengaturan", icon: Settings },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();

  // Lock screen gets a full-screen layout without navigation chrome
  if (location === "/lock") {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop Sidebar */}
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
            const Icon = item.icon!;
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
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-sidebar/95 backdrop-blur-md border-b border-border flex items-center gap-3 px-4 py-3">
        <img src={logoSrc} alt="MS Collection Logo" className="w-8 h-8 object-contain" />
        <div>
          <p className="text-sm font-semibold text-sidebar-foreground leading-none">MS Collection</p>
          <p className="text-xs text-muted-foreground">Manajemen Nota</p>
        </div>
      </div>

      {/* Mobile Floating Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none pb-3 px-4">
        <nav className="pointer-events-auto bg-sidebar/90 backdrop-blur-xl border border-border/50 rounded-2xl shadow-2xl shadow-black/20 flex items-center justify-around px-2 py-1.5 max-w-sm w-full" style={{ paddingBottom: "env(safe-area-inset-bottom, 6px)" }}>
          {/* Dashboard */}
          <Link href="/" className="flex-1">
            <div className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors rounded-lg px-2",
              location === "/" ? "text-primary" : "text-muted-foreground/70 hover:text-muted-foreground"
            )}>
              <LayoutDashboard className={cn("w-5 h-5", location === "/" && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
              <span>Dashboard</span>
            </div>
          </Link>

          {/* Riwayat */}
          <Link href="/history" className="flex-1">
            <div className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors rounded-lg px-2",
              location === "/history" ? "text-primary" : "text-muted-foreground/70 hover:text-muted-foreground"
            )}>
              <History className={cn("w-5 h-5", location === "/history" && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
              <span>Riwayat</span>
            </div>
          </Link>

          {/* Center - BUAT NOTA FAB */}
          <Link href="/create" className="shrink-0 -mt-4">
            <div className="w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-xl shadow-primary/30 hover:shadow-2xl hover:shadow-primary/40 hover:scale-105 active:scale-95 transition-all duration-200 cursor-pointer">
              <Plus className="w-7 h-7" />
            </div>
          </Link>

          {/* Keuangan */}
          <Link href="/financial" className="flex-1">
            <div className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors rounded-lg px-2",
              location === "/financial" ? "text-primary" : "text-muted-foreground/70 hover:text-muted-foreground"
            )}>
              <DollarSign className={cn("w-5 h-5", location === "/financial" && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
              <span>Keuangan</span>
            </div>
          </Link>

          {/* Pengaturan */}
          <Link href="/settings" className="flex-1">
            <div className={cn(
              "flex flex-col items-center gap-0.5 py-1.5 text-[10px] font-medium transition-colors rounded-lg px-2",
              location === "/settings" ? "text-primary" : "text-muted-foreground/70 hover:text-muted-foreground"
            )}>
              <Settings className={cn("w-5 h-5", location === "/settings" && "drop-shadow-[0_0_6px_hsl(var(--primary))]")} />
              <span>Pengaturan</span>
            </div>
          </Link>
        </nav>
      </div>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-24 md:pb-0 pt-14 md:pt-0">
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