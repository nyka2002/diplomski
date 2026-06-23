"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn } from "lucide-react";
import { useApp } from "@/lib/app-context";
import { translations } from "@/lib/i18n/translations";
import { InputField, GradientButton } from "@/components/common";
import { signInAction } from "@/lib/auth/actions";

export default function SignInView() {
  const { lang } = useApp();
  const router = useRouter();
  const searchParams = useSearchParams();
  const tr = translations[lang];
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const canSubmit = identifier.trim().length > 0 && password.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setFormError("");
    const res = await signInAction({ identifier, password });
    if (res.ok) {
      const redirect = searchParams.get("redirect") || "/";
      router.push(redirect);
      router.refresh();
      return;
    }
    setSubmitting(false);
    setFormError(res.formError ?? "unknown");
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
              <LogIn size={24} className="text-white" />
            </div>
            <h1 className="text-2xl font-extrabold text-foreground">{tr.signin.title}</h1>
          </div>

          {formError && (
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm font-medium text-destructive">
              {tr.authError[formError as keyof typeof tr.authError] ?? tr.authError.unknown}
            </div>
          )}

          <div className="space-y-4">
            <InputField
              label={tr.signin.username}
              value={identifier}
              onChange={setIdentifier}
              onEnter={submit}
            />
            <InputField
              label={tr.signin.password}
              type="password"
              value={password}
              onChange={setPassword}
              onEnter={submit}
            />
            <GradientButton
              onClick={submit}
              disabled={!canSubmit}
              className="w-full mt-2"
            >
              {submitting ? tr.signin.submitting : tr.signin.button}
            </GradientButton>
          </div>
          <p className="text-center text-sm text-muted-foreground mt-6">
            {tr.signin.noAccount}{" "}
            <button
              onClick={() => router.push("/register")}
              className="font-semibold hover:underline"
              style={{ color: "var(--primary)" }}
            >
              {tr.signin.create}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
