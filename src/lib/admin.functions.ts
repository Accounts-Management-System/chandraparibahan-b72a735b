import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Persist first logged-in user as admin so write access works immediately. */
export const ensureBootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { requireAdmin } = await import("./admin.helpers.server");
    await requireAdmin(context.userId);
    return { ok: true };
  });

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
    const { requireAdmin } = await import("./admin.helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const { requireAdmin } = await import("./admin.helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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

/** Create an owner login (login_id + pin) linked to an owners row. */
export const createOwnerLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        ownerId: z.string().uuid(),
        loginId: z.string().min(3).max(50).regex(/^[a-zA-Z0-9_.-]+$/),
        pin: z.string().min(4).max(20),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin(context.userId);
    const synthEmail = `${data.loginId.toLowerCase()}@owners.local`;
    const { data: created, error } = await supabaseAdmin.auth.admin.createUser({
      email: synthEmail,
      password: data.pin,
      email_confirm: true,
      user_metadata: { owner_id: data.ownerId, login_id: data.loginId },
    });
    if (error) throw new Error(error.message);
    const uid = created.user?.id;
    if (!uid) throw new Error("Failed to create user");
    await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: uid, role: "shareholder" });
    await supabaseAdmin
      .from("owners")
      .update({ auth_user_id: uid, login_id: data.loginId })
      .eq("id", data.ownerId);
    return { id: uid, loginId: data.loginId };
  });

/** Reset PIN/password for an existing auth user. */
export const resetUserPin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ authUserId: z.string().uuid(), pin: z.string().min(4).max(72) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { requireAdmin } = await import("./admin.helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const { requireAdmin } = await import("./admin.helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
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
    const { requireAdmin, countAdmins } = await import("./admin.helpers.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await requireAdmin(context.userId);
    if (data.userId === context.userId) throw new Error("Cannot delete yourself");

    // Refuse to delete the last remaining admin so the bootstrap path can
    // never re-open as a privilege-escalation vector.
    const { data: targetRoles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", data.userId);
    const targetIsAdmin = (targetRoles ?? []).some((r) => r.role === "admin");
    if (targetIsAdmin) {
      const admins = await countAdmins();
      if (admins <= 1) throw new Error("Cannot delete the last remaining admin");
    }

    await supabaseAdmin.from("user_roles").delete().eq("user_id", data.userId);
    await supabaseAdmin
      .from("contacts")
      .update({ auth_user_id: null })
      .eq("auth_user_id", data.userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

