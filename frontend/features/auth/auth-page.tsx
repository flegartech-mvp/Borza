"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { BrandMark } from "@/components/shell/brand-mark";
import { Button } from "@/components/ui/button";
import { LanguageSwitcher, ThemeSwitcher, usePreferences } from "@/features/preferences";
import { useAuth } from "./auth-provider";

type Mode = "sign-in" | "register" | "forgot" | "update-password";
type FormValues = { email: string; password: string; fullName: string };

const emailSchema = z.string().trim().email();
const passwordSchema = z.string().min(8).max(128);

export function AuthPage({ mode }: { mode: Mode }) {
  const { dictionary } = usePreferences();
  const { configured, signIn, signUp, requestPasswordReset, updatePassword, passwordRecovery } = useAuth();
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({ defaultValues: { email: "", password: "", fullName: "" } });
  const title = mode === "sign-in" ? dictionary.auth.signIn : mode === "register" ? dictionary.auth.register : mode === "forgot" ? dictionary.auth.forgot : dictionary.auth.password;

  const submit = async (values: FormValues) => {
    setError(null);
    setMessage(null);
    if (mode !== "update-password" && !emailSchema.safeParse(values.email).success) {
      setError(dictionary.auth.error);
      return;
    }
    if ((mode === "sign-in" || mode === "register" || mode === "update-password") && !passwordSchema.safeParse(values.password).success) {
      setError(dictionary.auth.error);
      return;
    }
    const result = mode === "sign-in"
      ? await signIn(values.email, values.password)
      : mode === "register"
        ? await signUp(values.email, values.password, values.fullName)
        : mode === "forgot"
          ? await requestPasswordReset(values.email)
          : await updatePassword(values.password);
    if (result) {
      setError(result);
      return;
    }
    if (mode === "forgot") setMessage(dictionary.auth.resetSent);
    else if (mode === "register") setMessage("Check your email to confirm the account.");
    else router.push(mode === "update-password" ? "/settings" : "/home");
  };

  return (
    <main className="academy-grid grid min-h-dvh place-items-center px-4 py-10">
      <section className="w-full max-w-md rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-1)] p-6 shadow-[var(--shadow-floating)] sm:p-8">
        <div className="flex items-start justify-between gap-3"><BrandMark /><LanguageSwitcher compact /></div>
        <h1 className="mt-9 text-3xl font-semibold tracking-tight">{title}</h1>
        {mode === "forgot" ? <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{dictionary.auth.resetIntro}</p> : null}
        {!configured ? <div className="mt-5 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] p-4"><p className="font-semibold">{dictionary.auth.configurationTitle}</p><p className="mt-1 text-sm leading-6 text-[var(--text-secondary)]">{dictionary.auth.configurationBody}</p><Link href="/home" className="mt-3 inline-flex font-semibold text-[var(--brand)]">{dictionary.common.localDemo}</Link></div> : null}
        {mode === "update-password" && !passwordRecovery ? <p className="mt-5 rounded-[var(--radius-sm)] border border-[var(--warning)] bg-[var(--warning-soft)] p-4 text-sm">Open this page from the secure recovery link in your email.</p> : null}
        <form onSubmit={handleSubmit(submit)} className="mt-6 space-y-4">
          {mode === "register" ? <label className="block text-sm font-medium">{dictionary.auth.fullName}<input {...register("fullName", { required: true })} autoComplete="name" className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3" />{errors.fullName ? <span className="mt-1 block text-xs text-[var(--negative)]">Required</span> : null}</label> : null}
          {mode !== "update-password" ? <label className="block text-sm font-medium">{dictionary.auth.email}<input {...register("email", { required: true })} type="email" autoComplete="email" className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3" /></label> : null}
          {mode !== "forgot" ? <label className="block text-sm font-medium">{dictionary.auth.password}<input {...register("password", { required: true, minLength: 8 })} type="password" autoComplete={mode === "sign-in" ? "current-password" : "new-password"} className="mt-2 w-full rounded-[var(--radius-sm)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3" /><span className="mt-1 block text-xs text-[var(--text-tertiary)]">Minimum 8 characters</span></label> : null}
          {error ? <p role="alert" className="text-sm text-[var(--negative)]">{error}</p> : null}
          {message ? <p role="status" className="text-sm text-[var(--positive)]">{message}</p> : null}
          <Button type="submit" loading={isSubmitting} disabled={!configured || (mode === "update-password" && !passwordRecovery)} className="w-full">{dictionary.auth.submit}</Button>
        </form>
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 text-sm text-[var(--text-secondary)]">
          {mode !== "sign-in" ? <Link href="/sign-in" className="font-semibold text-[var(--brand)]">{dictionary.auth.signIn}</Link> : <Link href="/register" className="font-semibold text-[var(--brand)]">{dictionary.auth.register}</Link>}
          {mode !== "forgot" ? <Link href="/forgot-password">{dictionary.auth.forgot}</Link> : null}
        </div>
        <div className="mt-7 border-t border-[var(--border-subtle)] pt-5"><ThemeSwitcher /></div>
      </section>
    </main>
  );
}
