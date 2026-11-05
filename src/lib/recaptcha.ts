const VERIFY_URL = "https://www.google.com/recaptcha/api/siteverify";
export const RECAPTCHA_ACTION = "submit_contact_form";

type SiteVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  hostname?: string;
  "error-codes"?: string[];
};

export function getRecaptchaSiteKey(): string | undefined {
  return process.env.RECAPTCHA_SITE_KEY || undefined;
}

// Verifies a reCAPTCHA v3 token. With no secret configured (local dev),
// verification is skipped so forms keep working.
export async function verifyRecaptcha(
  token: string | undefined,
  remoteIp?: string,
): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true;
  if (!token) {
    console.warn("reCAPTCHA rejected: missing token");
    return false;
  }

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? "0.5");
  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) body.set("remoteip", remoteIp);

  const res = await fetch(VERIFY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) {
    throw new Error(`reCAPTCHA siteverify failed: ${res.status}`);
  }
  const result = (await res.json()) as SiteVerifyResponse;

  const ok =
    result.success &&
    result.action === RECAPTCHA_ACTION &&
    (result.score ?? 0) >= minScore;
  if (!ok) {
    console.warn("reCAPTCHA rejected:", {
      score: result.score,
      action: result.action,
      hostname: result.hostname,
      errors: result["error-codes"],
    });
  }
  return ok;
}
