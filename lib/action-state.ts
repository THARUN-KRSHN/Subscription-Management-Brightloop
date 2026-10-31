export type ActionState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  message?: string;
};
export type FormAction = (
  previous: ActionState,
  form: FormData,
) => Promise<ActionState>;
