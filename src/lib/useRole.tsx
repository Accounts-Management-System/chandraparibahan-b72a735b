import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";
import { ensureBootstrapAdmin } from "./admin.functions";

export type Role = "admin" | "moderator" | "shareholder" | null;

export function useRole() {
  const { user } = useAuth();
  const bootstrapAdmin = useServerFn(ensureBootstrapAdmin);

  const q = useQuery({
    queryKey: ["my-role", user?.id ?? "none"],
    enabled: !!user?.id,
    retry: 2,
    queryFn: async (): Promise<Role> => {
      if (!user?.id) return null;
      const { data: mine, error: mineErr } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (mineErr) throw mineErr;
      if (mine && mine.length > 0) {
        if (mine.some((r) => r.role === "admin")) return "admin";
        if (mine.some((r) => r.role === "moderator")) return "moderator";
        if (mine.some((r) => r.role === "shareholder")) return "shareholder";
      }
      const { count, error: countErr } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      if (countErr) throw countErr;
      if ((count ?? 0) === 0) {
        await bootstrapAdmin({});
        return "admin";
      }
      return null;
    },
  });

  const ownerQ = useQuery({
    queryKey: ["my-owner", user?.id ?? "none"],
    enabled: !!user?.id,
    retry: 2,
    queryFn: async (): Promise<string | null> => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("owners")
        .select("id")
        .eq("auth_user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data?.id ?? null;
    },
  });

  const role = q.data ?? null;
  return {
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    isShareholder: role === "shareholder",
    canWrite: role === "admin" || role === "moderator",
    ownerId: ownerQ.data ?? null,
    isOwner: !!ownerQ.data,
    loading: q.isLoading || ownerQ.isLoading,
  };
}
