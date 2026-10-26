import { useEffect, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronRight,
  Clock3,
  Database,
  FileCheck2,
  GraduationCap,
  LayoutDashboard,
  Plus,
  RotateCcw,
  Search,
  Settings,
  ShieldCheck,
  Trash2,
  Users,
  X,
  Info,
  Pencil,
  Eye,
  EyeOff,
} from "lucide-react";
import {
  demoVerificationProvider,
  normalizeApaarId,
  officialVerificationProvider,
  officialVerificationUnavailableMessage,
  validateApaarId,
} from "./apaarVerification";
import type { DemoVerificationResult } from "./apaarVerification";
import {
  createInitialDemoData,
  loadDemoData,
  saveDemoData,
} from "./studentData";
import type {
  AuditEntry,
  Student,
  VerificationStatus,
} from "./studentData";
import { demoApaarOutcomeLabels } from "./studentData";
import {
  isSupabaseConfigured,
  supabase,
  supabaseConfigurationError,
} from "./supabaseClient";
import {
  deleteSupabaseStudent,
  insertSupabaseAudit,
  loadSupabaseData,
  restoreSupabaseDemoData,
  saveSupabaseStudent,
} from "./supabaseData";
import "./App.css";

type Screen = "dashboard" | "records" | "queue" | "audit" | "settings";
type QueueCategory = "awaiting-review" | "Demo match" | "No demo match" | "Needs manual review";
type ModalState =
  | { kind: "form"; student?: Student }
  | { kind: "details"; student: Student }
  | { kind: "review"; student: Student }
  | null;
type Feedback = { kind: "success" | "error"; text: string } | null;

const navigation: {
  id: Screen;
  label: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "records", label: "Student Records", icon: Users },
  { id: "queue", label: "Verification Queue", icon: FileCheck2 },
  { id: "audit", label: "Activity History", icon: Activity },
  { id: "settings", label: "Settings", icon: Settings },
];

