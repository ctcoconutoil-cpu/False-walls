"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Notice, inputCls, Wordmark } from "@/components/ui";
import { requestPasswordReset, updatePassword, type FormState } from "@/lib/actions/auth";
import { PasswordInput } from "./AuthForm";

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(requestPasswordReset, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" aria-label="FALSE WALLS home"><Wordmark size="md" /></Link>
      <div><h1 className="text-3xl">Forgot your password?</h1><p className="mt-1 text-chalk-dim">Enter your email and we'll send you a link to choose a new one.</p></div>
      <form action={action} className="space-y-4">
        <Field label="Email"><input name="email" type="email" required autoComplete="email" inputMode="email" className={inputCls} /></Field>
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        {state?.notice && <Notice tone="ok">{state.notice}</Notice>}
        <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "One moment…" : "Send reset link"}</Button>
      </form>
      <p className="text-sm text-chalk-dim"><Link className="font-bold text-mustard underline" href="/login">Back to log in</Link></p>
    </main>
  );
}

export function ResetPasswordForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(updatePassword, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" aria-label="FALSE WALLS home"><Wordmark size="md" /></Link>
      <div><h1 className="text-3xl">Choose a new password</h1><p className="mt-1 text-chalk-dim">You'll be logged in once it's saved.</p></div>
      <form action={action} className="space-y-4">
        <Field label="New password" hint="At least 8 characters."><PasswordInput autoComplete="new-password" minLength={8} /></Field>
        <Field label="Type it again"><PasswordInput name="confirm" autoComplete="new-password" minLength={8} /></Field>
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        <Button type="submit" size="lg" disabled={pending} className="w-full">{pending ? "One moment…" : "Save password"}</Button>
      </form>
    </main>
  );
}
