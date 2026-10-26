"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type Variants } from "framer-motion";
import { Lock, Mail, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { emailConfirmRedirect } from "@/lib/auth-next";
import {
  AuthModal,
  type AuthModalState,
  BlurFade,
  Confetti,
  type ConfettiRef,
  GlassAuthShell,
  GlassButton,
  GlassField,
  GoogleIcon,
} from "@/components/ui/glass-auth";

type Step = "name" | "email" | "password" | "confirm";
const STEPS: Step[] = ["name", "email", "password", "confirm"];
const EMAIL_RE = /\S+@\S+\.\S+/;

export function SignUpFlow({ next = "/" }: { next?: string }) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  const [step, setStep] = useState<Step>("name");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [modal, setModal] = useState<AuthModalState>({ status: "idle" });

  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const confettiRef = useRef<ConfettiRef>(null);

  // Autofocus the active step's input once its enter transition has mostly
  // settled — mirrors the reference component's step-change behaviour.
  useEffect(() => {
    const refs: Record<Step, React.RefObject<HTMLInputElement | null>> = {
      name: nameRef,
      email: emailRef,
      password: passwordRef,
      confirm: confirmRef,
    };
    const timer = setTimeout(() => refs[step].current?.focus(), 500);
    return () => clearTimeout(timer);
  }, [step]);

  const isNameValid = fullName.trim().length >= 2;
  const isEmailValid = EMAIL_RE.test(email);
  const isPasswordValid = password.length >= 6;
  const isConfirmValid = confirmPassword.length >= 6;

  const goTo = useCallback((next: Step) => setStep(next), []);
  const goBack = useCallback(() => {
    const index = STEPS.indexOf(step);
    if (index > 0) setStep(STEPS[index - 1]);
  }, [step]);

  const advanceOnEnter =
    (isValid: boolean, next: Step) => (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && isValid) {
        e.preventDefault();
        goTo(next);
      }
    };

  // Google OAuth is a real Supabase call; until the provider is enabled in
  // the Supabase dashboard this will surface "provider is not enabled" —
  // shown honestly via the error modal rather than swallowed.
  const handleGoogle = async () => {
    const supabase = createClient();
    try {
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

  const fireSideCannons = useCallback(() => {
    if (reduceMotion) return; // confetti is purely decorative motion
    const base = { startVelocity: 30, spread: 360, ticks: 60, particleCount: 50 };
    confettiRef.current?.fire({ ...base, angle: 60, origin: { x: 0, y: 1 } });
    confettiRef.current?.fire({ ...base, angle: 120, origin: { x: 1, y: 1 } });
  }, [reduceMotion]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setModal({ status: "error", message: "Passwords do not match" });
      return;
    }

    setModal({
      status: "loading",
      messages: ["Creating your account...", "Setting up your profile..."],
    });

    const supabase = createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: emailConfirmRedirect(window.location.origin, next),
        // Stored as raw_user_meta_data; the handle_new_user DB trigger
        // copies full_name onto the auto-created profiles row.
        data: { full_name: fullName.trim() },
      },
    });

    if (error) {
      setModal({ status: "error", message: error.message });
      return;
    }

    fireSideCannons();
    // With email confirmation switched off, Supabase signs the user in at
    // once, so "check your inbox" would be untrue.
    if (data.session) {
      setModal({
        status: "success",
        title: "Welcome to CFA!",
        message: "Your account is ready. Next, complete your profile.",
        actionLabel: "Continue",
        onAction: () => {
          router.push("/protected/complete-profile");
          router.refresh();
        },
      });
      return;
    }
    setModal({
      status: "success",
      title: "Almost there!",
      message: "Check your email to confirm your account.",
      actionLabel: "Go to login",
      onAction: () => router.push(`/auth/login?next=${encodeURIComponent(next)}`),
    });
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
      <Confetti
        ref={confettiRef}
        manualstart
        className="pointer-events-none fixed inset-0 z-[999] h-full w-full"
      />
      <AuthModal state={modal} onClose={closeModal} />

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        {/* Disabled while a modal is open — blocks edits and double-submits
            while the real Supabase call is in flight. */}
        <fieldset disabled={modal.status === "loading"} className="flex flex-col gap-6">
          <p aria-live="polite" className="sr-only">
            Step {STEPS.indexOf(step) + 1} of {STEPS.length}
          </p>

          <AnimatePresence mode="wait">
            {step === "name" && (
              <motion.div
                key="name"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={stepVariants}
                transition={stepTransition}
              >
                <BlurFade className="text-center">
                  <h1 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">
                    Create your account
                  </h1>
                  <p className="mt-2 text-muted-foreground">What should we call you?</p>
                </BlurFade>

                <div className="mt-8">
                  <GlassField
                    id="full-name"
                    label="Full name"
                    value={fullName}
                    onChange={setFullName}
                    onKeyDown={advanceOnEnter(isNameValid, "email")}
                    autoComplete="name"
                    leadingIcon={<User className="h-4 w-4" />}
                    isValid={isNameValid}
                    onAdvance={() => goTo("email")}
                    advanceAriaLabel="Continue to email"
                    inputRef={nameRef}
                  />
                </div>
              </motion.div>
            )}

            {step === "email" && (
              <motion.div
                key="email"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={stepVariants}
                transition={stepTransition}
              >
                <BlurFade className="text-center">
                  <h1 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">
                    Your email
                  </h1>
                  <p className="mt-2 text-muted-foreground">We&apos;ll send a confirmation link.</p>
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
                  onKeyDown={advanceOnEnter(isEmailValid, "password")}
                  autoComplete="email"
                  leadingIcon={<Mail className="h-4 w-4" />}
                  isValid={isEmailValid}
                  onAdvance={() => goTo("password")}
                  advanceAriaLabel="Continue to password"
                  inputRef={emailRef}
                />

                <button
                  type="button"
                  onClick={goBack}
                  className="mx-auto mt-4 block text-sm text-muted-foreground hover:text-foreground"
                >
                  Go back
                </button>
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
                <BlurFade className="text-center">
                  <h1 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">
                    Create your password
                  </h1>
                  <p className="mt-2 text-muted-foreground">At least 6 characters.</p>
                </BlurFade>

                <div className="mt-8">
                  <GlassField
                    id="password"
                    label="Password"
                    type="password"
                    value={password}
                    onChange={setPassword}
                    onKeyDown={advanceOnEnter(isPasswordValid, "confirm")}
                    autoComplete="new-password"
                    leadingIcon={<Lock className="h-4 w-4" />}
                    isValid={isPasswordValid}
                    onAdvance={() => goTo("confirm")}
                    advanceAriaLabel="Continue to confirm password"
                    inputRef={passwordRef}
                  />
                </div>

                <button
                  type="button"
                  onClick={goBack}
                  className="mx-auto mt-4 block text-sm text-muted-foreground hover:text-foreground"
                >
                  Go back
                </button>
              </motion.div>
            )}

            {step === "confirm" && (
              <motion.div
                key="confirm"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={stepVariants}
                transition={stepTransition}
              >
                <BlurFade className="text-center">
                  <h1 className="font-serif text-4xl font-light tracking-tight sm:text-5xl">
                    One last step
                  </h1>
                  <p className="mt-2 text-muted-foreground">
                    Confirm your password to continue.
                  </p>
                </BlurFade>

                <div className="mt-8">
                  <GlassField
                    id="confirm-password"
                    label="Confirm password"
                    type="password"
                    value={confirmPassword}
                    onChange={setConfirmPassword}
                    autoComplete="new-password"
                    leadingIcon={<Lock className="h-4 w-4" />}
                    isValid={isConfirmValid}
                    advanceType="submit"
                    advanceAriaLabel="Create account"
                    inputRef={confirmRef}
                  />
                </div>

                <button
                  type="button"
                  onClick={goBack}
                  className="mx-auto mt-4 block text-sm text-muted-foreground hover:text-foreground"
                >
                  Go back
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={`/auth/login?next=${encodeURIComponent(next)}`} className="font-medium text-foreground underline underline-offset-4">
              Log in
            </Link>
          </p>
        </fieldset>
      </form>
    </GlassAuthShell>
  );
}
