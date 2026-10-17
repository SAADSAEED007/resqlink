# Frontend foundation

## Run and configure

```powershell
cd frontend
Copy-Item .env.example .env.local # only if .env.local does not already exist
npm ci
npm run dev
```

The UI runs at `http://localhost:3000`. Start the backend separately on port 4000. Public build-time settings:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:4000/api
NEXT_PUBLIC_AUTH_URL=http://localhost:4000/v1
```

Set both variables before a production build. Never put credentials in `NEXT_PUBLIC_` variables. When omitted, development falls back to localhost; production displays a configuration error. The auth URL can be inferred from an API URL ending in `/api`, but explicit configuration is preferred for proxies.

The backend needs `FRONTEND_URL=http://localhost:3000`, `SERVER_URL=http://localhost:4000`, `ENV=development`, its private database URL, and nonempty access/refresh token secrets. Use the same hostname (`localhost`, not a mix of localhost and 127.0.0.1). Existing admin accounts are provisioned by the project administrator; there is no frontend admin registration or bypass. Email remains optional in the backend.

## Structure and ownership

- `src/app`: landing, login, minimal SOS/dashboard placeholders, root providers, global tokens.
- `src/components/ui`: controls, forms, cards, badges, loading/empty/error states, native confirmation dialog. Import from `@/components/ui`.
- `src/components/layout`: `Brand`, `PublicLayout`, `PrototypeNotice`, `DashboardShell`.
- `src/components/auth`: `AuthProvider`, `useAuth`, `CoordinatorGuard`.
- `src/components/feedback/toast`: `useToast` and root provider.
- `src/lib/api`: fetch client, auth, incidents, teams, assignments.
- `src/types/api.ts`: actual backend enums, inputs, records, pagination and response types. IDs are strings; dates are ISO strings. Unknown location is `null`; absent vulnerability counts are unknown, not zero.
- `tests`: Chrome browser tests with explicitly mocked auth, plus fetch-client tests.

**Teammate 1:** after this PR merges, update your `feature/command-dashboard` branch from `origin/dev`. Replace `src/app/dashboard/page.tsx` and add child routes under `dashboard/`. Its layout already supplies the session guard, sidebar, account controls and simulation label. Do not wrap it in a second shell. Add real navigation links to `DashboardShell` only when those routes exist. Fetch protected data in client components through the shared API; do not embed sensitive records in static/server-rendered route children under the client guard. Server rendering of private data requires separate server-side session verification.

**Teammate 2:** after this PR merges, update `feature/citizen-sos` from `origin/dev`. Replace `src/app/sos/page.tsx` with your public form inside `<PublicLayout compact>`. Use `FormField` and typed `incidents.create`. Keep the prototype disclaimer and distinguish real backend acceptance from actual emergency dispatch. Do not add a tracking endpoint until the backend supports one.

For both teammates, first commit or stash your own changes, then `git fetch origin` and `git merge origin/dev` on your feature branch. Do not cherry-pick this foundation while it is still under review. No dashboard data workflows or citizen submission forms are implemented here.

## Design system

Taste Skill `design-taste-frontend` was reviewed and installed globally, outside the repository. Applied principles: content before ornament, a subject-specific signal/connection mark, deliberate large typography, clear reading order, one restrained palette, honest claims, and screenshot review. Its marketing-heavy imagery/motion guidance is intentionally adapted to this lightweight operational brief. No stock rescue imagery, invented statistics, or fake live data.

`globals.css` uses Tailwind 4 `@theme inline` semantic colors: `navy`, `slate`, `brand`, `background`, `surface`, `ink`, `muted`, `border`, and `critical/warning/success/info` with soft backgrounds. Use classes such as `bg-surface text-ink border-border`, not new hex values. The primary palette is navy #0B1220, slate #17263D, blue #2563EB. Status text uses darker accessible shades.

Geist is loaded through `next/font/google` and self-hosted by Next at runtime; the build requires access to the font download. Typography classes include `section-label`, `page-heading`, `metric`, `label`, `helper`; the hero and page scales use CSS variables. Standard spacing follows Tailwind's 4px scale. Controls are 40/44/52px, small controls become 44px on mobile, panel radius 16px, control radius 8px. Main layouts use a 1440px maximum and responsive page gutters. CSS transitions respect reduced-motion preferences.

