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

function LoginPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const { t, lang, setLang } = useT();
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
      const tokens = await signIn({ data: { loginId: email, password } });
      const { error } = await supabase.auth.setSession({
        access_token: tokens.access_token,
        refresh_token: tokens.refresh_token,
      });
      if (error) throw error;
      toast.success(t("loginSuccess"));
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err?.message ?? "Invalid login credentials");
    } finally {
      setBusy(false);
    }
  };

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
          <p className="text-center text-slate-400 mb-8 text-sm">{t("tagline")}</p>
          <form onSubmit={submit} className="space-y-4 max-w-xs mx-auto w-full">
            <div>
              <Label className="text-white text-xs">{t("email")}</Label>
              <Input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="bg-white text-black"
                autoComplete="username"
                placeholder={t("email") + " / " + t("loginId")}
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

