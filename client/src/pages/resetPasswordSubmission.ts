export type ResetPasswordSubmission = {
  token: string;
  newPassword: string;
};

type ResetPasswordSubmissionInput = {
  urlToken: string;
  verifiedToken: string;
  newPassword: string;
  confirmPassword: string;
};

type ResetPasswordSubmissionResult =
  | { ok: true; value: ResetPasswordSubmission }
  | { ok: false; message: string };

export function prepareResetPasswordSubmission(
  input: ResetPasswordSubmissionInput
): ResetPasswordSubmissionResult {
  const token = String(input.urlToken || input.verifiedToken || "").trim();
  if (!token) {
    return { ok: false, message: "Your reset session is missing. Request a new link or code." };
  }
  if (input.newPassword.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if (input.newPassword !== input.confirmPassword) {
    return { ok: false, message: "Passwords do not match." };
  }
  return {
    ok: true,
    value: {
      token,
      newPassword: input.newPassword,
    },
  };
}
