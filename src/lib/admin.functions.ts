import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Ensure caller has admin role (with bootstrap exception: first user is admin). */
async function requireAdmin(userId: string) {
  const { data: mine } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (mine && mine.some((r) => r.role === "admin")) return;
  const { count } = await supabaseAdmin
    .from("user_roles")
    .select("*", { count: "exact", head: true });
  if ((count ?? 0) === 0) {
    // bootstrap: grant admin to first caller
    await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
    return;
  }
  throw new Error("Forbidden: admin only");
}

/** Create a moderator account (email/password). */
export const createModerator = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().email(),
        password: z.string().min(6).max(72),
        name: z.string().min(1).max(100).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: { name: data.name ?? "" },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("Failed to create user");
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "moderator" });
    return { id: uid, email: data.email };
  });

/** Create a shareholder login (login_id + pin) and link to a contacts row. */
export const createShareholderLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        contactId: z.string().uuid(),
        loginId: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
        pin: z.string().min(4).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const synthEmail = `${data.loginId.toLowerCase()}@shareholders.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: synthEmail,
      password: data.pin,
      email_confirm: true,
      user_metadata: { shareholder_id: data.contactId, login_id: data.loginId },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("Failed to create user");
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "shareholder" });
    await supabaseAdmin
      .from("contacts")
      .update({ auth_user_id: uid, login_id: data.loginId })
      .eq("id", data.contactId);
    return { id: uid, loginId: data.loginId };
  });

/** Reset PIN/password for an existing auth user. */
export const resetUserPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ authUserId: z.string().uuid(), pin: z.string().min(4).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    const { error } = await supabaseAdmin.auth.admin.updateUserById(data.authUserId, {
      password: data.pin,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** List moderator + shareholder users with their emails for admin UI. */
export const listManagedUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await requireAdmin(context.userId);
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id,role");
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ perPage: 200 });
    const out = (roles ?? []).map((r) => {
      const u = list.users.find((x) => x.id === r.user_id);
      return { user_id: r.user_id, role: r.role as string, email: u?.email ?? null };
    });
    return out;
  });

/** Delete a managed user (moderator or shareholder). */
export const deleteManagedUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    await requireAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");
    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin
      .from("contacts")
      .update({ auth_user_id: null })
      .eq("auth_user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
