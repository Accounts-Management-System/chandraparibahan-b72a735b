import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useT } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Eye, EyeOff } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useT();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Supabase auto-handles the recovery hash and emits PASSWORD_RECOVERY event.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Min 6 chars");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success(t("passwordUpdated"));
      await supabase.auth.signOut();
      navigate({ to: "/login" });
    } catch (err: any) {
      toast.error(err.message ?? "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <Card className="w-full max-w-md p-6 bg-black text-white border-0 shadow-2xl">
        <h1 className="text-2xl font-bold mb-4 text-center">{t("resetPasswordTitle")}</h1>
        {!ready ? (
          <p className="text-center text-sm text-slate-400">{t("loading")}</p>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label className="text-white text-xs">{t("newPassword")}</Label>
              <div className="relative">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="bg-white text-black pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? t("hidePassword") : t("showPassword")}
                  className="absolute inset-y-0 right-0 px-2 text-slate-600 hover:text-black"
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div>
              <Label className="text-white text-xs">{t("confirmPassword")}</Label>
              <Input
                type={showPw ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
                className="bg-white text-black"
              />
            </div>
            <Button type="submit" disabled={busy} className="w-full bg-slate-200 text-black hover:bg-white">
              {busy ? "..." : t("updatePassword")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}
