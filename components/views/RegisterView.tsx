"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { User } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import { InputField, GradientButton } from "@/components/common";
import { registerSchema, fieldErrors } from "@/lib/validation/auth";
import { registerAction } from "@/lib/auth/actions";

const FIELDS = ["firstName", "lastName", "username", "email", "phone", "password", "confirm"] as const;
type Field = (typeof FIELDS)[number];

export default function RegisterView() {
  const { lang } = useApp();
  const router = useRouter();
  const tr = translations[lang];
  const [form, setForm] = useState<Record<Field, string>>({
    firstName: "",
    lastName: "",
    username: "",
    email: "",
    phone: "",
    password: "",
    confirm: "",
  });
  const [touched, setTouched] = useState<Set<Field>>(new Set());
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Client-side mirror of the server schema → drives the button-enable state.
  const valid = useMemo(() => registerSchema.safeParse(form).success, [form]);

  const set = (key: Field) => (v: string) => {
    setForm((f) => ({ ...f, [key]: v }));
  };
  const blur = (key: Field) => () => setTouched((t) => new Set(t).add(key));

  // Inline error for a field — only after it's been touched (or after submit).
  const errFor = (key: Field): string | undefined => {
    if (!touched.has(key)) return undefined;
    const parsed = registerSchema.safeParse(form);
    const clientKey = parsed.success ? undefined : fieldErrors(parsed.error)[key];
    // A server error (e.g. usernameTaken) wins; it's cleared to "" on edit.
    const code = errors[key] || clientKey;
    return code ? tr.validation[code as keyof typeof tr.validation] : undefined;
  };

  const submit = async () => {
    if (submitting) return;
    setFormError("");
    const parsed = registerSchema.safeParse(form);
    if (!parsed.success) {
      setTouched(new Set(FIELDS));
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setSubmitting(true);
    const res = await registerAction(form);
    if (res.ok) {
      if (res.formError === "confirmEmail") {
        router.push("/sign-in");
        router.refresh();
        return;
      }
      router.push("/");
      router.refresh();
      return;
    }
    setSubmitting(false);
    setTouched(new Set(FIELDS));
    if (res.errors) setErrors(res.errors);
    if (res.formError) setFormError(res.formError);
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="bg-card rounded-3xl border border-border p-8 shadow-sm">
          <div className="text-center mb-8">
            <div
              className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #7B6FC4, #C084A0)" }}
            >
              <User size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">{tr.register.title}</h1>
          </div>

          {formError && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
              {tr.authError[formError as keyof typeof tr.authError] ?? tr.authError.unknown}
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div onBlur={blur("firstName")}>
                <InputField
                  label={tr.register.firstName}
                  value={form.firstName}
                  onChange={set("firstName")}
                  error={errFor("firstName")}
                />
              </div>
              <div onBlur={blur("lastName")}>
                <InputField
                  label={tr.register.lastName}
                  value={form.lastName}
                  onChange={set("lastName")}
                  error={errFor("lastName")}
                />
              </div>
            </div>
            <div onBlur={blur("username")}>
              <InputField
                label={tr.register.username}
                value={form.username}
                onChange={(v) => {
                  set("username")(v);
                  setErrors((e) => ({ ...e, username: "" }));
                }}
                error={errFor("username")}
              />
            </div>
            <div onBlur={blur("email")}>
              <InputField
                label={tr.register.email}
                type="email"
                value={form.email}
                onChange={(v) => {
                  set("email")(v);
                  setErrors((e) => ({ ...e, email: "" }));
                }}
                error={errFor("email")}
              />
            </div>
            <div onBlur={blur("phone")}>
              <InputField
                label={tr.register.phone}
                type="tel"
                value={form.phone}
                onChange={set("phone")}
                error={errFor("phone")}
              />
            </div>
            <div onBlur={blur("password")}>
              <InputField
                label={tr.register.password}
                type="password"
                value={form.password}
                onChange={set("password")}
                error={errFor("password")}
              />
            </div>
            <div onBlur={blur("confirm")}>
              <InputField
                label={tr.register.confirm}
                type="password"
                value={form.confirm}
                onChange={set("confirm")}
                error={errFor("confirm")}
                onEnter={submit}
              />
            </div>
            <GradientButton
              onClick={submit}
              disabled={!valid || submitting}
              className="w-full mt-2"
            >
              {submitting ? tr.register.submitting : tr.register.button}
            </GradientButton>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            {tr.register.hasAccount}{" "}
            <button
              onClick={() => router.push("/sign-in")}
              className="font-semibold hover:underline"
              style={{ color: "var(--primary)" }}
            >
              {tr.register.login}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
