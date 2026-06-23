"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  registerSchema,
  signInSchema,
  profileSchema,
  passwordChangeSchema,
  fieldErrors,
} from "@/lib/validation/auth";

// Every action returns this shape. `errors` are per-field (keyed by field name),
// `formError` is a single top-level message key. Both are i18n keys resolved by
// the client against translations[lang].
export interface ActionResult {
  ok: boolean;
  errors?: Record<string, string>;
  formError?: string;
}

const notConfigured: ActionResult = { ok: false, formError: "notConfigured" };

export async function registerAction(raw: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return notConfigured;

  const parsed = registerSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { firstName, lastName, username, email, phone, password } = parsed.data;

  const supabase = await createClient();

  // Pre-check username so the user gets a clean field error rather than an
  // opaque DB constraint failure. The unique index is still the real guard.
  const { data: available } = await supabase.rpc("username_available", {
    p_username: username,
  });
  if (available === false) return { ok: false, errors: { username: "usernameTaken" } };

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { first_name: firstName, last_name: lastName, username, phone: phone ?? "" },
    },
  });

  if (error) {
    if (/already|registered|exists/i.test(error.message))
      return { ok: false, errors: { email: "emailTaken" } };
    return { ok: false, formError: "unknown" };
  }
  // Supabase returns a user with no identities when the email already exists.
  if (data.user && data.user.identities && data.user.identities.length === 0)
    return { ok: false, errors: { email: "emailTaken" } };

  revalidatePath("/", "layout");
  // session is true when email confirmation is disabled (recommended for dev).
  return { ok: true, formError: data.session ? undefined : "confirmEmail" };
}

export async function signInAction(raw: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return notConfigured;

  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { identifier, password } = parsed.data;

  const supabase = await createClient();

  // Accept either an email or a username. Usernames are resolved to their email
  // through a SECURITY DEFINER RPC.
  let email = identifier;
  if (!identifier.includes("@")) {
    const { data: resolved } = await supabase.rpc("email_for_username", {
      p_username: identifier,
    });
    if (!resolved) return { ok: false, formError: "invalidCredentials" };
    email = resolved;
  }

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { ok: false, formError: "invalidCredentials" };

  // Deactivated accounts (Phase 4 admin action) cannot stay signed in.
  const { data: prof } = await supabase
    .from("profiles")
    .select("is_active")
    .eq("email", email)
    .single();
  if (prof && prof.is_active === false) {
    await supabase.auth.signOut();
    return { ok: false, formError: "accountDeactivated" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function signOutAction(): Promise<ActionResult> {
  if (!isSupabaseConfigured) return { ok: true };
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updateProfileAction(raw: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return notConfigured;

  const parsed = profileSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { firstName, lastName, username, email, phone } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, formError: "notAuthenticated" };

  // If the username changed, make sure the new one is free.
  const { data: current } = await supabase
    .from("profiles")
    .select("username, email")
    .eq("id", user.id)
    .single();

  if (current && current.username.toLowerCase() !== username.toLowerCase()) {
    const { data: available } = await supabase.rpc("username_available", {
      p_username: username,
    });
    if (available === false) return { ok: false, errors: { username: "usernameTaken" } };
  }

  // Keep the auth email in sync (with confirmations off this is immediate).
  if (current && current.email.toLowerCase() !== email.toLowerCase()) {
    const { error: emailErr } = await supabase.auth.updateUser({ email });
    if (emailErr) return { ok: false, errors: { email: "emailTaken" } };
  }

  const { error } = await supabase
    .from("profiles")
    .update({ first_name: firstName, last_name: lastName, username, email, phone: phone || null })
    .eq("id", user.id);

  if (error) {
    if (/username/i.test(error.message)) return { ok: false, errors: { username: "usernameTaken" } };
    if (/email/i.test(error.message)) return { ok: false, errors: { email: "emailTaken" } };
    return { ok: false, formError: "unknown" };
  }

  revalidatePath("/", "layout");
  return { ok: true };
}

export async function changePasswordAction(raw: unknown): Promise<ActionResult> {
  if (!isSupabaseConfigured) return notConfigured;

  const parsed = passwordChangeSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, errors: fieldErrors(parsed.error) };
  const { current, newPw } = parsed.data;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) return { ok: false, formError: "notAuthenticated" };

  // Verify the current password by re-authenticating with it.
  const { error: reauthErr } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: current,
  });
  if (reauthErr) return { ok: false, errors: { current: "currentPwWrong" } };

  const { error } = await supabase.auth.updateUser({ password: newPw });
  if (error) return { ok: false, formError: "unknown" };

  return { ok: true };
}
