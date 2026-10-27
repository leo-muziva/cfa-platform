import { ForgotPasswordForm } from "@/components/forgot-password-form";

/** /auth/forgot-password: asks for an email and sends a password reset link. */
export default function Page() {
  return (
    <div className="flex min-h-[calc(100svh-var(--site-nav-height))] w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <ForgotPasswordForm />
      </div>
    </div>
  );
}
