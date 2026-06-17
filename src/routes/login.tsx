import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { useT } from "@/lib/i18n";
import { signInWithLoginId } from "@/lib/auth.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Bus, Languages } from "lucide-react";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

type LoginRole = "admin" | "moderator" | "owner";

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t, lang, setLang } = useT();
  const [role, setRole] = useState<LoginRole>("admin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const signIn = useServerFn(signInWithLoginId);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard" });
  }, [user, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const loginId = email.trim();
      if (loginId.includes("@") && role !== "owner") {
        const { error } = await supabase.auth.signInWithPassword({ email: loginId, password });
        if (error) throw error;
      } else {
        const tokens = await signIn({ data: { loginId, password, role } });
        const { error } = await supabase.auth.setSession({
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
        });
        if (error) throw error;
      }
      toast.success(t("loginSuccess"));
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid login credentials");
    } finally {
      setBusy(false);
    }
  };

  const roleTabs: { key: LoginRole; bn: string; en: string }[] = [
    { key: "admin", bn: "এডমিন", en: "Admin" },
    { key: "moderator", bn: "মডারেটর", en: "Moderator" },
    { key: "owner", bn: "মালিক", en: "Owner" },
  ];

  const fieldLabel =
    role === "admin" || role === "moderator"
      ? lang === "bn" ? "ইমেইল" : "Email"
      : lang === "bn" ? "লগইন আইডি" : "Login ID";
  const fieldPlaceholder =
    role === "admin"
      ? lang === "bn" ? "আপনার ইমেইল লিখুন" : "Enter your email"
      : role === "moderator"
        ? lang === "bn" ? "মডারেটর ইমেইল লিখুন" : "Enter moderator email"
        : lang === "bn" ? "মালিকের লগইন আইডি" : "Owner login ID";

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Card className="w-full max-w-4xl grid md:grid-cols-2 overflow-hidden border-0 shadow-2xl">
        <div className="bg-black text-white p-8 flex flex-col justify-center">
          <div className="flex justify-end mb-2">
            <Button variant="ghost" size="sm" className="text-white hover:bg-white/10" onClick={() => setLang(lang === "bn" ? "en" : "bn")}>
              <Languages className="h-4 w-4 mr-2" />
              {lang === "bn" ? "English" : "বাংলা"}
            </Button>
          </div>
          <h1 className="text-3xl font-bold mb-1 text-center" style={{ fontFamily: "serif" }}>
            {t("loginForm")}
          </h1>
          <p className="text-center text-slate-400 mb-6 text-sm">{t("tagline")}</p>

          <div className="max-w-xs mx-auto w-full mb-4">
            <div className="grid grid-cols-3 gap-1 rounded-md bg-white/10 p-1">
              {roleTabs.map((r) => (
                <button
                  key={r.key}
                  type="button"
                  onClick={() => { setRole(r.key); setEmail(""); }}
                  className={`text-xs py-1.5 rounded transition-colors ${
                    role === r.key
                      ? "bg-white text-black font-semibold"
                      : "text-slate-200 hover:bg-white/10"
                  }`}
                >
                  {lang === "bn" ? r.bn : r.en}
                </button>
              ))}
            </div>
            <p className="text-[10px] text-slate-400 mt-2 text-center">
              {role === "admin"
                ? lang === "bn" ? "এডমিন ইমেইল ও পাসওয়ার্ড দিয়ে লগইন করুন" : "Sign in with admin email & password"
                : role === "moderator"
                  ? lang === "bn" ? "মডারেটরের ইমেইল ও পাসওয়ার্ড দিন" : "Use the moderator email & password"
                  : lang === "bn" ? "মালিকের জন্য নির্ধারিত লগইন আইডি ও পাসওয়ার্ড দিন" : "Use the owner login ID & password"}
            </p>
          </div>

          <form onSubmit={submit} className="space-y-4 max-w-xs mx-auto w-full">
            <div>
              <Label className="text-white text-xs">{fieldLabel}</Label>
              <Input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white text-black"
                autoComplete="username"
                placeholder={fieldPlaceholder}
              />
            </div>
            <div>
              <Label className="text-white text-xs">{t("password")}</Label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
                className="bg-white text-black"
                autoComplete="current-password"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-slate-200 text-black hover:bg-white">
              {busy ? "..." : t("login")}
            </Button>
          </form>
        </div>
        <div className="bg-black hidden md:flex items-center justify-center p-8">
          <Bus className="h-48 w-48 text-slate-500" strokeWidth={1} />
        </div>
      </Card>
    </div>
  );
}


