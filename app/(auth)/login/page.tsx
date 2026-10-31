import { redirect } from "next/navigation";
import { AuthForm } from "@/components/AuthForm";
import { getSessionUser, roleHome } from "@/lib/auth";
import { single, type SearchParams } from "@/lib/pagination";
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const user = await getSessionUser();
  if (user) redirect(roleHome(user.role));
  const params = await searchParams;
  return (
    <>
      <h2 className="text-3xl font-semibold tracking-tight">Welcome back</h2>
      <p className="mt-2 mb-8 text-sm text-muted-foreground">
        Log in to your Brightloop workspace.
      </p>
      {single(params.message) === "password-updated" && (
        <p role="status" className="mb-5 text-sm text-primary">
          Password updated. Log in with your new password.
        </p>
      )}
      {single(params.error) && (
        <p role="alert" className="mb-5 text-sm text-destructive">
          Your session or email link is unavailable. Try logging in or request a
          new link.
        </p>
      )}
      <AuthForm mode="login" />
    </>
  );
}
