"use client";
export function PrintButton({ className = "", children = "Print" }: { className?: string; children?: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => typeof window !== "undefined" && window.print()}
      className={className}
    >
      {children}
    </button>
  );
}
