import { AuthForm } from "@/components/AuthForm";
export default function ForgotPasswordPage() {
  return (
    <>
      <h2 className="text-3xl font-semibold tracking-tight">
        Reset your password
      </h2>
      <p className="mt-2 mb-8 text-sm leading-6 text-muted-foreground">
        Enter your email and we’ll send you a reset link.
      </p>
      <AuthForm mode="forgot-password" />
    </>
  );
}
