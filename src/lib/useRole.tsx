import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./auth";

export type Role = "admin" | "moderator" | "shareholder" | null;

/**
 * Returns the effective role of the current user.
 * Bootstrap rule: if NO roles exist in the system, the first signed-in user is treated as admin
 * (so the app is usable on day one). Once any role exists, users must be assigned explicitly.
 */
export function useRole() {
  const { user } = useAuth();

  const q = useQuery({
    queryKey: ["my-role", user?.id ?? "none"],
    enabled: !!user?.id,
    queryFn: async (): Promise<Role> => {
      if (!user?.id) return null;
      const { data: mine } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      if (mine && mine.length > 0) {
        // priority admin > moderator > shareholder
        if (mine.some((r) => r.role === "admin")) return "admin";
        if (mine.some((r) => r.role === "moderator")) return "moderator";
        if (mine.some((r) => r.role === "shareholder")) return "shareholder";
      }
      // bootstrap: no roles anywhere?
      const { count } = await supabase
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      if ((count ?? 0) === 0) return "admin";
      return null;
    },
  });

  const role = q.data ?? null;
  return {
    role,
    isAdmin: role === "admin",
    isModerator: role === "moderator",
    isShareholder: role === "shareholder",
    canWrite: role === "admin" || role === "moderator",
    loading: q.isLoading,
  };
}
