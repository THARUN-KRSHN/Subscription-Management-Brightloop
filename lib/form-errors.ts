import type { ActionState } from "./action-state";
export function formErrors(
  issues: { path: PropertyKey[]; message: string }[],
): ActionState {
  return {
    error: "Check the highlighted fields and try again.",
    fieldErrors: Object.fromEntries(
      issues.map((issue) => [String(issue.path[0]), issue.message]),
    ),
  };
}
export function actionError(error: unknown): ActionState {
  return {
    error:
      error instanceof Error
        ? error.message
        : "Could not save your changes. Please try again.",
  };
}
