import { Link, Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
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
  Store,
  TrendingUp,
  TrendingDown,
  UserCheck,
  FileText,
} from "lucide-react";
import cpLogo from "@/assets/cp-logo.png";

type NavItem = { to: string; icon: any; key: any; adminOnly?: boolean; writeOnly?: boolean };

type SearchObj = Record<string, string>;
const nav: (NavItem & { search?: SearchObj })[] = [
  { to: "/dashboard", icon: LayoutDashboard, key: "dashboard" },
  { to: "/daily-accounts", icon: Receipt, key: "dailyAccounts" },
  { to: "/expenses", icon: Wallet, key: "expenses" },
  { to: "/other-income", icon: Coins, key: "otherIncome" },
  { to: "/jama-khoroch", icon: BookOpen, key: "jamaKhoroch", writeOnly: true },
  { to: "/daily-report", icon: FileText, key: "dailyReport" },
  { to: "/daily-income", icon: TrendingUp, key: "dailyIncome" },
  { to: "/daily-expense", icon: TrendingDown, key: "dailyExpense" },
  { to: "/vehicles", icon: Bus, key: "vehicles" },
  { to: "/routes", icon: RouteIcon, key: "routes" },
  { to: "/owners", icon: Users, key: "owners" },
  { to: "/owner-accounts", icon: UserCheck, key: "ownerAccounts" },
  { to: "/vendors", icon: Store, key: "vendors" },
  { to: "/data-bank", icon: UserCheck, key: "supervisorDb", search: { tab: "sup" } },
  { to: "/data-manufacturer", icon: Factory, key: "dataManufacturer", writeOnly: true },
  { to: "/data-bank", icon: Database, key: "dataBank" },
  { to: "/reports", icon: FileBarChart, key: "reports" },
  { to: "/admin", icon: ShieldCheck, key: "admin", adminOnly: true },
];


function Watermark({ theme }: { theme: string }) {
  const lineColor =
    theme === "dark"
      ? "color-mix(in oklab, var(--foreground) 5%, transparent)"
      : "color-mix(in oklab, var(--foreground) 7%, transparent)";
  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 -z-0"
      style={{
        backgroundColor: "var(--background)",
        backgroundImage: `linear-gradient(to right, ${lineColor} 1px, transparent 1px), linear-gradient(to bottom, ${lineColor} 1px, transparent 1px)`,
        backgroundSize: "28px 28px, 28px 28px",
      }}
    />
  );
}

const SIDEBAR_BG_LIGHT = "#ffffff";
const SIDEBAR_BG_DARK = "var(--background)";
const SIDEBAR_GRID =
  "linear-gradient(to right, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 6%, transparent) 1px, transparent 1px)";