const statusLabels: Record<VerificationStatus, string> = {
  verified: "Verified",
  pending: "Pending",
  flagged: "Flagged",
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

function maskApaarId(apaarId: string): string {
  if (!apaarId) return "Not provided";
  const lastFour = normalizeApaarId(apaarId).slice(-4);
  return lastFour ? `•••• •••• ${lastFour}` : "Invalid APAAR ID";
}

function makeAuditEntry(
  student: Student,
  action: string,
  detail: string,
  actorUserId: string | null = null,
): AuditEntry {
  const normalizedApaarId = normalizeApaarId(student.apaarId);
  const safeDetail = normalizedApaarId.length === 12
    ? detail.replace(
        new RegExp(
          `(?<!\\d)${normalizedApaarId.split("").join("[\\s-]*")}(?!\\d)`,
          "g",
        ),
        "[redacted APAAR ID]",
      )
    : detail;
  return {
    id: crypto.randomUUID(),
    studentId: student.id,
    studentName: student.name,
    action,
    detail: `${safeDetail} Student record ID: ${student.id}.`,
    timestamp: new Date().toISOString(),
    actorUserId,
  };
}

function StatusBadge({ status }: { status: VerificationStatus }) {
  return (
    <span className={`status-badge status-${status}`}>
      <span className="status-dot" aria-hidden="true" />
      {statusLabels[status]}
    </span>
  );
}

function DemoOutcomeBadge({
  outcome,
}: {
  outcome: Student["demoApaarOutcome"];
}) {
  const label = outcome ? demoApaarOutcomeLabels[outcome] : "Not Checked";
  const tone =
    outcome === "Demo match"
      ? "match"
      : outcome === "No demo match"
        ? "no-match"
        : outcome === "Needs manual review"
          ? "manual"
          : "not-run";
  return (
    <span className={`demo-outcome-badge demo-outcome-${tone}`}>
      {label}
      <span className="demo-badge-caption">· simulated</span>
    </span>
  );
}

function queueCategoryLabel(category: QueueCategory): string {
  if (category === "awaiting-review") return "Pending Review";
  if (category === "Demo match" || category === "No demo match" || category === "Needs manual review") {
    return demoApaarOutcomeLabels[category];
  }
  return category;
}

function auditActionLabel(action: string): string {
  return action
    .replaceAll("Demo record", "Student record")
    .replaceAll("Demo status", "Overall status")
    .replaceAll("APAAR demo verification", "APAAR comparison")
    .replaceAll("Needs manual review", demoApaarOutcomeLabels["Needs manual review"])
    .replaceAll("No demo match", demoApaarOutcomeLabels["No demo match"])
    .replaceAll("Demo match", demoApaarOutcomeLabels["Demo match"]);
}

function auditDetailLabel(detail: string): string {
  return detail
    .replaceAll("demo fixture", "sample comparison")
    .replaceAll("demo enrollment details", "student record details");
}

function StudentTable({
  students,
  emptyMessage,
  onDetails,
  onReview,
  onEdit,
  onDelete,
}: {
  students: Student[];
  emptyMessage: string;
  onDetails: (student: Student) => void;
  onReview: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
}) {
  return (
    <div className="table-scroll">
      <table className="student-table">
        <thead>
          <tr>
            <th scope="col">STUDENT</th>
            <th scope="col">STUDENT ROLL NUMBER</th>
            <th scope="col">INSTITUTION</th>
            <th scope="col">APAAR ID</th>
            <th scope="col">RECORD COMPARISON</th>
            <th scope="col">OVERALL STATUS</th>
            <th scope="col" className="actions-heading">
              ACTIONS
            </th>
          </tr>
        </thead>
        <tbody>
          {students.map((student) => (
            <tr key={student.id}>
              <td>
                <button
                  className="student-name-button"
                  onClick={() => onDetails(student)}
                >
                  <span className="student-avatar" aria-hidden="true">
                    {student.name
                      .split(/\s+/)
                      .map((part) => part[0])
                      .slice(0, 2)
                      .join("")
                      .toUpperCase()}
                  </span>
                  <span>{student.name}</span>
                </button>
              </td>
              <td className="mono-cell">{student.rollNumber}</td>
              <td>{student.institution}</td>
              <td className="mono-cell">{maskApaarId(student.apaarId)}</td>
              <td><DemoOutcomeBadge outcome={student.demoApaarOutcome} /></td>
              <td>
                <StatusBadge status={student.status} />
              </td>
              <td>
                <div className="row-actions">
                  <button
                    className="row-action"
                    aria-label={`View ${student.name}`}
                    title="View details"
                    onClick={() => onDetails(student)}
                  >
                    <Eye size={16} />
                  </button>
                  <button
                    className="row-action"
                    aria-label={`Review ${student.name}`}
                    title="Review status"
                    onClick={() => onReview(student)}
                  >
                    <ShieldCheck size={16} />
                  </button>
                  <button
                    className="row-action"
                    aria-label={`Edit ${student.name}`}
                    title="Edit record"
                    onClick={() => onEdit(student)}
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    className="row-action row-action-danger"
                    aria-label={`Delete ${student.name}`}
                    title="Delete record"
                    onClick={() => onDelete(student)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {students.length === 0 && (
            <tr>
              <td colSpan={7}>
                <div className="empty-state">
                  <Users size={23} />
                  <strong>{emptyMessage}</strong>
                  <span>Try a different search or status filter.</span>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function StudentFormModal({
  student,
  error,
  onClose,
  onSubmit,
}: {
  student?: Student;
  error: string;
  onClose: () => void;
  onSubmit: (fields: {
    name: string;
    rollNumber: string;
    institution: string;
    apaarId: string;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(student?.name ?? "");
  const [rollNumber, setRollNumber] = useState(student?.rollNumber ?? "");
  const [institution, setInstitution] = useState(student?.institution ?? "");
  const [apaarId, setApaarId] = useState(student?.apaarId ?? "");

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void onSubmit({
      name: name.trim(),
      rollNumber: rollNumber.trim(),
      institution: institution.trim(),
      apaarId: apaarId.trim(),
    });
  }

  return (
    <Modal title={student ? "Edit student record" : "Register student"} onClose={onClose}>
      <form className="modal-form" noValidate onSubmit={submit}>
        <div className="form-demo-warning">
          Use fictional sample values only. Do not enter real student or APAAR information.
          This prototype is not connected to the official APAAR system.
        </div>
        <label>
          Student display name
          <input
            autoFocus
            maxLength={80}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. Aarav Sharma"
            required
          />
        </label>
        <label>
          Student Roll Number
          <input
            maxLength={50}
            value={rollNumber}
            onChange={(event) => setRollNumber(event.target.value)}
            placeholder="e.g. SIH-CSE-001"
            required
          />
        </label>
        <label>
          Institution
          <input
            maxLength={100}
            value={institution}
            onChange={(event) => setInstitution(event.target.value)}
            placeholder="e.g. Sample Engineering College"
            required
          />
        </label>
        <label>
          APAAR ID <span className="label-demo-tag">FICTIONAL SAMPLE ONLY</span>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="off"
            maxLength={14}
            value={apaarId}
            onChange={(event) => setApaarId(event.target.value)}
            placeholder="e.g. 1234-5678-9012"
            aria-describedby="apaar-id-help"
          />
          <span id="apaar-id-help" className="field-help">
            Enter 12 digits; separators are optional. Formatting is only a basic check, not proof of identity.
          </span>
        </label>
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="button-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button-primary" type="submit">
            {student ? "Save changes" : "Register student"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ReviewModal({
  student,
  onClose,
  onSubmit,
}: {
  student: Student;
  onClose: () => void;
  onSubmit: (status: VerificationStatus, note: string) => Promise<void>;
}) {
  const [status, setStatus] = useState<VerificationStatus>(student.status);
  const [note, setNote] = useState(student.verifierNote ?? "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (status === "flagged" && !note.trim()) {
      setError("Add a reason before flagging this student record.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit(status, note.trim());
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "The review could not be saved. Please retry.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal title="Verification review" onClose={onClose}>
      <div className="review-record">
        <div className="review-avatar">{student.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <strong>{student.name}</strong>
          <span>{student.rollNumber} · {student.institution}</span>
        </div>
      </div>
      <div className="review-caution">
        <ShieldCheck size={17} />
        <p>
          Simulated review only. A name match or missing information is not proof
          of identity; no official APAAR record is queried.
        </p>
      </div>
      <form className="modal-form" onSubmit={(event) => void submit(event)}>
        <div className="review-fields">
          <div><span>Student Roll Number</span><strong>{student.rollNumber}</strong></div>
          <div><span>Institution</span><strong>{student.institution}</strong></div>
          <div><span>Record comparison · simulated</span><DemoOutcomeBadge outcome={student.demoApaarOutcome} /></div>
          <div><span>Overall student status</span><StatusBadge status={student.status} /></div>
        </div>
        <label>
          Set overall student status
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value as VerificationStatus);
              setError("");
            }}
          >
            <option value="pending">Pending</option>
            <option value="verified">Verified · overall status</option>
            <option value="flagged">Flagged</option>
          </select>
        </label>
        {status === "flagged" && (
          <label>
            Flag reason or review note
            <textarea
              value={note}
              maxLength={500}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Describe what needs follow-up"
              rows={3}
              required
            />
          </label>
        )}
        {error && <p className="field-error" role="alert">{error}</p>}
        <div className="modal-actions">
          <button className="button-secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="button-primary" type="submit" disabled={saving}>
            {saving ? "Saving review…" : "Save review"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function StudentDetailsModal({
  student,
  audit,
  onClose,
  onReview,
  onEdit,
  onDemoVerify,
}: {
  student: Student;
  audit: AuditEntry[];
  onClose: () => void;
  onReview: () => void;
  onEdit: () => void;
  onDemoVerify: (student: Student) => Promise<DemoVerificationResult>;
}) {
  const [showApaarId, setShowApaarId] = useState(false);
  const [demoResult, setDemoResult] = useState<DemoVerificationResult | null>(null);
  const [verificationError, setVerificationError] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const studentHistory = audit
    .filter((entry) => entry.studentId === student.id)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const visibleDemoOutcome = demoResult?.outcome ?? student.demoApaarOutcome;

  return (
    <Modal title="Student record" onClose={onClose}>
      <div className="detail-identity">
        <div className="detail-avatar">{student.name.slice(0, 1).toUpperCase()}</div>
        <div>
          <h3>{student.name}</h3>
          <StatusBadge status={student.status} />
        </div>
      </div>
      <dl className="detail-grid">
        <div><dt>Student Roll Number</dt><dd>{student.rollNumber}</dd></div>
        <div><dt>Institution</dt><dd>{student.institution}</dd></div>
        <div>
          <dt>APAAR ID · masked</dt>
          <dd className="apaar-detail-value">
            <span>{showApaarId ? student.apaarId || "Not provided" : maskApaarId(student.apaarId)}</span>
            {student.apaarId && (
              <button
                className="reveal-button"
                type="button"
                onClick={() => setShowApaarId((visible) => !visible)}
                aria-label={showApaarId ? "Hide APAAR ID" : "Reveal APAAR ID"}
              >
                {showApaarId ? <EyeOff size={14} /> : <Eye size={14} />}
                {showApaarId ? "Hide" : "Reveal"}
              </button>
            )}
          </dd>
        </div>
        <div><dt>Record created</dt><dd>{formatDate(student.createdAt)}</dd></div>
        <div><dt>Last updated</dt><dd>{formatDate(student.updatedAt)}</dd></div>
      </dl>
      <section className="apaar-verification">
        <div className="apaar-section-heading">
          <div>
            <span className="demo-verification-label">SIMULATED WORKFLOW</span>
            <h3>APAAR ID Comparison</h3>
          </div>
          <span className="demo-only-pill">SIMULATED</span>
        </div>
        <p className="official-unavailable">
          {officialVerificationProvider
            ? "Official verification is separate; this action uses local sample comparisons only."
            : officialVerificationUnavailableMessage}
        </p>
        <p className="apaar-disclaimer">
          Uses fictional local test values only. It does not query APAAR or ABC
          records, and an outcome is not proof of identity.
        </p>
        <div className="demo-test-hints">
          <span>Record Matched: <code>1234-5678-9012</code></span>
          <span>Record Mismatch: <code>0000-0000-0000</code></span>
          <span>Other valid IDs: Requires Verification</span>
        </div>
        <div className="saved-demo-outcome">
          <span>Latest comparison outcome</span>
          <DemoOutcomeBadge outcome={student.demoApaarOutcome} />
        </div>
        <button
          className="button-primary demo-verify-button"
          type="button"
          disabled={isVerifying || !student.apaarId}
          onClick={async () => {
            const validation = validateApaarId(student.apaarId);
            if (!validation.valid) {
              setVerificationError(validation.message);
              setDemoResult(null);
              return;
            }
            setIsVerifying(true);
            setVerificationError("");
            try {
              const result = await onDemoVerify(student);
              setDemoResult(result);
            } catch (error) {
              setDemoResult(null);
              setVerificationError(
                error instanceof Error
                  ? `The comparison could not be completed: ${error.message}`
                  : "The comparison could not be completed.",
              );
            } finally {
              setIsVerifying(false);
            }
          }}
        >
          <ShieldCheck size={16} />
          {isVerifying ? "Running comparison…" : "Run comparison"}
        </button>
        {!student.apaarId && (
          <p className="field-error">Add an APAAR ID in Edit to run the comparison.</p>
        )}
        {verificationError && <p className="field-error" role="alert">{verificationError}</p>}
        {visibleDemoOutcome && (
          <div className="demo-result" role="status">
            <span className="demo-result-heading">SIMULATED OUTCOME — NOT OFFICIAL</span>
            <strong>{demoApaarOutcomeLabels[visibleDemoOutcome]}</strong>
            <p>
              {demoResult?.message ??
                "Latest saved result from local fictional sample data; not official."}
            </p>
          </div>
        )}
      </section>
      {student.verifierNote && (
        <div className="note-box">
          <strong>Review note</strong>
          <p>{student.verifierNote.replace(/^Demo note:/, "Review note:")}</p>
        </div>
      )}
      <div className="detail-history">
        <h3>Recent activity</h3>
        {studentHistory.length === 0 ? (
          <p className="muted-copy">No review activity recorded yet.</p>
        ) : (
          studentHistory.slice(0, 4).map((entry) => (
            <div className="history-item" key={entry.id}>
              <span className="history-mark"><Activity size={14} /></span>
              <div><strong>{auditActionLabel(entry.action)}</strong><span>{formatDate(entry.timestamp)}</span></div>
            </div>
          ))
        )}
      </div>
      <div className="modal-actions">
        <button className="button-secondary" onClick={onEdit}><Pencil size={15} /> Edit</button>
        <button className="button-primary" onClick={onReview}><ShieldCheck size={15} /> Review record</button>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section className="modal-card" role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-heading">
          <h2>{title}</h2>
          <button className="close-button" aria-label="Close dialog" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function App() {
  const [loaded] = useState(() =>
    isSupabaseConfigured
      ? { data: { students: [] as Student[], audit: [] as AuditEntry[] }, error: null }
      : loadDemoData(),
  );
  const [students, setStudents] = useState(loaded.data.students);
  const [audit, setAudit] = useState(loaded.data.audit);
  const [storageError, setStorageError] = useState(loaded.error);
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [dataLoading, setDataLoading] = useState(false);
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [screen, setScreen] = useState<Screen>("dashboard");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | VerificationStatus>("all");
  const [queueCategory, setQueueCategory] = useState<QueueCategory>("awaiting-review");
  const [modal, setModal] = useState<ModalState>(null);
  const [formError, setFormError] = useState("");
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) return;
    const client = supabase;

    let active = true;
    async function loadForUser(nextUser: User | null) {
      if (!active) return;
      setUser(nextUser);
      setStorageError(null);
      if (!nextUser) {
        setStudents([]);
        setAudit([]);
        setDataLoading(false);
        setAuthReady(true);
        return;
      }

      setDataLoading(true);
      try {
        const data = await loadSupabaseData(client);
        if (active) {
          setStudents(data.students);
          setAudit(data.audit);
        }
      } catch (error) {
        if (active) {
          const message =
            error instanceof Error ? error.message : "Could not load Supabase data.";
          setStorageError(`Supabase data load failed: ${message}`);
        }
      } finally {
        if (active) {
          setDataLoading(false);
          setAuthReady(true);
        }
      }
    }

    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, session) => {
      window.setTimeout(() => {
        void loadForUser(session?.user ?? null);
      }, 0);
    });
    void client.auth
      .getSession()
      .then(({ data, error }) => {
        if (error && active) {
          setAuthError(`Could not restore sign-in session: ${error.message}`);
        }
        void loadForUser(data.session?.user ?? null);
      })
      .catch((error: unknown) => {
        if (active) {
          setAuthError(
            error instanceof Error
              ? `Could not restore sign-in session: ${error.message}`
              : "Could not restore sign-in session.",
          );
          setAuthReady(true);
        }
      });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  async function commitData(
    nextStudents: Student[],
    nextAudit: AuditEntry[],
  ): Promise<boolean> {
    try {
      if (isSupabaseConfigured) {
        if (!supabase || !user) {
          throw new Error("Sign in before changing Supabase records.");
        }

        const nextStudentIds = new Set(nextStudents.map((student) => student.id));
        const previousById = new Map(students.map((student) => [student.id, student]));
        for (const student of nextStudents) {
          const previous = previousById.get(student.id);
          if (!previous || JSON.stringify(previous) !== JSON.stringify(student)) {
            await saveSupabaseStudent(supabase, user.id, student);
          }
        }

        const previousAuditIds = new Set(audit.map((entry) => entry.id));
        for (const entry of nextAudit) {
          if (!previousAuditIds.has(entry.id)) {
            await insertSupabaseAudit(supabase, user.id, entry);
          }
        }
        for (const previous of students) {
          if (!nextStudentIds.has(previous.id)) {
            await deleteSupabaseStudent(supabase, user.id, previous.id);
          }
        }
        const refreshedData = await loadSupabaseData(supabase);
        setStudents(refreshedData.students);
        setAudit(refreshedData.audit);
      } else {
        saveDemoData({ students: nextStudents, audit: nextAudit });
        setStudents(nextStudents);
        setAudit(nextAudit);
      }

      setStorageError(null);
      return true;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not save data.";
      let reconciliationMessage = "";
      if (isSupabaseConfigured && supabase && user) {
        try {
          const refreshedData = await loadSupabaseData(supabase);
          setStudents(refreshedData.students);
          setAudit(refreshedData.audit);
          const changedStatus = refreshedData.students.find((record) => {
            const previous = students.find((student) => student.id === record.id);
            return previous && previous.status !== record.status;
          });
          if (changedStatus) setFilter(changedStatus.status);
        } catch (refreshError) {
          reconciliationMessage =
            refreshError instanceof Error
              ? ` Could not refresh current records: ${refreshError.message}`
              : " Could not refresh current records after the save error.";
        }
      }
      setStorageError(
        `${isSupabaseConfigured ? "Supabase" : "Browser storage"} save failed: ${message}.${reconciliationMessage}`,
      );
      return false;
    }
  }

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!supabase) return;
    setAuthBusy(true);
    setAuthError("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: authEmail.trim(),
        password: authPassword,
      });
      if (error) setAuthError(`Sign-in failed: ${error.message}`);
    } catch (error) {
      setAuthError(
        error instanceof Error
          ? `Sign-in failed: ${error.message}`
          : "Sign-in could not be completed.",
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function signOut() {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      setStorageError(`Sign-out failed: ${error.message}`);
      return;
    }
    setFeedback(null);
  }

  const counts = {
    total: students.length,
    verified: students.filter((student) => student.status === "verified").length,
    pending: students.filter((student) => student.status === "pending").length,
    flagged: students.filter((student) => student.status === "flagged").length,
  };
  const matchingStudents = students.filter((student) => {
    const query = search.trim().toLocaleLowerCase();
    const matchesSearch =
      !query ||
      student.name.toLocaleLowerCase().includes(query) ||
      student.rollNumber.toLocaleLowerCase().includes(query) ||
      student.institution.toLocaleLowerCase().includes(query);
    return matchesSearch && (filter === "all" || student.status === filter);
  });
  const recentMatchingStudents = [...matchingStudents]
    .sort((first, second) =>
      second.updatedAt.localeCompare(first.updatedAt),
    )
    .slice(0, 6);
  const queueCounts: Record<QueueCategory, number> = {
    "awaiting-review": students.filter((student) => student.status === "pending").length,
    "Demo match": students.filter((student) => student.demoApaarOutcome === "Demo match").length,
    "No demo match": students.filter((student) => student.demoApaarOutcome === "No demo match").length,
    "Needs manual review": students.filter((student) => student.demoApaarOutcome === "Needs manual review").length,
  };
  const queueStudents = matchingStudents.filter((student) => {
    if (queueCategory === "awaiting-review") return student.status === "pending";
    return student.demoApaarOutcome === queueCategory;
  });
  const sortedAudit = [...audit].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const storageModeLabel = isSupabaseConfigured
    ? user
      ? "Supabase-backed storage"
      : "Supabase sign-in required"
    : "Local Data Storage (browser)";
  const storageStateLabel = dataLoading
    ? "Loading"
    : storageError
      ? "Attention required"
      : isSupabaseConfigured
        ? "Connected"
        : "Available";

  function showFeedback(kind: "success" | "error", text: string) {
    setFeedback({ kind, text });
  }

  function openForm(student?: Student) {
    setFormError("");
    setModal(student ? { kind: "form", student } : { kind: "form" });
  }

  async function saveStudent(fields: {
    name: string;
    rollNumber: string;
    institution: string;
    apaarId: string;
  }) {
    if (!fields.name || !fields.rollNumber || !fields.institution) {
      setFormError("Complete the name, student roll number, and institution fields.");
      return;
    }
    const validation = validateApaarId(fields.apaarId);
    if (!validation.valid) {
      setFormError(validation.message);
      return;
    }

    const normalizedApaarId = normalizeApaarId(fields.apaarId);
    const duplicate = students.some(
      (existing) =>
        existing.id !== (modal?.kind === "form" ? modal.student?.id : undefined) &&
        ((existing.rollNumber.trim().toLocaleLowerCase() ===
          fields.rollNumber.toLocaleLowerCase() &&
          existing.institution.trim().toLocaleLowerCase() ===
            fields.institution.toLocaleLowerCase()) ||
          (existing.apaarId &&
            normalizeApaarId(existing.apaarId) === normalizedApaarId)),
    );
    if (duplicate) {
      setFormError(
        "A record with this student roll number and institution, or this APAAR ID, already exists.",
      );
      return;
    }
    let persisted: boolean;
    if (modal?.kind === "form" && modal.student) {
      const previous = modal.student;
      const updated: Student = {
        ...previous,
        ...fields,
        updatedAt: new Date().toISOString(),
      };
      persisted = await commitData(
        students.map((student) => student.id === updated.id ? updated : student),
        [
          makeAuditEntry(
            updated,
            "Demo record updated",
            `Updated demo enrollment details for ${updated.rollNumber}.`,
            user?.id ?? null,
          ),
          ...audit,
        ],
      );
      showFeedback(
        persisted ? "success" : "error",
        persisted
          ? "Student record updated."
          : `Changes were not saved to ${isSupabaseConfigured ? "Supabase" : "browser storage"}. Please retry.`,
      );
    } else {
      const created: Student = {
        id: crypto.randomUUID(),
        ...fields,
        status: "pending",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      persisted = await commitData(
        [created, ...students],
        [
          makeAuditEntry(created, "Demo record registered", "New record starts pending simulated review.", user?.id ?? null),
          ...audit,
        ],
      );
      showFeedback(
        persisted ? "success" : "error",
        persisted
          ? "Student record registered and added to the review queue."
          : `Record was not saved to ${isSupabaseConfigured ? "Supabase" : "browser storage"}. Please retry.`,
      );
    }
    if (persisted) {
      setModal(null);
      setFormError("");
    } else {
      setFormError(
        `Could not save this record to ${isSupabaseConfigured ? "Supabase" : "browser storage"}. Check the connection and retry.`,
      );
    }
  }

  async function reviewStudent(student: Student, status: VerificationStatus, note: string) {
    const updated: Student = {
      ...student,
      status,
      verifierNote: status === "flagged" ? note : undefined,
      updatedAt: new Date().toISOString(),
    };
    const persisted = await commitData(
      students.map((record) => record.id === student.id ? updated : record),
      [
        makeAuditEntry(
          updated,
          `Demo status set to ${status}`,
          status === "flagged"
            ? `Review reason: ${note}`
            : note
              ? `Staff review note: ${note}`
              : "Simulated review; no official APAAR record was queried.",
          user?.id ?? null,
        ),
        ...audit,
      ],
    );
    if (!persisted) {
      showFeedback(
      "error",
      `Review was not saved to ${isSupabaseConfigured ? "Supabase" : "browser storage"}.`,
      );
      throw new Error(
      `The review could not be saved to ${isSupabaseConfigured ? "Supabase" : "browser storage"}.`,
      );
    }
    if (filter !== "all" && filter !== status) {
      setFilter(status);
    }
    setModal(null);
    showFeedback(
      "success",
      `Overall student status updated to ${status}.`,
    );
  }

  async function runDemoVerification(student: Student): Promise<DemoVerificationResult> {
    const validation = validateApaarId(student.apaarId);
    if (!validation.valid) {
      throw new Error(validation.message);
    }
    const result = await demoVerificationProvider.verify(student.apaarId);
    const updatedStudent: Student = {
      ...student,
      demoApaarOutcome: result.outcome,
      updatedAt: new Date().toISOString(),
    };
    const entry = makeAuditEntry(
      updatedStudent,
    `APAAR demo verification: ${result.outcome}`,
    "Fictional demo fixture result only; the full APAAR ID was not recorded and no official records were queried.",
      user?.id ?? null,
    );
    const persisted = await commitData(
      students.map((record) =>
        record.id === updatedStudent.id ? updatedStudent : record,
      ),
      [entry, ...audit],
    );
    if (!persisted) {
      throw new Error("The result could not be recorded in Activity History.");
    }
    return result;
  }

  async function deleteStudent(student: Student) {
    if (!window.confirm(`Delete the student record for ${student.name}? This cannot be undone.`)) {
      return;
    }
    const persisted = await commitData(
      students.filter((record) => record.id !== student.id),
      [
        makeAuditEntry(student, "Demo record deleted", "Record removed from the prototype.", user?.id ?? null),
        ...audit,
      ],
    );
    if (modal?.kind !== "form") setModal(null);
    showFeedback(
      persisted ? "success" : "error",
      persisted
        ? "Student record deleted."
        : `Record deletion was not saved to ${isSupabaseConfigured ? "Supabase" : "browser storage"}. Please retry.`,
    );
  }

  async function restoreDemoData() {
    if (!window.confirm(
      "Restore fictional sample records?\n\nThis will replace the current student records. In local browser storage, Activity History will also be restored to the sample entries. In Supabase, existing Activity History is retained and sample activity records are added.\n\nThis action cannot be undone. Continue?",
    )) {
      return;
    }
    let persisted: boolean;
    if (isSupabaseConfigured && supabase && user) {
      try {
        const initial = await restoreSupabaseDemoData(supabase, user.id);
        setStudents(initial.students);
        setAudit(initial.audit);
        setStorageError(null);
        persisted = true;
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Could not restore sample records.";
        setStorageError(`Supabase restore failed: ${message}`);
        persisted = false;
      }
    } else {
      const initial = createInitialDemoData();
      persisted = await commitData(initial.students, initial.audit);
    }
    showFeedback(
      persisted ? "success" : "error",
      persisted
        ? "Original fictional sample records restored."
        : `Sample records were not saved to ${isSupabaseConfigured ? "Supabase" : "browser storage"}. Please retry.`,
    );
  }

  function handleDetails(student: Student) {
    setModal({ kind: "details", student });
  }

  function handleReview(student: Student) {
    setModal({ kind: "review", student });
  }

  const activeNavigation = navigation.find((item) => item.id === screen)!;
  const filteredCount =
    screen === "queue" ? queueStudents.length : matchingStudents.length;
  const visibleStudents =
    screen === "queue" ? queueStudents : matchingStudents;

  if (isSupabaseConfigured && !authReady) {
    return (
      <div className="auth-shell">
        <section className="auth-card" aria-live="polite">
          <span className="brand-mark"><GraduationCap size={23} /></span>
          <h1>Connecting to Supabase</h1>
          <p>Restoring the staff session and loading authorized records…</p>
        </section>
      </div>
    );
  }

  if (isSupabaseConfigured && dataLoading) {
    return (
      <div className="auth-shell">
        <section className="auth-card" aria-live="polite">
          <span className="brand-mark"><GraduationCap size={23} /></span>
          <h1>Loading student records</h1>
          <p>Fetching records allowed for this signed-in staff account.</p>
        </section>
      </div>
    );
  }

  if (isSupabaseConfigured && !user) {
    return (
      <div className="auth-shell">
        <section className="auth-card">
          <span className="brand-mark"><GraduationCap size={23} /></span>
          <p className="eyebrow">SUPABASE AUTHENTICATION</p>
          <h1>Staff sign in</h1>
          <p>Sign in with an authorized account created by your Supabase project administrator.</p>
          <div className="auth-mode-note">Supabase mode is configured. Local sample records are not uploaded or shown in this mode.</div>
          <form className="modal-form auth-form" onSubmit={(event) => void signIn(event)}>
            <label>
              Staff email
              <input
                type="email"
                autoComplete="username"
                value={authEmail}
                onChange={(event) => setAuthEmail(event.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                value={authPassword}
                onChange={(event) => setAuthPassword(event.target.value)}
                required
              />
            </label>
            {authError && <p className="field-error" role="alert">{authError}</p>}
            {storageError && <p className="field-error" role="alert">{storageError}</p>}
            <button className="button-primary auth-submit" type="submit" disabled={authBusy}>
              {authBusy ? "Signing in…" : "Sign in"}
            </button>
          </form>
          <p className="auth-footer">APAAR checks remain simulated. No official verification is performed.</p>
        </section>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setScreen("dashboard"); }}>
          <span className="brand-mark"><GraduationCap size={23} /></span>
          <span className="brand-copy"><strong>EduVerify</strong><small>INSTITUTION PORTAL</small></span>
        </a>
        <p className="nav-caption">WORKSPACE</p>
        <nav className="main-nav" aria-label="Main navigation">
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item${screen === id ? " active" : ""}`}
              aria-current={screen === id ? "page" : undefined}
              onClick={() => {
                setScreen(id);
                setFeedback(null);
              }}
            >
              <Icon size={18} strokeWidth={1.8} />
              <span>{label}</span>
              {id === "queue" && counts.pending > 0 && (
                <span className="nav-count">{counts.pending}</span>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-prototype">
          <span><ShieldCheck size={16} /> {isSupabaseConfigured ? "Supabase mode" : "Local storage mode"}</span>
          <p>{isSupabaseConfigured ? "Signed-in staff data. APAAR checks remain simulated." : "Fictional records in this browser only."}</p>
        </div>
        <div className="sidebar-user">
          <span className="user-avatar">{isSupabaseConfigured ? (user?.email?.slice(0, 1).toUpperCase() ?? "S") : "AD"}</span>
          <span><strong>{isSupabaseConfigured ? user?.email : "Institution Admin"}</strong><small>{isSupabaseConfigured ? "Authorized staff" : "Prototype account"}</small></span>
          {isSupabaseConfigured && (
            <button className="sidebar-logout" onClick={() => void signOut()} aria-label="Sign out" title="Sign out">
              <ArrowLeft size={15} />
            </button>
          )}
        </div>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong>{activeNavigation.label}</strong></div>
          <div className="topbar-tools">
            <span className={`prototype-pill${isSupabaseConfigured ? " supabase-mode-pill" : ""}`}><span /> {isSupabaseConfigured ? "SUPABASE MODE" : "LOCAL STORAGE MODE"}</span>
            {isSupabaseConfigured && (
              <button className="top-signout" onClick={() => void signOut()}>Sign out</button>
            )}
            {!isSupabaseConfigured && <span className="user-avatar top-user-avatar">AD</span>}
          </div>
        </header>

        <div className="page-content">
          {feedback && (
            <div className={`feedback feedback-${feedback.kind}`} role="status">
              {feedback.kind === "success" ? <Check size={17} /> : <AlertTriangle size={17} />}
              <span>{feedback.text}</span>
              <button aria-label="Dismiss message" onClick={() => setFeedback(null)}><X size={16} /></button>
            </div>
          )}
          {storageError && (
            <div className="feedback feedback-error" role="alert">
              <AlertTriangle size={17} /><span>{storageError}</span>
            </div>
          )}
          {supabaseConfigurationError && (
            <div className="feedback feedback-error" role="alert">
              <AlertTriangle size={17} /><span>{supabaseConfigurationError} Continuing in local storage mode.</span>
            </div>
          )}

          {screen === "dashboard" && (
            <>
              <PageHeading
                eyebrow="INSTITUTION OVERVIEW"
                title="Student Records Dashboard"
                description="A clear view of student records and simulated review progress."
                action={<button className="button-primary" onClick={() => openForm()}><Plus size={17} /> Add student</button>}
              />
              <PrototypeNotice />
              <StatsGrid counts={counts} />
              <RecordsPanel
                title="Recent student records"
                description="Search across student names, roll numbers, and institutions."
                students={recentMatchingStudents}
                totalCount={students.length}
                filteredCount={Math.min(matchingStudents.length, 6)}
                search={search}
                filter={filter}
                onSearch={setSearch}
                onFilter={setFilter}
                emptyMessage="No matching student records"
                onDetails={handleDetails}
                onReview={handleReview}
                onEdit={openForm}
                onDelete={deleteStudent}
                onViewAll={() => setScreen("records")}
              />
            </>
          )}

          {screen === "records" && (
            <>
              <PageHeading
                eyebrow="RECORD MANAGEMENT"
                title="Student records"
                description="Manage student records available in this workspace."
                action={<button className="button-primary" onClick={() => openForm()}><Plus size={17} /> Add student</button>}
              />
              <RecordsPanel
                title="All student records"
                description="Duplicate checks use student roll number and institution."
                students={visibleStudents}
                totalCount={students.length}
                filteredCount={filteredCount}
                search={search}
                filter={filter}
                onSearch={setSearch}
                onFilter={setFilter}
                emptyMessage="No student records to display"
                onDetails={handleDetails}
                onReview={handleReview}
                onEdit={openForm}
                onDelete={deleteStudent}
              />
            </>
          )}

          {screen === "queue" && (
            <>
              <PageHeading
                eyebrow="STUDENT REVIEW & RECORD COMPARISON"
                title="Verification queue"
                description="Review overall student status separately from simulated APAAR comparison outcomes."
              />
              <div className="queue-categories" role="group" aria-label="Filter verification queue by review category">
                {([
                  ["awaiting-review", "Pending Review", queueCounts["awaiting-review"]],
                  ["Demo match", "Record Matched", queueCounts["Demo match"]],
                  ["No demo match", "Record Mismatch", queueCounts["No demo match"]],
                  ["Needs manual review", "Requires Verification", queueCounts["Needs manual review"]],
                ] as const).map(([category, label, count]) => (
                  <button
                    key={category}
                    className={`queue-category${queueCategory === category ? " selected" : ""}`}
                    aria-pressed={queueCategory === category}
                    onClick={() => setQueueCategory(category)}
                  >
                    <span>{label}</span>
                    <strong>{count}</strong>
                  </button>
                ))}
              </div>
              <p className="queue-demo-warning">
                Comparison outcomes are simulated and do not establish identity or official APAAR status. This prototype is not connected to the official APAAR system.
              </p>
              <RecordsPanel
                title={
                  queueCategory === "awaiting-review"
                    ? "Pending Review"
                    : `${queueCategoryLabel(queueCategory)} · simulated comparison`
                }
                description={
                  queueCategory === "awaiting-review"
                    ? "New registrations remain pending until staff records an overall review outcome."
                    : "This simulated comparison outcome is separate from the overall student status."
                }
                students={queueStudents}
                totalCount={students.length}
                filteredCount={queueStudents.length}
                search={search}
                filter={filter}
                onSearch={setSearch}
                onFilter={setFilter}
                emptyMessage={
                  queueCategory === "awaiting-review"
                    ? "No records are pending review"
                    : `No records have a ${queueCategoryLabel(queueCategory).toLowerCase()} result`
                }
                onDetails={handleDetails}
                onReview={handleReview}
                onEdit={openForm}
                onDelete={deleteStudent}
              />
            </>
          )}

          {screen === "audit" && (
            <>
              <PageHeading
                eyebrow="ACTIVITY HISTORY"
                title="Activity History"
                description={`Recorded actions with staff identity and student record references · ${isSupabaseConfigured ? "Supabase" : "Local Data Storage"} mode.`}
              />
              <section className="content-card audit-card">
                <div className="card-heading">
                  <div><h2>Recent activity</h2><p>{audit.length} Activity Records</p></div>
                </div>
                {sortedAudit.length === 0 ? (
                  <div className="empty-state audit-empty"><Activity size={23} /><strong>No activity yet</strong><span>Registration, edits, and reviews will appear here.</span></div>
                ) : (
                  <div className="audit-list">
                    {sortedAudit.map((entry) => (
                      <article className="audit-entry" key={entry.id}>
                        <span className="audit-mark"><Activity size={16} /></span>
                        <div className="audit-entry-main">
                          <div className="audit-entry-title"><strong>{auditActionLabel(entry.action)}</strong><span>{formatDate(entry.timestamp)}</span></div>
                          <p><b>{entry.studentName}</b> · {auditDetailLabel(entry.detail)}</p>
                          <p className="audit-meta">
                            Staff user ID: {entry.actorUserId ?? "Not available in local mode"}
                            {" · "}Record ID: {entry.studentId || "No linked student record"}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
              <p className="small-disclaimer">
                {isSupabaseConfigured
                  ? "Activity History is stored in Supabase and is not tamper-proof against privileged project administrators."
                  : "Activity History is stored in this browser and is not tamper-proof."}
              </p>
            </>
          )}

          {screen === "settings" && (
            <>
              <PageHeading
                eyebrow="ADMINISTRATION"
                title="Settings"
                description="Manage application preferences, data and prototype configuration."
              />
              <div className="settings-grid">
                <section className="content-card settings-panel">
                  <div className="settings-panel-heading">
                    <span className="settings-icon"><ShieldCheck size={19} /></span>
                    <div className="settings-copy">
                      <h2>Prototype Environment</h2>
                      <p>Record comparison uses simulated workflows. This application is not connected to the official APAAR system.</p>
                    </div>
                    <span className="settings-state">Prototype Active</span>
                  </div>
                </section>
                <section className="content-card settings-panel" aria-live="polite">
                  <div className="settings-panel-heading">
                    <span className="settings-icon"><Database size={19} /></span>
                    <div className="settings-copy">
                      <h2>Data Storage</h2>
                      <p>{storageModeLabel}</p>
                    </div>
                    <span className={`settings-state${storageError ? " settings-state-warning" : " settings-state-muted"}`}>
                      {storageStateLabel}
                    </span>
                  </div>
                  <div className="storage-counts">
                    {dataLoading ? (
                      <p>Loading student and activity records…</p>
                    ) : (
                      <>
                        <div><strong>{students.length}</strong><span>Student Records</span></div>
                        <div><strong>{audit.length}</strong><span>Activity Records</span></div>
                      </>
                    )}
                  </div>
                  {storageError && <p className="settings-error" role="alert">{storageError}</p>}
                </section>
                <section className="content-card settings-panel settings-sample-panel">
                  <div className="settings-panel-heading">
                    <span className="settings-icon settings-icon-amber"><RotateCcw size={19} /></span>
                    <div className="settings-copy">
                      <h2>Restore Sample Records</h2>
                      <p>Replace current student records with fictional examples. Review the confirmation before continuing.</p>
                    </div>
                    <button className="button-secondary" onClick={restoreDemoData}>Restore sample records</button>
                  </div>
                </section>
              </div>
              <aside className="privacy-note" role="note">
                <Info size={19} aria-hidden="true" />
                <div>
                  <strong>Privacy Notice</strong>
                  <p>Use fictional student data only. Do not enter real student identity information, APAAR IDs, credentials, or documents. Real APAAR verification requires an authorized official integration; none is configured in this prototype.</p>
                </div>
              </aside>
            </>
          )}

          <footer className="page-footer">
            <span>EduVerify · SIH prototype</span>
            <span>Simulated comparison workflows <span className="footer-dot">·</span> Not connected to official APAAR</span>
          </footer>
        </div>
      </main>

      {modal?.kind === "form" && (
        <StudentFormModal
          key={modal.student?.id ?? "new-student"}
          student={modal.student}
          error={formError}
          onClose={() => setModal(null)}
          onSubmit={saveStudent}
        />
      )}
      {modal?.kind === "review" && (
        <ReviewModal
          key={modal.student.id}
          student={modal.student}
          onClose={() => setModal(null)}
          onSubmit={(status, note) => reviewStudent(modal.student, status, note)}
        />
      )}
      {modal?.kind === "details" && (
        <StudentDetailsModal
          student={students.find((student) => student.id === modal.student.id) ?? modal.student}
          audit={audit}
          onClose={() => setModal(null)}
          onReview={() => handleReview(students.find((student) => student.id === modal.student.id) ?? modal.student)}
          onEdit={() => openForm(students.find((student) => student.id === modal.student.id) ?? modal.student)}
          onDemoVerify={runDemoVerification}
        />
      )}
    </div>
  );
}

function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-description">{description}</p>
      </div>
      {action}
    </section>
  );
}

function PrototypeNotice() {
  return (
    <div className="prototype-notice">
      <span className="notice-icon"><ShieldCheck size={19} /></span>
      <div>
        <strong>Prototype environment — fictional data only</strong>
        <p>Comparison workflows are simulated. This prototype is not connected to the official APAAR system and does not verify identity.</p>
      </div>
    </div>
  );
}

function StatsGrid({
  counts,
}: {
  counts: { total: number; verified: number; pending: number; flagged: number };
}) {
  const stats = [
    { label: "Total students", value: counts.total, caption: "Student Records", icon: Users, tone: "navy" },
    { label: "Verified", value: counts.verified, caption: "Overall student status", icon: ShieldCheck, tone: "green" },
    { label: "Pending Review", value: counts.pending, caption: "Staff review required", icon: Clock3, tone: "amber" },
    { label: "Flagged records", value: counts.flagged, caption: "Need follow-up", icon: AlertTriangle, tone: "red" },
  ];
  return (
    <section className="stats-grid" aria-label="Student record statistics">
      {stats.map(({ label, value, caption, icon: Icon, tone }) => (
        <article className="stat-card" key={label}>
          <div className="stat-card-top"><span>{label}</span><span className={`stat-icon stat-icon-${tone}`}><Icon size={19} /></span></div>
          <strong className="stat-value">{value}</strong>
          <span className="stat-caption">{caption}</span>
        </article>
      ))}
    </section>
  );
}

function RecordsPanel({
  title,
  description,
  students,
  totalCount,
  filteredCount,
  search,
  filter,
  onSearch,
  onFilter,
  emptyMessage,
  onDetails,
  onReview,
  onEdit,
  onDelete,
  onViewAll,
}: {
  title: string;
  description: string;
  students: Student[];
  totalCount: number;
  filteredCount: number;
  search: string;
  filter: "all" | VerificationStatus;
  onSearch: (value: string) => void;
  onFilter: (value: "all" | VerificationStatus) => void;
  emptyMessage: string;
  onDetails: (student: Student) => void;
  onReview: (student: Student) => void;
  onEdit: (student: Student) => void;
  onDelete: (student: Student) => void;
  onViewAll?: () => void;
}) {
  return (
    <section className="content-card records-card">
      <div className="card-heading">
        <div><h2>{title}</h2><p>{description}</p></div>
        {onViewAll && <button className="text-button" onClick={onViewAll}>View all <ChevronRight size={15} /></button>}
      </div>
      <div className="table-controls">
        <label className="search-field">
          <Search size={17} aria-hidden="true" />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search name, student roll number, institution"
            aria-label="Search students by name, student roll number, or institution"
          />
          {search && <button aria-label="Clear search" onClick={() => onSearch("")}><X size={15} /></button>}
        </label>
        <label className="filter-field">
          <span className="sr-only">Filter by status</span>
          <select value={filter} onChange={(event) => onFilter(event.target.value as "all" | VerificationStatus)}>
            <option value="all">All overall statuses</option>
            <option value="verified">Verified · overall status</option>
            <option value="pending">Pending</option>
            <option value="flagged">Flagged</option>
          </select>
        </label>
      </div>
      <StudentTable
        students={students}
        emptyMessage={emptyMessage}
        onDetails={onDetails}
        onReview={onReview}
        onEdit={onEdit}
        onDelete={onDelete}
      />
      <div className="table-footer">
        Showing {students.length} {students.length === 1 ? "record" : "records"}{search || filter !== "all" ? ` matching filters` : ` · ${totalCount} total`}
        {search || filter !== "all" ? <span>{filteredCount} found</span> : null}
      </div>
    </section>
  );
}

export default App;
