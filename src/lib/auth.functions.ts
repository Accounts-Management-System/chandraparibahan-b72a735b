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
