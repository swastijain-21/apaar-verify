import type { DemoApaarOutcome } from "./studentData";

export type DemoVerificationOutcome = DemoApaarOutcome;

export interface DemoVerificationResult {
  mode: "demo";
  outcome: DemoVerificationOutcome;
  message: string;
}

export interface OfficialVerificationResult {
  mode: "official";
  outcome: string;
  message: string;
}

export type VerificationResult =
  | DemoVerificationResult
  | OfficialVerificationResult;

export interface ApaarVerificationProvider<
  T extends VerificationResult = VerificationResult,
> {
  readonly mode: T["mode"];
  verify(apaarId: string): Promise<T>;
}

const demoMatchId = "123456789012";
const demoNoMatchId = "000000000000";

export function normalizeApaarId(apaarId: string): string {
  return apaarId.replace(/[- ]/g, "");
}

export function validateApaarId(
  apaarId: string,
): { valid: true } | { valid: false; message: string } {
  const trimmed = apaarId.trim();
  if (!trimmed) {
    return {
      valid: false,
      message: "Enter a fictional demo APAAR ID to continue.",
    };
  }
  if (!/^(?:\d{12}|\d{4}[- ]\d{4}[- ]\d{4})$/.test(trimmed)) {
    return {
      valid: false,
      message:
        "Use 12 digits, optionally grouped as 1234-5678-9012. This format check does not prove the ID is genuine.",
    };
  }
  return { valid: true };
}

export const demoVerificationProvider: ApaarVerificationProvider<DemoVerificationResult> = {
  mode: "demo",
  async verify(apaarId) {
    const normalized = normalizeApaarId(apaarId.trim());
    if (normalized === demoMatchId) {
      return {
        mode: "demo",
        outcome: "Demo match",
        message: "This fictional test ID matches a local demo fixture only.",
      };
    }
    if (normalized === demoNoMatchId) {
      return {
        mode: "demo",
        outcome: "No demo match",
        message: "This fictional test ID has no matching local demo fixture.",
      };
    }
    return {
      mode: "demo",
      outcome: "Needs manual review",
      message: "No demo fixture result is defined for this ID.",
    };
  },
};

export const officialVerificationProvider: ApaarVerificationProvider<OfficialVerificationResult> | null = null;

export const officialVerificationUnavailableMessage =
  "Official verification unavailable — demo mode only";
