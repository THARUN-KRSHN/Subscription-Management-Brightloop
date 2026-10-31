import { AuthForm } from "@/components/AuthForm";
export default function SignupPage() {
  return (
    <>
      <h2 className="text-3xl font-semibold tracking-tight">
        Create your account
      </h2>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Get access to your customer portal.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