## Shared components

```tsx
import { Button, Card, CardHeader, PriorityBadge, StatusBadge,
  LoadingSpinner, Skeleton, EmptyState, ErrorState,
  Input, Textarea, Select, FormField, ConfirmationDialog } from "@/components/ui";
import { useToast } from "@/components/feedback/toast";
```

`Button` supports primary/secondary/outline/ghost/destructive, sm/md/lg, disabled, loading and loadingLabel. Loading preserves dimensions. Use `buttonStyles(variant, size)` on a Next `Link` for navigation. `CardHeader` accepts title, description, actions. `MetricCard` accepts label/value/description; only display real metrics. Badges always include status or priority text. `Skeleton` is decorative: add a surrounding status label. `EmptyState` and `ErrorState` accept a real action element.

`ConfirmationDialog` uses native modal focus containment, Escape, backdrop dismissal and focus restoration. Supply `open`, `title`, `description`, `confirmLabel`, `onConfirm`, `onClose`, optional `busy`/`error`. Busy operations disable dismissal. Toasts support success/error, accessible announcements, manual close, and pause expiry on hover/focus.

### Incident card and loading

```tsx
import type { Incident } from "@/types/api";
import { Card, CardHeader, PriorityBadge, StatusBadge, LoadingSpinner } from "@/components/ui";

export function IncidentCard({ incident }: { incident: Incident }) {
  return <Card>
    <CardHeader title={incident.emergencyType}
      description={incident.location?.address ?? "Location requires verification"}
      actions={<PriorityBadge priority={incident.priorityLevel} />} />
    <p>{incident.description}</p>
    <StatusBadge status={incident.status} />
    <p className="helper">{incident.peopleAffected} people reported affected</p>
  </Card>;
}
// While waiting: <LoadingSpinner label="Loading incidents..." />
```

Render sensitive incident details only inside authenticated coordinator UI. React escapes text; never use `dangerouslySetInnerHTML` for reports. Priority and confidence are separate concepts; recommendations are approximate straight-line distance, not travel time or automatic dispatch.

### Form field and submission

```tsx
// Inside a client component:
<FormField label="Description" required error={descriptionError}
  description="Describe the situation without unnecessary personal details.">
  {(props) => <Textarea {...props} name="description" maxLength={2000} />}
</FormField>
```

```ts
import { incidents } from "@/lib/api/incidents";
import { ApiError, errorMessage } from "@/lib/api/client";
import type { CreateIncidentInput } from "@/types/api";

async function submit(input: CreateIncidentInput) {
  try {
    const incident = await incidents.create(input);
    // Show acceptance only after this resolves. This is not rescue dispatch.
    return incident;
  } catch (error) {
    if (error instanceof ApiError && error.code === "aborted") return;
    throw new Error(errorMessage(error)); // Or set form error / call toast(message, "error").
  }
}
```

### List, cancel and recover

```tsx
// Inside a client component; import useEffect/useState, Incident, incidents,
// ApiError, errorMessage, ErrorState, Button, LoadingSpinner, and IncidentCard.
const [items, setItems] = useState<Incident[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState("");
const [attempt, setAttempt] = useState(0);
useEffect(() => {
  const controller = new AbortController();
  incidents.list({ sort: "priority", page: 1, limit: 20 }, controller.signal)
    .then((result) => { if (!controller.signal.aborted) setItems(result.items); })
    .catch((error: unknown) => {
      if (!controller.signal.aborted) setError(errorMessage(error));
    })
    .finally(() => { if (!controller.signal.aborted) setLoading(false); });
  return () => controller.abort();
}, [attempt]);
// Render loading first; then error; then an EmptyState or items.
// <ErrorState message={error} action={<Button onClick={() => {
//   setError(""); setLoading(true); setAttempt((n) => n + 1);
// }}>Try again</Button>} />
```

## API contract

