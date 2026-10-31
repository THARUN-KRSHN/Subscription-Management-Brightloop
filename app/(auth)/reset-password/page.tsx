import Link from "next/link";
import { AuthForm } from "@/components/AuthForm";
import { getSessionUser } from "@/lib/auth";
export default async function ResetPasswordPage() {
  const user = await getSessionUser();
  return (
    <>
      <h2 className="text-3xl font-semibold tracking-tight">
        Choose a new password
      </h2>
      <p className="mt-2 mb-8 text-sm leading-6 text-muted-foreground">
        Use a unique password to keep your account secure.
      </p>
      {user ? (
        <AuthForm mode="reset-password" />
      ) : (
        <p role="alert" className="text-sm leading-6">
          This reset link is invalid or expired.{" "}
          <Link className="text-primary underline" href="/forgot-password">
            Request a new reset link
          </Link>
          .
        </p>
      )}
    </>
  );
}
