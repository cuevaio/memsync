export const APP_NAME = "MemSync";
export const APP_TAGLINE = "Keep Claude and ChatGPT memory in sync.";
export const BILLING_MONTHLY_PRICE_LABEL = "$5/month";
export const BILLING_TRIAL_DAYS = 14;

export type EntitlementStatus = "inactive" | "trialing" | "active" | "canceled" | "past_due";

export type ExtensionAuthStatus =
  | "anonymous"
  | "verifying"
  | "authenticated"
  | "invalid"
  | "subscription_required";

export type ExtensionAuthSnapshot = {
  token: string | null;
  tokenPreview: string | null;
  status: ExtensionAuthStatus;
  userEmail: string | null;
  verifiedAt: string | null;
  lastError: string | null;
};

export type ExtensionTokenRecord = {
  id: string;
  label: string;
  tokenPreview: string;
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
};

export type ExtensionTokenVerificationResult = {
  ok: boolean;
  status: ExtensionAuthStatus;
  userEmail: string | null;
  tokenPreview: string | null;
  verifiedAt: string | null;
  message: string | null;
};