export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { role, isAdmin, canWrite, isOwner, loading: roleLoading } = useRole();
  const navigate = useNavigate();
  const { t, lang, setLang } = useT();
  const { theme, toggle: toggleTheme } = useTheme();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Owners can VIEW every page except admin; only canWrite users see writeOnly pages too.
  const visibleNav = nav.filter((n) => (!n.adminOnly || isAdmin) && (!n.writeOnly || canWrite || isOwner));

  const handleLogout = async () => {
    // Always clear the local session even if the server call fails (expired/broken token).
    try {
      await supabase.auth.signOut();
    } catch {
      /* ignore */
    }
    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      /* ignore */
    }
    try {
      Object.keys(localStorage)
        .filter((k) => k.startsWith("sb-"))
        .forEach((k) => localStorage.removeItem(k));
    } catch {
      /* ignore */
    }
    window.location.href = "/login";
  };

  useEffect(() => {
    if (!loading && !user) navigate({ to: "/login" });
  }, [user, loading, navigate]);

  if (!loading && !user) {
    return <Navigate to="/login" />;
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="relative flex min-h-screen bg-background">
      <Watermark theme={theme} />
      <aside
        className="hidden md:flex w-64 flex-col relative z-10"
        style={{
          backgroundImage: `${SIDEBAR_GRID}, linear-gradient(180deg, ${theme === "dark" ? SIDEBAR_BG_DARK : SIDEBAR_BG_LIGHT}, ${theme === "dark" ? SIDEBAR_BG_DARK : SIDEBAR_BG_LIGHT})`,
          backgroundSize: "28px 28px, 28px 28px, 100% 100%",
          color: theme === "dark" ? "#e2e8f0" : "#0f172a",
          borderRight: "1px solid color-mix(in oklab, var(--foreground) 12%, transparent)",
        }}
      >
        <div className="px-4 py-5 border-b border-black/10 dark:border-white/10 flex items-center gap-3">
          <img
            src={cpLogo}
            alt="CP"
            className="h-12 w-12 object-contain flex-shrink-0"
            style={{ filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))" }}
          />
          <div className="min-w-0">
            <h1 className="brand-marble text-2xl leading-tight truncate">{t("brand")}</h1>
            <p className="text-[11px] text-slate-700/90 dark:text-slate-300/80 leading-tight truncate">{t("tagline")}</p>
            <p className="mt-1 inline-flex rounded border border-cyan-700/40 dark:border-cyan-300/30 bg-cyan-200/40 dark:bg-cyan-300/10 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-900 dark:text-cyan-200">
              {roleLoading ? t("loading") : role === "admin" ? t("admin") : role === "moderator" ? t("moderator") : role === "shareholder" ? t("guestReadOnly") : t("loggedIn")}
            </p>
            <p className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-400 truncate">{user.email}</p>
          </div>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map((n) => {
            const Icon = n.icon;
            const active = pathname === n.to || (n.to !== "/dashboard" && pathname.startsWith(n.to));
            return (
              <Link
                key={n.key}
                to={n.to}
                search={n.search as any}
                className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                  active
                    ? "bg-slate-300/70 dark:bg-cyan-400/15 text-slate-900 dark:text-cyan-200 border-l-2 border-slate-500 dark:border-cyan-300 font-semibold"
                    : "text-slate-900/85 dark:text-slate-200/90 hover:bg-slate-200/80 dark:hover:bg-white/5 border-l-2 border-transparent"
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{t(n.key)}</span>
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-black/10 dark:border-white/10 space-y-2">
          <Button variant="outline" size="sm" className="w-full bg-white/70 dark:bg-white/5 border-black/20 dark:border-white/15 text-slate-900 dark:text-slate-100 hover:bg-white" onClick={toggleTheme}>
            {theme === "dark" ? <Sun className="h-4 w-4 mr-2" /> : <Moon className="h-4 w-4 mr-2" />}
            {theme === "dark" ? (lang === "bn" ? "লাইট মুড" : "Light") : (lang === "bn" ? "ডার্ক মুড" : "Dark")}
          </Button>
          <Button variant="outline" size="sm" className="w-full bg-white/70 dark:bg-white/5 border-black/20 dark:border-white/15 text-slate-900 dark:text-slate-100 hover:bg-white" onClick={() => setLang(lang === "bn" ? "en" : "bn")}>
            <Languages className="h-4 w-4 mr-2" />
            {lang === "bn" ? "English" : "বাংলা"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start text-slate-900 dark:text-slate-200 hover:bg-black/5 dark:hover:bg-white/5"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4 mr-2" />
            {t("logout")}
          </Button>
        </div>
      </aside>


      <div className="flex-1 flex flex-col min-w-0 relative z-10">
        <header className="md:hidden flex items-center justify-between border-b px-4 py-3 bg-card/80 backdrop-blur">
          <div>
            <h1 className="brand-marble text-lg">{t("brand")}</h1>
            <p className="text-[10px] text-muted-foreground">
              {roleLoading ? t("loading") : role === "admin" ? t("admin") : role === "moderator" ? t("moderator") : role === "shareholder" ? t("guestReadOnly") : t("loggedIn")}
              {user.email ? ` • ${user.email}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={toggleTheme} aria-label="theme">
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setLang(lang === "bn" ? "en" : "bn")}>
              {lang === "bn" ? "EN" : "বাং"}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>
        <main className="flex-1 overflow-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
          <footer className="mt-8 pt-6 text-[11px] text-muted-foreground bg-transparent">
            <div className="border-t border-slate-800/40 dark:border-slate-200/10 max-w-7xl mx-auto px-4 my-6" />
            <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
              <div className="tracking-wide">
                {lang === "bn" ? (
                  <>&copy; ২০২৬ <span className="text-foreground/70 font-medium">চন্দ্রা পরিবহন</span>। সর্বস্বত্ব সংরক্ষিত।</>
                ) : (
                  <>&copy; 2026 <span className="text-foreground/70 font-medium">Chandra Paribahan</span>. All Rights Reserved.</>
                )}
              </div>
              <div className="flex space-x-6">
                <a href="#" className="hover:text-foreground/80 transition-colors">{lang === "bn" ? "শর্তাবলী" : "Terms of Service"}</a>
                <a href="#" className="hover:text-foreground/80 transition-colors">{lang === "bn" ? "গোপনীয়তা নীতি" : "Privacy Policy"}</a>
              </div>
              <div className="flex items-center bg-transparent px-4 py-2 rounded-lg border border-slate-800/40 dark:border-slate-200/15 shadow-inner backdrop-blur-sm">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                <span className="mr-1">{lang === "bn" ? "পরিকল্পনা, ডিজাইন এন্ড ডেভেলপড বাই" : "Designed & Developed by"}</span>
                <span className="text-blue-500 dark:text-blue-400 font-semibold tracking-wider hover:text-blue-400 transition-colors cursor-pointer">
                  {lang === "bn" ? "জায়িম ভুইয়া" : "Zayem Bhuiya"}
                </span>
              </div>
            </div>
          </footer>
        </main>
      </div>

      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card/95 backdrop-blur flex overflow-x-auto z-20">
        {visibleNav.map((n) => {
          const Icon = n.icon;
          const active = pathname === n.to;
          return (
            <Link
              key={n.key}
              to={n.to}
              search={n.search as any}
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
