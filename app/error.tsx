"use client";
import { Button } from "@/components/ui/button";
export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">We couldn’t load this page</h1>
      <p className="my-4 text-muted-foreground">
        Check your connection and try again. If this is a new installation,
        check the Supabase setup in README.md.
      </p>
      <Button onClick={reset}>Try again</Button>
    </main>
  );
}
