import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { useRole } from "@/lib/useRole";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/lib/theme";
import {
  LayoutDashboard,
  Receipt,
  Wallet,
  Coins,
  Bus,
  Route as RouteIcon,
  Users,
  Database,
  FileBarChart,
  LogOut,
  Languages,
  Factory,
  ShieldCheck,
  BookOpen,
  Sun,
  Moon,
} from "lucide-react";

type NavItem = { to: string; icon: any; key: any; adminOnly?: boolean; writeOnly?: boolean };

const nav: NavItem[] = [
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { to: "/daily-accounts", icon: Receipt, key: "dailyAccounts" },
  { to: "/jama-khoroch", icon: BookOpen, key: "jamaKhoroch", adminOnly: true },
  { to: "/expenses", icon: Wallet, key: "expenses" },
  { to: "/other-income", icon: Coins, key: "otherIncome" },
  { to: "/vehicles", icon: Bus, key: "vehicles" },
  { to: "/owners", icon: Users, key: "owners" },
  { to: "/routes", icon: RouteIcon, key: "routes" },
  { to: "/data-manufacturer", icon: Factory, key: "dataManufacturer", writeOnly: true },
  { to: "/data-bank", icon: Database, key: "dataBank" },
  { to: "/reports", icon: FileBarChart, key: "reports" },
  { to: "/admin", icon: ShieldCheck, key: "admin", adminOnly: true },
];


function Watermark() {
  // Light vector watermark — bus silhouette + road lines
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 overflow-hidden -z-0 opacity-[0.04]"
    >
      <svg
        className="absolute -right-20 -bottom-20 w-[640px] h-[640px] text-primary"
        viewBox="0 0 200 200"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.2"
      >
        <rect x="20" y="60" width="160" height="70" rx="10" />
        <rect x="30" y="72" width="40" height="28" />
        <rect x="78" y="72" width="40" height="28" />
        <rect x="126" y="72" width="40" height="28" />
        <circle cx="55" cy="138" r="14" />
        <circle cx="145" cy="138" r="14" />
        <path d="M0 165 H200 M0 175 H200 M0 185 H200" strokeDasharray="6 8" />
      </svg>
      <svg
        className="absolute -left-24 -top-24 w-[520px] h-[520px] text-primary-glow"
        viewBox="0 0 100 100"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.4"
      >
        {Array.from({ length: 20 }).map((_, i) => (
          <circle key={i} cx="50" cy="50" r={2 + i * 2.4} />
        ))}
      </svg>
    </div>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { role, isAdmin, canWrite } = useRole();
  const navigate = useNavigate();
  const { t, lang, setLang } = useT();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const visibleNav = nav.filter((n) => (!n.adminOnly || isAdmin) && (!n.writeOnly || canWrite));

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen bg-background">
      <Watermark />
      <aside className="hidden md:flex w-60 flex-col border-r bg-card/80 backdrop-blur relative z-10">
        <div className="px-4 py-5 border-b">
          <h1 className="text-lg font-bold text-primary">{t("brand")}</h1>
          <p className="text-xs text-muted-foreground">{t("tagline")}</p>
          <p className="mt-2 inline-flex rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-[11px] font-semibold text-primary">
            {role === "admin" ? t("admin") : role === "moderator" ? t("moderator") : role === "shareholder" ? t("guestReadOnly") : t("loggedIn")}
          </p>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          {visibleNav.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to || (n.to !== "/dashboard" && pathname.startsWith(n.to));
            return (
              <Link
                key={n.to}
                to={n.to}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t(n.key)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t space-y-2">
          <Button variant="outline" size="sm" className="w-full" onClick={() => setLang(lang === "bn" ? "en" : "bn")}>
            <Languages className="h-4 w-4 mr-2" />
            {lang === "bn" ? "English" : "বাংলা"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start"
            onClick={async () => {
              await supabase.auth.signOut();
              navigate({ to: "/login" });
            }}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t("logout")}
          </Button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="md:hidden flex items-center justify-between border-b px-4 py-3 bg-card/80 backdrop-blur">
          <div>
            <h1 className="font-bold text-primary">{t("brand")}</h1>
            <p className="text-[10px] text-muted-foreground">
              {role === "admin" ? t("admin") : role === "moderator" ? t("moderator") : role === "shareholder" ? t("guestReadOnly") : t("loggedIn")}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setLang(lang === "bn" ? "en" : "bn")}>
              {lang === "bn" ? "EN" : "বাং"}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                navigate({ to: "/login" });
              }}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">{children}</main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur flex overflow-x-auto z-20">
        {visibleNav.map((n) => {
          const Icon = n.icon;
          const active = pathname === n.to;
          return (
            <Link
              key={n.to}
              to={n.to}
              className={`flex-shrink-0 flex flex-col items-center px-3 py-2 text-[10px] ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4 mb-1" />
              {t(n.key)}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
