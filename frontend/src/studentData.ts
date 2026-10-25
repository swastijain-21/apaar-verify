export type VerificationStatus = "verified" | "pending" | "flagged";
export type DemoApaarOutcome =
  | "Demo match"
  | "No demo match"
  | "Needs manual review";

export const demoApaarOutcomeLabels: Record<DemoApaarOutcome, string> = {
  "Demo match": "Record Matched",
  "No demo match": "Record Mismatch",
  "Needs manual review": "Requires Verification",
};

export interface Student {
  id: string;
  name: string;
  rollNumber: string;
  institution: string;
  apaarId: string;
  demoApaarOutcome?: DemoApaarOutcome | null;
  status: VerificationStatus;
  verifierNote?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEntry {
  id: string;
  studentId: string;
  studentName: string;
  action: string;
  detail: string;
  timestamp: string;
  actorUserId?: string | null;
}

export interface DemoData {
  students: Student[];
  audit: AuditEntry[];
}

const STORAGE_KEY = "eduverify-demo-data-v1";

export const initialStudents: Student[] = [
  {
    id: "demo-student-1",
    name: "Aarav Sharma",
    rollNumber: "DEMO-ISE-001",
    institution: "Sample Engineering College",
    apaarId: "1234-5678-9012",
    status: "verified",
    createdAt: "2026-10-21T09:15:00.000Z",
    updatedAt: "2026-10-22T10:30:00.000Z",
  },
  {
    id: "demo-student-2",
    name: "Ananya Rao",
    rollNumber: "DEMO-ISE-002",
    institution: "Sample Engineering College",
    apaarId: "0000-0000-0000",
    status: "pending",
    createdAt: "2026-10-22T11:00:00.000Z",
    updatedAt: "2026-10-22T11:00:00.000Z",
  },
  {
    id: "demo-student-3",
    name: "Rohan Mehta",
    rollNumber: "DEMO-CSE-014",
    institution: "Example Institute of Technology",
    apaarId: "1111-2222-3333",
    status: "flagged",
    verifierNote: "Demo note: confirm the enrollment reference with the institution.",
    createdAt: "2026-10-23T08:20:00.000Z",
    updatedAt: "2026-10-23T13:45:00.000Z",
  },
  {
    id: "demo-student-4",
    name: "Diya Nair",
    rollNumber: "DEMO-ECE-008",
    institution: "Example Institute of Technology",
    apaarId: "4444-5555-6666",
    status: "verified",
    createdAt: "2026-10-24T07:30:00.000Z",
    updatedAt: "2026-10-24T08:05:00.000Z",
  },
];

export const initialAudit: AuditEntry[] = [
  {
    id: "demo-audit-1",
    studentId: "demo-student-1",
    studentName: "Aarav Sharma",
    action: "Demo status set to verified",
    detail: "Initial sample record; no official APAAR check was performed.",
    timestamp: "2026-10-22T10:30:00.000Z",
  },
  {
    id: "demo-audit-2",
    studentId: "demo-student-3",
    studentName: "Rohan Mehta",
    action: "Demo record flagged",
    detail: "Confirm the enrollment reference with the institution.",
    timestamp: "2026-10-23T13:45:00.000Z",
  },
];

const isStatus = (value: unknown): value is VerificationStatus =>
  value === "verified" || value === "pending" || value === "flagged";

export function normalizeVerificationStatus(value: unknown): VerificationStatus {
  if (typeof value === "string") {
    const normalized = value.trim().toLocaleLowerCase();
    if (isStatus(normalized)) return normalized;
  }
  throw new Error(`Unsupported student verification status: ${String(value)}`);
}

const isDemoApaarOutcome = (value: unknown): value is DemoApaarOutcome =>
  value === "Demo match" ||
  value === "No demo match" ||
  value === "Needs manual review";

const migrateStudent = (value: unknown): Student | null => {
  if (!value || typeof value !== "object") return null;
  const student = value as Record<string, unknown>;
  if (
    typeof student.id !== "string" ||
    typeof student.name !== "string" ||
    typeof student.rollNumber !== "string" ||
    typeof student.institution !== "string" ||
    (student.apaarId !== undefined && typeof student.apaarId !== "string") ||
    (student.demoApaarOutcome !== undefined &&
      student.demoApaarOutcome !== null &&
      !isDemoApaarOutcome(student.demoApaarOutcome)) ||
    (typeof student.status !== "string" ||
      !isStatus(student.status.trim().toLocaleLowerCase())) ||
    (student.verifierNote !== undefined &&
      typeof student.verifierNote !== "string") ||
    typeof student.createdAt !== "string" ||
    typeof student.updatedAt !== "string"
  ) {
    return null;
  }

  return {
    id: student.id,
    name: student.name,
    rollNumber: student.rollNumber,
    institution: student.institution,
    apaarId: student.apaarId ?? "",
    demoApaarOutcome: isDemoApaarOutcome(student.demoApaarOutcome)
      ? student.demoApaarOutcome
      : null,
    status: normalizeVerificationStatus(student.status),
    ...(student.verifierNote === undefined
      ? {}
      : { verifierNote: student.verifierNote }),
    createdAt: student.createdAt,
    updatedAt: student.updatedAt,
  };
};

const isAuditEntry = (value: unknown): value is AuditEntry => {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (
    typeof entry.id === "string" &&
    typeof entry.studentId === "string" &&
    typeof entry.studentName === "string" &&
    typeof entry.action === "string" &&
    typeof entry.detail === "string" &&
    typeof entry.timestamp === "string" &&
    (entry.actorUserId === undefined ||
      entry.actorUserId === null ||
      typeof entry.actorUserId === "string")
  );
};

export function loadDemoData(): { data: DemoData; error: string | null } {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return {
        data: { students: initialStudents, audit: initialAudit },
        error: null,
      };
    }

    const parsed: unknown = JSON.parse(saved);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      !Array.isArray((parsed as Record<string, unknown>).students) ||
      !Array.isArray((parsed as Record<string, unknown>).audit)
    ) {
      throw new Error("Saved student data has an unsupported format.");
    }

    const students = (parsed as { students: unknown[] }).students.map(
      migrateStudent,
    );
    const audit = (parsed as { audit: unknown[] }).audit;
    if (
      students.some((student) => student === null) ||
      !audit.every(isAuditEntry)
    ) {
      throw new Error("Saved student data has an unsupported format.");
    }

    return {
      data: {
        students: students.filter((student): student is Student => student !== null),
        audit,
      },
      error: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Browser storage is unavailable.";
    return {
      data: { students: initialStudents, audit: initialAudit },
      error: `Could not load saved student data: ${message}`,
    };
  }
}

export function saveDemoData(data: DemoData): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function createInitialDemoData(): DemoData {
  return { students: initialStudents, audit: initialAudit };
}
