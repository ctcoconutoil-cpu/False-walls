"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button, Field, Notice, inputCls, Wordmark } from "@/components/ui";
import { signIn, signUp, type FormState } from "@/lib/actions/auth";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? signIn : signUp, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" aria-label="FALSE WALLS home"><Wordmark size="md" /></Link>
      <div>
        <h1 className="text-3xl">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-chalk-dim">{mode === "login" ? "Log in to open walls and see your inbox." : "You'll choose a username and avatar next."}</p>
      </div>
      <form action={action} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Email"><input name="email" type="email" required autoComplete="email" inputMode="email" className={inputCls} /></Field>
        <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <input name="password" type="password" required minLength={8} autoComplete={mode === "login" ? "current-password" : "new-password"} className={inputCls} />
        </Field>
        {mode === "signup" && (
          <label className="flex items-start gap-3 text-sm text-chalk-dim">
            <input type="checkbox" name="terms" className="mt-1 h-5 w-5 accent-mustard" />
            <span>I agree to the <Link className="underline" href="/guidelines">community guidelines</Link> and the <Link className="underline" href="/privacy">privacy and anonymity notice</Link>.</span>
          </label>
        )}
        {state?.error && <Notice tone="error">{state.error}</Notice>}
        {state?.notice && <Notice tone="ok">{state.notice}</Notice>}
        <Button type="submit" disabled={pending} size="lg" className="w-full">{pending ? "One moment…" : mode === "login" ? "Log in" : "Create account"}</Button>
      </form>
      <p className="text-sm text-chalk-dim">
        {mode === "login" ? <>New here? <Link className="font-bold text-mustard underline" href="/signup">Create an account</Link></> : <>Already have an account? <Link className="font-bold text-mustard underline" href="/login">Log in</Link></>}
        {" "}Or <Link className="underline" href="/wall">look around first</Link>.
      </p>
    </main>
  );
}
