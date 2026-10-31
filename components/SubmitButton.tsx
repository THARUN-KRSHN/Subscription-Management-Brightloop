"use client";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
export function SubmitButton({
  children = "Save changes",
  variant = "default",
}: {
  children?: React.ReactNode;
  variant?: "default" | "outline" | "destructive";
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending}>
      {pending ? "Saving…" : children}
    </Button>
  );
}
