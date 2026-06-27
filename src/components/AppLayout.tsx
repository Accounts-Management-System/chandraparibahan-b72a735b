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
          <footer className="mt-12 pt-16 pb-8 font-sans border-t-4 border-blue-600 text-gray-600 dark:text-gray-300 bg-transparent">
            <div className="max-w-7xl mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8 mb-12">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold text-foreground tracking-wide">
                  {lang === "bn" ? <>চন্দ্রা <span className="text-blue-500">পরিবহন</span></> : <>CHANDRA <span className="text-blue-500">PARIBAHAN</span></>}
                </h2>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {lang === "bn"
                    ? "আপনার নিরাপদ ও আরামদায়ক ভ্রমণের বিশ্বস্ত সঙ্গী। আমরা দেশজুড়ে আধুনিক ও উন্নত বাস সেবা নিশ্চিত করতে প্রতিশ্রুতিবদ্ধ।"
                    : "Your trusted partner for safe and comfortable travel. We are committed to ensuring modern and superior bus service nationwide."}
                </p>
                <div className="flex space-x-4 pt-2">
                  <a href="#" aria-label="Facebook" className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800/60 flex items-center justify-center hover:bg-blue-600 hover:text-white transition-all">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z"/></svg>
                  </a>
                  <a href="#" aria-label="Twitter" className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800/60 flex items-center justify-center hover:bg-blue-400 hover:text-white transition-all">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23 3a10.9 10.9 0 0 1-3.14 1.53A4.48 4.48 0 0 0 12 8.5v1A10.66 10.66 0 0 1 3 4s-4 9 5 13a11.64 11.64 0 0 1-7 2c9 5 20 0 20-11.5a4.5 4.5 0 0 0-.08-.83A7.72 7.72 0 0 0 23 3z"/></svg>
                  </a>
                  <a href="#" aria-label="YouTube" className="w-8 h-8 rounded-full bg-slate-200/60 dark:bg-slate-800/60 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                  </a>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 border-b-2 border-blue-500 pb-2 inline-block">{lang === "bn" ? "কুইক লিঙ্ক" : "Quick Links"}</h3>
                <ul className="space-y-2 text-sm">
                  <li><Link to="/dashboard" className="hover:text-blue-400 transition-colors">{lang === "bn" ? "হোম পেজ" : "Home"}</Link></li>
                  <li><Link to="/daily-accounts" className="hover:text-blue-400 transition-colors">{lang === "bn" ? "দৈনিক জমা" : "Daily Accounts"}</Link></li>
                  <li><Link to="/routes" className="hover:text-blue-400 transition-colors">{lang === "bn" ? "রুট ও সময়সূচী" : "Routes & Schedule"}</Link></li>
                  <li><Link to="/reports" className="hover:text-blue-400 transition-colors">{lang === "bn" ? "রিপোর্ট" : "Reports"}</Link></li>
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 border-b-2 border-blue-500 pb-2 inline-block">{lang === "bn" ? "আমাদের সেবাসমূহ" : "Our Services"}</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {(lang === "bn"
                    ? ["এসি ও নন-এসি লাক্সারি বাস", "২৪/৭ অনলাইন ট্র্যাকিং সিস্টেম", "দক্ষ ও প্রশিক্ষিত চালক", "নিরাপদ ও সময়োপযোগী যাত্রা"]
                    : ["AC & Non-AC Luxury Buses", "24/7 Online Tracking System", "Skilled & Trained Drivers", "Safe & Timely Journeys"]
                  ).map((s) => (
                    <li key={s} className="flex items-center"><span className="w-2 h-2 bg-blue-500 rounded-full mr-2" /> {s}</li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-foreground mb-4 border-b-2 border-blue-500 pb-2 inline-block">{lang === "bn" ? "যোগাযোগ" : "Contact"}</h3>
                <ul className="space-y-3 text-sm text-muted-foreground">
                  <li className="flex items-start"><span className="mr-2 text-blue-500">📍</span><span>{lang === "bn" ? "প্রধান কার্যালয়, ঢাকা, বাংলাদেশ" : "Head Office, Dhaka, Bangladesh"}</span></li>
                  <li className="flex items-center"><span className="mr-2 text-blue-500">📞</span><span>{lang === "bn" ? "+৮৮০ ১৭১২-৮১১১১৮" : "+880 1712-811118"}</span></li>
                  <li className="flex items-center"><span className="mr-2 text-blue-500">✉️</span><span>info@chandraparibahan.com</span></li>
                </ul>
              </div>
            </div>

            <div className="border-t border-slate-300/40 dark:border-slate-800/60 max-w-7xl mx-auto px-4 my-6" />

            <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center text-xs text-muted-foreground gap-4">
              <div className="tracking-wide">
                {lang === "bn" ? (
                  <>&copy; ২০২৬ <span className="text-foreground/80 font-medium">চন্দ্রা পরিবহন</span>। সর্বস্বত্ব সংরক্ষিত।</>
                ) : (
                  <>&copy; 2026 <span className="text-foreground/80 font-medium">Chandra Paribahan</span>. All Rights Reserved.</>
                )}
              </div>
              <div className="flex items-center bg-transparent px-4 py-2 rounded-lg border border-slate-300/40 dark:border-slate-800/60 shadow-inner backdrop-blur-sm">
                <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse" />
                <span className="mr-1">{lang === "bn" ? "ওয়েবসাইট ডিজাইন এন্ড ডেভেলপড বাই" : "Website Designed & Developed by"}</span>
                <span className="text-blue-500 dark:text-blue-400 font-semibold tracking-wider hover:text-blue-300 transition-colors cursor-pointer">
                  {lang === "bn" ? "জায়িম ভুইয়া।" : "Zayem Bhuiya."}
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
