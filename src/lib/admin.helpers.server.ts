import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Ensure caller has admin role (with bootstrap exception: first user is admin). */
export async function requireAdmin(userId: string) {
  const { data: mine } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (mine && mine.some((r) => r.role === "admin")) return;
  const { count: adminCount } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  if ((adminCount ?? 0) === 0) {
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    return;
  }
  throw new Error("Forbidden: admin only");
}
