import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

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
      })
      .parse(d),
  )
  .handler(async ({ data }) => {
    const { createClient } = await import("@supabase/supabase-js");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const url = process.env.SUPABASE_URL!;
    const key = process.env.SUPABASE_PUBLISHABLE_KEY!;

    // Build the list of candidate emails to try.
    const raw = data.loginId.trim();
    const candidates: string[] = [];
    if (raw.includes("@")) {
      candidates.push(raw);
    } else {
      const lower = raw.toLowerCase();
      // Look up real auth user via owners / contacts login_id mapping.
      const { data: ow } = await supabaseAdmin
        .from("owners")
        .select("auth_user_id")
        .eq("login_id", lower)
        .maybeSingle();
      const { data: ct } = await supabaseAdmin
        .from("contacts")
        .select("auth_user_id")
        .eq("login_id", lower)
        .maybeSingle();
      for (const row of [ow, ct]) {
        const uid = row?.auth_user_id as string | undefined;
        if (!uid) continue;
        const { data: u } = await supabaseAdmin.auth.admin.getUserById(uid);
        const email = u?.user?.email;
        if (email && !candidates.includes(email)) candidates.push(email);
      }
    }

    if (candidates.length === 0) {
      throw new Error("Invalid login credentials");
    }

    const anon = createClient(url, key, {
      auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
    });

    let lastErr: string | null = null;
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
      lastErr = error?.message ?? "Login failed";
    }
    throw new Error(lastErr ?? "Invalid login credentials");
  });
