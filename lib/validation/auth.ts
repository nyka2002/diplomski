import { z } from "zod";

// Error messages are stable KEYS (not prose) so the UI can render them in the
// active language. See `translations[lang].validation` for the copy.
// Both the client (button-enable + inline errors) and the server actions (trust
// boundary) validate with these same schemas.

const firstName = z.string().trim().min(1, "required");
const lastName = z.string().trim().min(1, "required");
const username = z
  .string()
  .trim()
  .min(3, "usernameMin")
  .regex(/^[a-zA-Z0-9_.]+$/, "usernameChars");
const email = z.string().trim().min(1, "required").email("emailInvalid");
const phone = z
  .string()
  .trim()
  .regex(/^[+\d][\d\s().-]{5,}$/, "phoneInvalid")
  .optional()
  .or(z.literal(""));
const password = z
  .string()
  .min(8, "passwordMin")
  .regex(/[A-Za-z]/, "passwordLetter")
  .regex(/\d/, "passwordNumber");

export const registerSchema = z
  .object({
    firstName,
    lastName,
    username,
    email,
    phone,
    password,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    path: ["confirm"],
    message: "confirmMismatch",
  });

export const signInSchema = z.object({
  identifier: z.string().trim().min(1, "required"),
  password: z.string().min(1, "required"),
});

export const profileSchema = z.object({
  firstName,
  lastName,
  username,
  email,
  phone,
});

export const passwordChangeSchema = z
  .object({
    current: z.string().min(1, "required"),
    newPw: password,
    confirm: z.string(),
  })
  .refine((d) => d.newPw === d.confirm, {
    path: ["confirm"],
    message: "confirmMismatch",
  });

export type RegisterInput = z.infer<typeof registerSchema>;
export type SignInInput = z.infer<typeof signInSchema>;
export type ProfileInput = z.infer<typeof profileSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;

// Map a Zod result to { field: errorKey } for inline display.
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path[0];
    if (typeof key === "string" && !out[key]) out[key] = issue.message;
  }
  return out;
}
