"use server";
import { z } from "zod";
import { requireRole } from "@/lib/auth";
import { transition, type TransitionAction } from "@/lib/subscriptions/transitions";

export async function customerTransition(formData: FormData, action: TransitionAction) {
  const user = await requireRole(["customer"]);
  const id = z.coerce.number().int().positive().parse(formData.get("id"));
  await transition(id, action, user);
}
