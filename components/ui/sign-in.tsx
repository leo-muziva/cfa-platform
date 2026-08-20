"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { Lock, Mail } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { SupabaseConfigError } from "@/lib/supabase/config";
import {
  AuthModal,
  type AuthModalState,
  BlurFade,
  GlassAuthShell,
  GlassButton,
  GlassField,
  GoogleIcon,
} from "@/components/ui/glass-auth";

type Step = "email" | "password";
const STEPS: Step[] = ["email", "password"];
const EMAIL_RE = /\S+@\S+\.\S+/;

export function SignInFlow({
  next = "/",
  accountConfirmed = false,
}: {
  next?: string;
  accountConfirmed?: boolean;
}) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [modal, setModal] = useState<AuthModalState>({ status: "idle" });

  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const refs: Record<Step, React.RefObject<HTMLInputElement | null>> = {
      email: emailRef,
      password: passwordRef,
    };
    const timer = setTimeout(() => refs[step].current?.focus(), 500);
    return () => clearTimeout(timer);
  }, [step]);

  const isEmailValid = EMAIL_RE.test(email);
  const isPasswordValid = password.length >= 6;

  const goBack = useCallback(() => setStep("email"), []);

  // Real Supabase call; until Google is enabled in the Supabase dashboard
  // this returns "provider is not enabled" and is shown honestly.
  const handleGoogle = async () => {
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
      });
      if (error) throw error;
    } catch (error: unknown) {
      setModal({
        status: "error",
        message: error instanceof Error ? error.message : "Could not start Google sign-in.",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setModal({ status: "loading", messages: ["Logging you in..."] });

    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setModal({ status: "error", message: error.message });
        return;
      }

      // No confetti here — members logging in want speed, not a flourish.
      router.push(next);
    } catch (error: unknown) {
      const message =
        error instanceof SupabaseConfigError
          ? error.message
          : error instanceof TypeError
            ? "Cannot reach the configured Supabase service. If you are working locally, start Supabase and run npm run dev:local."
            : error instanceof Error
              ? error.message
              : "Could not log in.";
      setModal({ status: "error", message });
    }
  };

  const closeModal = () => setModal({ status: "idle" });

  const stepVariants: Variants = reduceMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, x: 24 },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -24 },
      };
  const stepTransition = { duration: reduceMotion ? 0 : 0.3, ease: [0.25, 1, 0.5, 1] as const };

  return (
    <GlassAuthShell>
      <AuthModal state={modal} onClose={closeModal} />

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <fieldset disabled={modal.status === "loading"} className="flex flex-col gap-6">
          <p aria-live="polite" className="sr-only">
            Step {STEPS.indexOf(step) + 1} of {STEPS.length}
          </p>

          <AnimatePresence mode="wait">
            {step === "email" && (
              <motion.div
                key="email"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={stepVariants}
                transition={stepTransition}
              >
                <BlurFade>
                  <h1 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">
                    Welcome back
                  </h1>
                  <p className="mt-2 text-muted-foreground">Log in to your member portal</p>
                  {accountConfirmed && (
                    <p className="mt-4 rounded-2xl border border-emerald-400/30 bg-emerald-400/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-200" role="status">
                      Account confirmed. You can log in now.
                    </p>
                  )}
                </BlurFade>

                <div className="mt-8 flex flex-col items-center gap-4">
                  <span className="text-sm text-muted-foreground">Continue with</span>
                  {/* Explicit aria-label: the unset-styled button computes an
                      empty accessible name in Chromium despite visible text. */}
                  <GlassButton
                    type="button"
                    onClick={handleGoogle}
                    aria-label="Continue with Google"
                    contentClassName="flex items-center gap-2"
                  >
                    <GoogleIcon className="h-5 w-5" />
                    Google
                  </GlassButton>
                </div>

                <div
                  className="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-muted-foreground"
                  role="separator"
                  aria-orientation="horizontal"
                >
                  <span className="h-px flex-1 bg-border" />
                  or
                  <span className="h-px flex-1 bg-border" />
                </div>

                <GlassField
                  id="email"
                  label="Email address"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && isEmailValid) {
                      e.preventDefault();
                      setStep("password");
                    }
                  }}
                  autoComplete="email"
                  leadingIcon={<Mail className="h-4 w-4" />}
                  isValid={isEmailValid}
                  onAdvance={() => setStep("password")}
                  advanceAriaLabel="Continue to password"
                  inputRef={emailRef}
                />
              </motion.div>
            )}

            {step === "password" && (
              <motion.div
                key="password"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={stepVariants}
                transition={stepTransition}
              >
                <BlurFade>
                  <h1 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">
                    Your password
                  </h1>
                  <p className="mt-2 text-muted-foreground">
                    <Link
                      href="/auth/forgot-password"
                      className="underline underline-offset-4 hover:text-foreground"
                    >
                      Forgot your password?
                    </Link>
                  </p>
                </BlurFade>

                <div className="mt-8">
                  <GlassField
                    id="password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    autoComplete="current-password"
                    leadingIcon={<Lock className="h-4 w-4" />}
                    isValid={isPasswordValid}
                    advanceType="submit"
                    advanceAriaLabel="Log in"
                    inputRef={passwordRef}
                  />
                </div>

                <button
                  type="button"
                  onClick={goBack}
                  className="mt-4 text-sm text-muted-foreground hover:text-foreground"
                >
                  Go back
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-sm text-muted-foreground">
            New to CFA?{" "}
            <Link href={`/auth/sign-up?next=${encodeURIComponent(next)}`} className="font-medium text-foreground underline underline-offset-4">
              Create a guest account
            </Link>
          </p>
        </fieldset>
      </form>
    </GlassAuthShell>
  );
}
