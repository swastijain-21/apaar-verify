# EduVerify SIH Prototype

An institutional portal prototype for the SIH problem statement on APAAR-based student data management. Student record management can run in browser-local demo mode or use a configured Supabase project. APAAR verification remains simulated; this is not an official APAAR service.

## Local demo mode

From this `frontend` directory:

```sh
npm install
npm run dev
```

Create a production build with `npm run build`.

Without Supabase environment variables, the app uses browser local storage and the original fictional demo records.

## Supabase setup

The `@supabase/supabase-js` dependency is already present in `package.json` and the lockfile.

1. In the Supabase project dashboard, copy the **Project URL** and **publishable key** (or the project's legacy anon/public key if that is what its API settings provide). Never use a `service_role` or secret key in this frontend.
2. Copy `.env.example` to `.env` in this `frontend` directory and set:

   ```dotenv
   VITE_SUPABASE_URL=https://your-project-ref.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

   `.env` is ignored by git. Restart Vite after changing environment variables. Vite exposes `VITE_` variables to browser code, so only a publishable/public key belongs here; database access is restricted with RLS, not by hiding this key.
3. For a new setup, in the Supabase SQL Editor run [`supabase/migrations/20261026000000_student_management.sql`](./supabase/migrations/20261026000000_student_management.sql), then [`supabase/migrations/20261026040000_demo_apaar_outcome.sql`](./supabase/migrations/20261026040000_demo_apaar_outcome.sql). If the base tables/policies were already created, run only the second migration to add the simulated APAAR outcome column. The base migration enables and forces RLS, scopes access to the authenticated user's `auth.uid()`, and grants audit log insert/read access only (no update/delete policy).
4. Create staff accounts in the Supabase Dashboard under **Authentication → Users** using **Invite user** (or your institution's controlled account-provisioning process). Do not enable public sign-up for this prototype. Staff sign in with the invited account and password. The app does not provide a sign-up path. Supabase email/SMTP settings may need to be configured for invitation flows.
5. Start the app with `npm run dev`. When both environment variables are present, the app switches to **Supabase mode** and requires staff sign-in. It queries only rows allowed by RLS. If the SQL has not been run or credentials are incorrect, an error is shown; this is not a connected/verified deployment until configured and tested.

The policies in the supplied migration give each authenticated user access only to records whose `user_id` is their own auth UID. This is a restrictive single-user ownership model, not an institution-wide staff role system. If multiple staff must share an institution's records, implement and review an institution membership/role table and corresponding RLS policies before granting access.

Local demo data is never copied to Supabase on sign-in or mode change. Supabase mode starts with the signed-in account's cloud records; creating or editing a record saves that action to Supabase. **Settings → Restore demo data** is a separate, confirmed action that replaces that signed-in user's student records with fictional sample records.

## Prototype features

- Dashboard counts update from the current student records.
- Student records support search by display name, demo roll number, or institution; status filtering; registration; editing; details; and deletion with confirmation.
- Registration and editing require an APAAR ID as a string, with a basic 12-digit format check. This check does not establish that an ID is genuine.
- Duplicate registration checks compare the demo roll number and institution, and also prevent reusing the same normalized APAAR ID.
- Verification Queue separates overall student status from the saved simulated APAAR result. Staff can filter for Pending Review, Record Matched, Record Mismatch, and Requires Verification; newly registered records start with a Pending overall status.
- Overall status reviews remain simulated. A reason is required when a record is flagged.
- Student tables and details mask APAAR IDs by default. Student details have a reveal control for the local demo.
- APAAR Verification is a separate demo-only workflow. The fictional test ID `1234-5678-9012` returns “Record Matched”, `0000-0000-0000` returns “Record Mismatch”, and other valid IDs return “Requires Verification”.
- Audit Logs show review actions, timestamps, staff user IDs when available, and student record IDs. Full APAAR IDs are not written to the audit log.
- Settings can restore the original fictional sample records.
- Records and audit entries persist in this browser's local storage. Clearing browser storage removes them.
- Supabase mode stores signed-in staff records in the configured Supabase project, subject to RLS. Sign-in and sign-out use Supabase Auth.

## Try the APAAR demo workflow

1. Run `npm run dev`, open the local Vite URL, and select a student row to open its details. If your browser has older saved records, use **Settings → Restore demo data** to load the fictional test IDs.
2. Confirm the ID is masked, then use **Reveal** only if you need to inspect the fictional value.
3. In **APAAR Verification**, run a check:
   - `1234-5678-9012` returns **Record Matched**.
   - `0000-0000-0000` returns **Record Mismatch**.
   - Any other valid 12-digit value returns **Requires Verification**.
4. Try adding or editing a record with an empty or malformed ID to see validation, then use **Audit Logs** to view the simulated attempt and timestamp. Audit entries never contain the full ID.

## Data and verification limitations

- The included names, enrollment references, and APAAR test IDs are fictional examples. Use fictional values only; do not enter real student identity information, APAAR IDs, documents, or credentials.
- The app does not connect to an official API, access government records, or verify identity. It displays “Official verification unavailable — demo mode only”; comparison outcomes and overall status are simulated, not evidence of a genuine ID or identity.
- APAAR verification provider types and demo fixture logic live in `src/apaarVerification.ts`, separate from React. No external service receives an ID. An authorized official provider is not configured.
- A configured Supabase deployment persists APAAR IDs in its database. Use fictional test IDs in this prototype; never use real student data. The frontend uses only the Supabase publishable key and relies on the SQL migration's RLS policies for row access.
- Existing browser records without an `apaarId` are migrated in memory with an empty string; editing them requires adding a validly formatted fictional demo ID.
- Browser local storage is device-local and is not a secure database or trusted audit trail. Supabase's audit table is append-only through this app's RLS grants but is not a tamper-proof compliance log against privileged project administrators.
- A production deployment still needs an authorized APAAR verification integration, institution-level staff authorization, and appropriate privacy and security safeguards. No official verification API, endpoint, or credentials are assumed here.
