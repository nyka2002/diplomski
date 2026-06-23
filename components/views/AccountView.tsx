"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import { GradientButton } from "@/components/common";
import { profileSchema, passwordChangeSchema, fieldErrors } from "@/lib/validation/auth";
import { updateProfileAction, changePasswordAction } from "@/lib/auth/actions";

export default function AccountView() {
  const { lang, profile, requestSignOut } = useApp();
  const router = useRouter();
  const tr = translations[lang];
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");

  const [form, setForm] = useState({
    firstName: profile?.firstName ?? "",
    lastName: profile?.lastName ?? "",
    username: profile?.username ?? "",
    email: profile?.email ?? "",
    phone: profile?.phone ?? "",
  });
  const [pwForm, setPwForm] = useState({ current: "", newPw: "", confirm: "" });

  // The layout enforces auth; this is a render-time guard only.
  if (!profile) return null;

  const startEdit = () => {
    setForm({
      firstName: profile.firstName,
      lastName: profile.lastName,
      username: profile.username,
      email: profile.email,
      phone: profile.phone,
    });
    setPwForm({ current: "", newPw: "", confirm: "" });
    setErrors({});
    setFormError("");
    setNotice("");
    setEditing(true);
  };

  const cancel = () => {
    setEditing(false);
    setErrors({});
    setFormError("");
  };

  const tField = (key: string): string | undefined => {
    const code = errors[key];
    return code ? tr.validation[code as keyof typeof tr.validation] : undefined;
  };

  const save = async () => {
    if (saving) return;
    setFormError("");
    setNotice("");

    const profileParsed = profileSchema.safeParse(form);
    const changingPw = pwForm.current || pwForm.newPw || pwForm.confirm;
    const pwParsed = changingPw ? passwordChangeSchema.safeParse(pwForm) : null;

    if (!profileParsed.success || (pwParsed && !pwParsed.success)) {
      setErrors({
        ...(profileParsed.success ? {} : fieldErrors(profileParsed.error)),
        ...(pwParsed && !pwParsed.success ? fieldErrors(pwParsed.error) : {}),
      });
      return;
    }

    setSaving(true);
    const res = await updateProfileAction(form);
    if (!res.ok) {
      setSaving(false);
      if (res.errors) setErrors(res.errors);
      if (res.formError) setFormError(res.formError);
      return;
    }

    if (changingPw) {
      const pwRes = await changePasswordAction(pwForm);
      if (!pwRes.ok) {
        setSaving(false);
        if (pwRes.errors) setErrors(pwRes.errors);
        if (pwRes.formError) setFormError(pwRes.formError);
        return;
      }
    }

    setSaving(false);
    setEditing(false);
    setNotice(changingPw ? tr.account.pwChanged : tr.account.profileSaved);
    router.refresh();
  };

  const profileFields: [keyof typeof form, string][] = [
    ["firstName", tr.account.firstName],
    ["lastName", tr.account.lastName],
    ["username", tr.account.username],
    ["email", tr.account.email],
    ["phone", tr.account.phone],
  ];
  const pwFields: [keyof typeof pwForm, string][] = [
    ["current", tr.account.currentPw],
    ["newPw", tr.account.newPw],
    ["confirm", tr.account.confirmPw],
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">
      <div className="flex items-center gap-4 mb-8">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center text-white text-2xl font-extrabold shadow-md"
          style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}
        >
          {(profile.firstName[0] ?? "U").toUpperCase()}
        </div>
        <div>
          <h1 className="text-2xl font-extrabold text-foreground">{tr.account.title}</h1>
          <p className="text-muted-foreground text-sm">@{profile.username}</p>
        </div>
      </div>

      {notice && (
        <div className="mb-4 rounded-xl border border-green-500/30 bg-green-500/5 px-4 py-3 text-sm font-medium text-green-600 dark:text-green-400">
          {notice}
        </div>
      )}
      {formError && (
        <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
          {tr.authError[formError as keyof typeof tr.authError] ?? tr.authError.unknown}
        </div>
      )}

      <div className="bg-card rounded-3xl border border-border p-6 space-y-4">
        {profileFields.map(([key, label]) => (
          <div key={key}>
            <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
              {label}
            </label>
            {editing ? (
              <>
                <input
                  type="text"
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full rounded-xl border border-border bg-input-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all"
                />
                {tField(key) && (
                  <p className="mt-1.5 text-xs font-medium text-destructive">{tField(key)}</p>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-foreground py-2.5 px-4 rounded-xl bg-muted/50">
                {form[key] || profile[key] || "—"}
              </p>
            )}
          </div>
        ))}

        {editing && (
          <div className="border-t border-border pt-5 space-y-4">
            <h3 className="text-sm font-bold text-foreground">{tr.account.changePw}</h3>
            {pwFields.map(([key, label]) => (
              <div key={key}>
                <label className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">
                  {label}
                </label>
                <input
                  type="password"
                  value={pwForm[key]}
                  onChange={(e) => setPwForm({ ...pwForm, [key]: e.target.value })}
                  className="w-full rounded-xl border border-border bg-input-background px-4 py-2.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-purple-300 dark:focus:ring-purple-700 transition-all"
                />
                {tField(key) && (
                  <p className="mt-1.5 text-xs font-medium text-destructive">{tField(key)}</p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-3 pt-2">
          {editing ? (
            <>
              <GradientButton onClick={save} disabled={saving} className="flex-1">
                {saving ? tr.account.saving : tr.account.save}
              </GradientButton>
              <button
                onClick={cancel}
                className="flex-1 py-3 rounded-xl border border-border text-foreground text-sm font-semibold hover:bg-muted transition-colors"
              >
                {tr.account.cancel}
              </button>
            </>
          ) : (
            <GradientButton onClick={startEdit} className="flex-1">
              {tr.account.edit}
            </GradientButton>
          )}
        </div>
      </div>

      <button
        onClick={requestSignOut}
        className="mt-4 w-full py-2.5 rounded-xl border border-destructive/30 text-destructive text-sm font-semibold hover:bg-destructive/5 transition-colors"
      >
        {tr.account.signout}
      </button>
    </div>
  );
}
