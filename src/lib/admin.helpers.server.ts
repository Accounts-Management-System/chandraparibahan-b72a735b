import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Ensure caller has admin role.
 *
 * Bootstrap exception: the very first user becomes admin ONLY when the
 * entire user_roles table is empty (zero rows of ANY role). This prevents
 * a self-registered or shareholder/owner account from escalating to admin
 * after every admin entry has been deleted.
 */
export async function requireAdmin(userId: string) {
  const { data: mine } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (mine && mine.some((r) => r.role === "admin")) return;

  // Strict bootstrap: only when NO role rows exist at all.
  const { count: totalRoles } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true });
  if ((totalRoles ?? 0) === 0) {
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    return;
  }
  throw new Error("Forbidden: admin only");
}

/** Number of admin accounts currently in user_roles. */
export async function countAdmins(): Promise<number> {
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true })
    .eq("role", "admin");
  return count ?? 0;
}
