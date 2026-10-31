import Link from "next/link";
import { Infinity as Loop } from "lucide-react";
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="min-h-screen lg:grid lg:grid-cols-[0.9fr_1.1fr]">
      <section className="flex flex-col justify-between bg-[#123f35] p-6 text-white lg:p-14">
        <Link
          href="/"
          className="flex w-fit items-center gap-3 text-xl font-semibold"
        >
          <Loop size={32} aria-hidden="true" />
          Brightloop
        </Link>
        <div className="my-24 hidden max-w-md lg:block">
          <h1 className="text-5xl leading-tight font-semibold tracking-tight">
            Your subscriptions.
            <br />
            One clear workspace.
          </h1>
          <p className="mt-6 max-w-sm leading-7 text-[#d2e7df]">
            A shared home for Brightloop Software and its customers.
          </p>
        </div>
        <p className="hidden text-sm text-[#d2e7df] lg:block">
          Brightloop Software
        </p>
      </section>
      <section className="flex items-center justify-center px-6 py-12 lg:p-16">
        <div className="w-full max-w-sm">{children}</div>
      </section>
    </main>
  );
}
