import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type AccessRole = "admin" | "moderator" | "shareholder" | null;

function pickRole(roles: string[]): AccessRole {
  if (roles.includes("admin")) return "admin";
  if (roles.includes("moderator")) return "moderator";
  if (roles.includes("shareholder")) return "shareholder";
  return null;
}

/** Resolve the current user's role/owner link on the server, with RLS fallback. */
export const getMyAccess = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const userId = context.userId;

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: roleRows, error: roleErr } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (roleErr) throw roleErr;

      let roles = (roleRows ?? []).map((r) => String(r.role));
      const { count } = await supabaseAdmin
        .from("user_roles")
        .select("*", { count: "exact", head: true });
      if (roles.length === 0 && (count ?? 0) === 0) {
        await supabaseAdmin.from("user_roles").insert({ user_id: userId, role: "admin" });
        roles = ["admin"];
      }

      const { data: owner } = await supabaseAdmin
        .from("owners")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();

      return { role: pickRole(roles), ownerId: owner?.id ?? null };
    } catch {
      const { data: roleRows, error: roleErr } = await context.supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (roleErr) throw roleErr;
      const { data: owner, error: ownerErr } = await context.supabase
        .from("owners")
        .select("id")
        .eq("auth_user_id", userId)
        .maybeSingle();
      if (ownerErr) throw ownerErr;
      return { role: pickRole((roleRows ?? []).map((r) => String(r.role))), ownerId: owner?.id ?? null };
    }
  });

/**
 * Resolve a login id (or email) + password to a Supabase session.
 * Hides the internal synthetic email naming scheme from the browser so
 * attackers cannot enumerate owner/shareholder accounts from client code.
 *
 * Returns the session tokens on success; client then calls
 * supabase.auth.setSession({ access_token, refresh_token }).
 */
export const signInWithLoginId = createServerFn({ method: "POST" })
  .inputValidator((d) =>
    z
      .object({
        loginId: z.string().trim().min(1).max(255),
        password: z.string().min(1).max(200),
        role: z.enum(["admin", "moderator", "owner"]).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");

    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;

    // Build the list of candidate emails to try. Synthetic account emails stay
    // server-side; the browser only submits the user's login id + password.
    const raw = data.loginId.trim();
    const candidates: string[] = [];
    const addCandidate = (email: string) => {
      if (!candidates.includes(email)) candidates.push(email);
    };

    if (raw.includes("@")) {
      addCandidate(raw);
    } else {
      const lower = raw.toLowerCase();
      if (data.role === "owner") {
        addCandidate(`${lower}@owners.local`);
        addCandidate(`${lower}@shareholders.local`);
      } else if (data.role === "moderator") {
        addCandidate(`${lower}@moderators.local`);
      } else if (data.role === "admin") {
        addCandidate(`${lower}@admins.local`);
      } else {
        addCandidate(`${lower}@owners.local`);
        addCandidate(`${lower}@shareholders.local`);
        addCandidate(`${lower}@moderators.local`);
        addCandidate(`${lower}@admins.local`);
      }
    }

    if (candidates.length === 0) {
      throw new Error("Invalid login credentials");
    }

    const anon = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    for (const email of candidates) {
      const { data: res, error } = await anon.auth.signInWithPassword({
        email,
        password: data.password,
      });
      if (!error && res.session) {
        return {
          access_token: res.session.access_token,
          refresh_token: res.session.refresh_token,
        };
      }
    }
    throw new Error("Invalid login credentials");
  });
