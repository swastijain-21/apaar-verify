import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AuditEntry,
  DemoApaarOutcome,
  DemoData,
  Student,
} from "./studentData";
import {
  initialAudit,
  initialStudents,
  normalizeVerificationStatus,
} from "./studentData";

interface StudentRow {
  id: string;
  name: string;
  roll_number: string;
  institution: string;
  apaar_id: string;
  demo_apaar_outcome: DemoApaarOutcome | null;
  status: string;
  verifier_note: string | null;
  created_at: string;
  updated_at: string;
}

interface AuditRow {
  id: string;
  student_id: string | null;
  student_name: string;
  action: string;
  detail: string;
  occurred_at: string;
  user_id: string;
}

function studentFromRow(row: StudentRow): Student {
  return {
    id: row.id,
    name: row.name,
    rollNumber: row.roll_number,
    institution: row.institution,
    apaarId: row.apaar_id,
    demoApaarOutcome: row.demo_apaar_outcome,
    status: normalizeVerificationStatus(row.status),
    ...(row.verifier_note ? { verifierNote: row.verifier_note } : {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function auditFromRow(row: AuditRow): AuditEntry {
  return {
    id: row.id,
    studentId: row.student_id ?? "",
    studentName: row.student_name,
    action: row.action,
    detail: row.detail,
    timestamp: row.occurred_at,
    actorUserId: row.user_id,
  };
}

function throwIfError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function loadSupabaseData(
  client: SupabaseClient,
): Promise<DemoData> {
  const [studentsResult, auditResult] = await Promise.all([
    client
      .from("student_records")
      .select("id,name,roll_number,institution,apaar_id,demo_apaar_outcome,status,verifier_note,created_at,updated_at")
      .order("created_at", { ascending: false }),
    client
      .from("verification_audit_logs")
      .select("id,student_id,student_name,action,detail,occurred_at,user_id")
      .order("occurred_at", { ascending: false }),
  ]);

  throwIfError(studentsResult.error);
  throwIfError(auditResult.error);

  return {
    students: (studentsResult.data as StudentRow[]).map(studentFromRow),
    audit: (auditResult.data as AuditRow[]).map(auditFromRow),
  };
}

export async function saveSupabaseStudent(
  client: SupabaseClient,
  userId: string,
  student: Student,
): Promise<Student> {
  const { data, error } = await client.from("student_records").upsert(
    {
      id: student.id,
      user_id: userId,
      name: student.name,
      roll_number: student.rollNumber,
      institution: student.institution,
      apaar_id: student.apaarId,
      demo_apaar_outcome: student.demoApaarOutcome ?? null,
      status: student.status,
      verifier_note: student.verifierNote ?? null,
      created_at: student.createdAt,
      updated_at: student.updatedAt,
    },
    { onConflict: "id" },
  ).select(
    "id,name,roll_number,institution,apaar_id,demo_apaar_outcome,status,verifier_note,created_at,updated_at",
  ).single();
  throwIfError(error);
  if (!data) throw new Error("Supabase did not return the saved student record.");
  return studentFromRow(data as StudentRow);
}

export async function deleteSupabaseStudent(
  client: SupabaseClient,
  userId: string,
  studentId: string,
): Promise<void> {
  const { error } = await client
    .from("student_records")
    .delete()
    .eq("id", studentId)
    .eq("user_id", userId);
  throwIfError(error);
}

export async function insertSupabaseAudit(
  client: SupabaseClient,
  userId: string,
  entry: AuditEntry,
): Promise<void> {
  const { error } = await client.from("verification_audit_logs").insert({
    id: entry.id,
    user_id: userId,
    student_id: entry.studentId || null,
    student_name: entry.studentName,
    action: entry.action,
    detail: entry.detail,
    occurred_at: entry.timestamp,
  });
  throwIfError(error);
}

export async function restoreSupabaseDemoData(
  client: SupabaseClient,
  userId: string,
): Promise<DemoData> {
  const { error: deleteError } = await client
    .from("student_records")
    .delete()
    .eq("user_id", userId);
  throwIfError(deleteError);

  const now = new Date().toISOString();
  const students = initialStudents.map((student) => ({
    ...student,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  }));
  const studentRows = students.map((student) => ({
    id: student.id,
    user_id: userId,
    name: student.name,
    roll_number: student.rollNumber,
    institution: student.institution,
    apaar_id: student.apaarId,
    demo_apaar_outcome: student.demoApaarOutcome ?? null,
    status: student.status,
    verifier_note: student.verifierNote ?? null,
    created_at: student.createdAt,
    updated_at: student.updatedAt,
  }));
  const { error: insertError } = await client
    .from("student_records")
    .insert(studentRows);
  throwIfError(insertError);

  const studentIds = new Map(
    initialStudents.map((initial, index) => [initial.id, students[index].id]),
  );
  const audit: AuditEntry[] = initialAudit.map((entry) => ({
    ...entry,
    id: crypto.randomUUID(),
    studentId: studentIds.get(entry.studentId) ?? "",
    timestamp: now,
    actorUserId: userId,
  }));
  const auditRows = audit.map((entry) => ({
    id: entry.id,
    user_id: userId,
    student_id: entry.studentId,
    student_name: entry.studentName,
    action: entry.action,
    detail: entry.detail,
    occurred_at: entry.timestamp,
  }));
  const { error: auditError } = await client
    .from("verification_audit_logs")
    .insert(auditRows);
  throwIfError(auditError);

  return { students, audit };
}
