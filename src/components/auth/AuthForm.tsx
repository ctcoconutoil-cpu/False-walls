"use client";
import Link from "next/link";
import { useActionState, useState } from "react";
import { Button, Field, Notice, inputCls, Wordmark } from "@/components/ui";
import { signIn, signInWithGoogle, signUp, type FormState } from "@/lib/actions/auth";

export function PasswordInput({ name = "password", autoComplete, minLength }: { name?: string; autoComplete: string; minLength?: number }) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative block">
      <input name={name} type={show ? "text" : "password"} required minLength={minLength} autoComplete={autoComplete} className={`${inputCls} pr-12`} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} aria-pressed={show}
        className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center text-chalk-dim">
        <svg aria-hidden viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
          {!show && <path d="M4 4l16 16" />}
        </svg>
      </button>
    </span>
  );
}

function GoogleButton({ next, label }: { next?: string; label: string }) {
  return (
    <form action={signInWithGoogle}>
      {next && <input type="hidden" name="next" value={next} />}
      <button type="submit" className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl bg-[#f6f3ea] px-4 font-bold text-[#1b1730] active:scale-[.98]">
        <svg aria-hidden viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.5 12.2c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-1.9 3.2-4.8 3.2-8z" /><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.6-2.7c-1 .7-2.3 1.1-3.7 1.1-2.9 0-5.3-1.9-6.1-4.6H2.2v2.8A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.9 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.2a11 11 0 0 0 0 9.8z" /><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.6l3.2-3.2A11 11 0 0 0 2.2 7.1l3.7 2.8C6.700 7.300 9.100 5.400 12 5.400z" /></svg>
        {label}
      </button>
    </form>
  );
}

export function AuthForm({ mode, next, notice, error }: { mode: "login" | "signup"; next?: string; notice?: string; error?: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(mode === "login" ? signIn : signUp, null);
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 px-5 py-10">
      <Link href="/" aria-label="FALSE WALLS home"><Wordmark size="md" /></Link>
      <div>
        <h1 className="text-3xl">{mode === "login" ? "Welcome back" : "Create your account"}</h1>
        <p className="mt-1 text-chalk-dim">{mode === "login" ? "Log in to open walls and see your inbox." : "You'll choose a username and avatar next. FALSE WALLS is for people aged 17 and over."}</p>
      </div>
      {notice && <Notice tone="ok">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <GoogleButton next={next} label={mode === "login" ? "Log in with Google" : "Sign up with Google"} />
      <p aria-hidden className="flex items-center gap-3 text-xs text-chalk-dim"><span className="h-px flex-1 bg-night-3" />or use your email<span className="h-px flex-1 bg-night-3" /></p>
      <form action={action} className="space-y-4">
        {next && <input type="hidden" name="next" value={next} />}
        <Field label="Email"><input name="email" type="email" required autoComplete="email" inputMode="email" className={inputCls} /></Field>
        <Field label="Password" hint={mode === "signup" ? "At least 8 characters." : undefined}>
          <PasswordInput autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={8} />
        </Field>
        {mode === "login" && <p className="-mt-2 text-right text-sm"><Link className="font-bold text-mustard underline" href="/forgot-password">Forgot password?</Link></p>}
        {mode === "signup" && (
          <label className="flex items-start gap-3 text-sm text-chalk-dim">
            <input type="checkbox" name="terms" className="mt-1 h-5 w-5 accent-mustard" />
            <span>I am 17 or older, and I agree to the <Link className="underline" href="/guidelines">community guidelines</Link> and the <Link className="underline" href="/privacy">privacy and anonymity notice</Link>.</span>
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
