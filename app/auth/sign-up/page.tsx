import { SignUpForm } from "@/components/sign-up-form";

export default function Page() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm flex flex-col gap-6">
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-tight">Cape Fencing Academy</h1>
          <p className="text-sm text-muted-foreground mt-1">Create your member account</p>
        </div>
        <SignUpForm />
      </div>
    </div>
  );
}
