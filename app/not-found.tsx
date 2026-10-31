import Link from "next/link";
export default function NotFound() {
  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-semibold">Page not found</h1>
      <p className="my-4">This page doesn’t exist.</p>
      <Link href="/" className="text-primary underline">
        Go to your home
      </Link>
    </main>
  );
}