Native fetch always uses `credentials: include` and `cache: no-store`. The client unwraps `data` from `{success:true,data,...}` and rejects malformed envelopes. Errors are `ApiError` with `status` and code `http/network/timeout/aborted/protocol/configuration`. User messages deliberately omit internal server text. Validate fields locally for precise feedback. HTTP 400,401,403,404,409,429 and server failures are mapped centrally. Default timeout is 15s; `request` accepts `timeoutMs` and AbortSignal. Do not blindly retry writes after a timeout: acceptance may have occurred on the server.

| Module | Supported operations |
| --- | --- |
| `incidents` | create, list, get, updateStatus, overridePriority, recommendations |
| `teams` | list, get, create |
| `assignments` | list, create |
| `auth` | login, session, logout |

Lists return `{items,pagination:{page,limit,total,totalPages}}`. Incident query supports status/priorityLevel/sort; team and assignment queries support their respective statuses. Public creation accepts no priority, assigned team, simulation marker, or admin fields. No unsupported team-update, tracking, registration, or automatic-dispatch API was added.

## Authentication and deployment

Login is `POST /v1/login`; session is `GET /v1/user/me`; logout is `PUT /v1/logout`. Session now returns HTTP 200 and only `_id/name/email/role`, with `Cache-Control: no-store`. Logout clears matching cookies without a future maxAge. These are the only backend behavior changes.

Root `AuthProvider` holds only the safe user profile in memory. The legacy login response contains JWTs, but the client discards that response and verifies cookies with a fresh session check. No localStorage/sessionStorage tokens. Session initialization and tab-visibility revalidation use request generation checks against stale reads. Protected API 401 emits a session-expiry event; the guard hides the workspace and redirects to login. 403 remains an authorization error, not a redirect loop. Network failure shows retry. Failed logout retains the session and an error; 401 means it is already expired. There is no automatic refresh-token flow; expiration requires sign-in again. The existing backend logout requires a valid access cookie, so an already-expired session cannot revoke its refresh token through that route.

`CoordinatorGuard` is UX protection only. Existing backend middleware independently requires authentication plus the admin role for coordinator APIs. Do not ship private records in server component props assuming the client guard secures them.

Backend CORS permits exactly `FRONTEND_URL` and credentials. Cookies are HTTP-only, path `/`, SameSite Strict, with a domain derived from `SERVER_URL`; Secure is enabled outside development. Localhost different ports are same-site. Separate `*.vercel.app` and `*.onrender.com` domains are cross-site and will not support this Strict-cookie setup. Production needs HTTPS same-site custom domains (for example app.example.org/api.example.org) with exact CORS origin, or a reviewed same-origin reverse proxy that handles cookie Domain correctly. Do not change SameSite or disable Secure just to make a demo work. Deployment was not performed by this feature.

## Verification and limitations

```powershell
cd frontend
npm run lint
npx tsc --noEmit
npm run build
npm test
```

Playwright uses installed Google Chrome (`channel: chrome`), starts Next dev on port 3100, mocks auth at port 4000, checks widths 375/768/1280/1440, navigation, form errors, loading dimensions, modal keyboard behavior, role rejection, logout/expiry, rejected cookies and unavailable services. API tests cover success, 400/401/403/404/409/429/500, network errors, invalid responses, timeout/cancellation. Screenshots and failed traces stay ignored in `frontend/test-results/`. Browser mocks do not verify production cookie transport. Backend integration tests separately verify real login, safe profile, logout expiry, and protected requests with an explicitly isolated MongoDB test database.

No full dashboard, SOS form, live dispatch, production hosting, refresh-token automation, or real coordinator account provisioning is included. Existing dependency audit findings are not upgraded in this feature. Before deployment, review those advisories and configure same-site domains and secrets. The untracked brain pack and globally installed skills are intentionally excluded from the commit.

### Feature 02 verification record

- Frontend ESLint, TypeScript (`tsc --noEmit`), and production build passed.
- 22 Playwright/API tests passed using Chrome and a real Next development server; browser authentication responses were mocked.
- All 48 backend tests passed, including real login/session/logout against an isolated temporary Atlas database that was cleaned up afterward.
- Changed backend files passed targeted ESLint and Prettier checks.
- Screenshots inspected at mobile and desktop widths; automated overflow checks covered all four requested widths.
- Initial lint/type and browser-selector failures were corrected before the final run.
- No production deployment or live browser login against an operational coordinator account was attempted.
