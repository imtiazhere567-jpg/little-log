"use client";
import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { signIn } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="btn btn-lg btn-primary mt-2 w-full shadow-[0_8px_20px_rgba(47,111,98,.3)] disabled:opacity-70">
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}

export default function LoginForm({ email, next, error, demoEmail, demoPassword }: {
  email: string; next: string; error: string | null; demoEmail: string; demoPassword: string;
}) {
  const [show, setShow] = useState(false);
  const form = useRef<HTMLFormElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  function fillDemo() {
    if (emailRef.current) emailRef.current.value = demoEmail;
    if (passRef.current) passRef.current.value = demoPassword;
    form.current?.requestSubmit();
  }

  const field = "h-12 w-full rounded-2xl border border-line bg-surface px-4 text-[15px] outline-none transition placeholder:text-ink-3 focus:border-primary focus:shadow-[0_0_0_4px_rgba(47,111,98,.12)]";

  return (
    <>
      {error && (
        <div role="alert" className="drop-in mb-4 flex items-start gap-2.5 rounded-2xl border border-danger/20 bg-danger-soft px-4 py-3 text-[13.5px] leading-5 text-danger">
          <span className="mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-full bg-danger text-[11px] font-black text-white">!</span>
          {error}
        </div>
      )}
      <form ref={form} action={signIn} className="grid gap-4">
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1.5">
          <span className="text-[13px] font-bold text-ink-2">Work email</span>
          <input ref={emailRef} name="email" type="email" autoComplete="username" required defaultValue={email} placeholder="you@yourcenter.com" className={field} />
        </label>
        <div className="grid gap-1.5">
          <span className="flex items-center justify-between">
            <label htmlFor="password" className="text-[13px] font-bold text-ink-2">Password</label>
            <span className="text-[12px] font-semibold text-ink-3" title="In the demo, use the password shown below.">Forgot? Ask your account owner</span>
          </span>
          <span className="relative">
            <input id="password" ref={passRef} name="password" type={show ? "text" : "password"} autoComplete="current-password" required placeholder="••••••••" className={`${field} pr-12`} />
            <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-ink-3 hover:bg-surface-2 hover:text-ink">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" />
                {show && <path d="M4 4l16 16" />}
              </svg>
            </button>
          </span>
        </div>
        <label className="flex cursor-pointer items-center gap-2.5 text-[14px] font-semibold text-ink-2">
          <input type="checkbox" name="remember" defaultChecked className="h-[18px] w-[18px] accent-[#2F6F62]" />
          Keep me signed in for 30 days
        </label>
        <Submit />
      </form>

      {/* one-tap demo sign-in (fills the form behind the scenes and submits it) */}
      <div className="my-5 flex items-center gap-3 text-[12px] font-bold uppercase tracking-[.1em] text-ink-3">
        <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
      </div>
      <button type="button" onClick={fillDemo}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-accent text-[15px] font-bold text-white shadow-[0_8px_20px_rgba(232,149,90,.35)] transition hover:brightness-105 active:scale-[.99]">
        ⚡ Demo login
      </button>
      <p className="mt-2 text-center text-[12px] text-ink-3">Signs you in as the demo director. No password needed.</p>
    </>
  );
}
