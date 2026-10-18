# Final QA: dashboard workflows and mode isolation

## Scope and dependencies

Built from `origin/dev` at `60ae95a`, including merged Smart SOS Triage (#53) and animated SOS UX (#54). The open notifications API PR #24 is a separate dependency and was not imported. The current shell bell counts critical incidents; this patch improves that badge without changing its data source or notification APIs.

All changes are frontend-only. Authentication, public SOS payloads, backend endpoints, transaction services, database schemas, WeatherAPI, and Groq behavior are preserved. Public SOS continues using its existing API regardless of dashboard mode.

## Bug tracking

| Unique issue | Finding and resolution |
| --- | --- |
| 001 Incident filtering | Demo returned every fixture regardless of selected filters; Real Data searched only the loaded page. Demo now applies AND filters and explicit priority ranking before pagination. Real Data sends search and filters to the existing paginated API, with stale-response protection. Missing verification never matches VERIFIED. |
| 002 Assignment selector | The dropdown was real but disabled by intentional demo restrictions; recommendations used a separate fixture team list. Recommendations and dropdown now share eligible store teams and selected ID. A stale selected team is not silently replaced with a different team. Real API conflict checks remain authoritative. |
| 003 Quick Preview scrolling | Drawer body needed a constrained flex height and scroll containment; background scrolling was not locked. Adds min-height zero, non-shrinking content, overscroll containment, and ancestor/body scroll locking with cleanup. Wheel behavior is browser-tested. |
| 004 Three dots | The button already refreshed records; there was no menu. Uses a refresh icon matching its existing accessible name and handler. No administrative actions added. |
| 005 Timeline alignment | Center alignment positioned shorter nodes below the timestamped Pending node. Top-aligns nodes and reserves consistent node height; stored timestamps are preserved. |
| 006 Bell badge | Current dev displays critical-alert count, not the pending notification API's unread count. Enlarges the display, preserves zero-count hiding, adds accessible count text and 99+ cap. No notification behavior changed. |
| 007 Availability confirmation | Shared button styling was overridden by the team workspace button background, with white text losing contrast; the dialog also used generic Confirm text. Adds scoped colors and explicit Set Offline / Set Available labels. Demo updates shared state; Real Data retains the existing update callback. |
| 008 SOS confirmation / Edit | Merged SOS tests already demonstrated coordinate copying and Edit Report. Confirmation now also closes the map and displays the confirmed-location message. Regression tests reopen it and verify the marker, retained details, and payload. |
| 009 Team code | Intentional immutable identifier: backend update contract excludes code. Retains immutability and adds Permanent identifier copy/title in registration and profile views. |

Duplicate reports consolidated: availability missing-label reports BUG-007 / BUG-003 are one issue; both BUG-004 three-dots reports are one issue.

## Shared demo environment

`demo-environment.ts` contains a pure transition function. `DashboardProvider` owns one in-memory environment and an atomic ref-backed command entry point. Incidents, teams, assignments, activity, directory views, and KPI derivation all consume this state. The reference is updated synchronously so repeated commands cannot assign an already-busy team.

Supported commands: explicit priority review, separate verification review, eligible assignment, valid status progression, resolution/cancellation with assignment completion and team release, available/offline changes, and reset. Closed incidents and invalid/out-of-order actions are rejected. Capability and existing-assignment restrictions are checked locally; reported capacity limitations stay visible for human review.

Initial demo fixtures had contradictory relationships (active assignments with Pending incidents and an incompatible assigned-team reference). Initialization reconciles those fictional relationships once. It does not touch API records or mutate the fixture constants.

Demo action callbacks are explicit arguments separate from API callbacks. The simulation path executes only the shared local command; real mode refuses simulation commands. Mode switching clears selected detail snapshots; incident/team screens remount their action state. Existing in-flight API reads retain stale-response guards. Reset Demo asks for confirmation, and a full page reload recreates the original simulated scenario. Demo team registration/profile editing remain intentionally unavailable; availability and assignment are interactive.

## Real Data protection

The incident workspace, team dialog, and assignment workspace retain existing authenticated API clients and confirmation/error handling. Real assignment success still depends on an API response; a rejected priority mutation retains stored priority and displays the rejection. Dashboard real list calls explicitly request `isSimulated=false`. No production mutations, seeds, or database writes were used during QA.

## Validation and artifacts

Focused configuration: `frontend/playwright.qa.config.ts`, isolated server at localhost:3031. Scenarios live in `final-qa.spec.ts` and the existing `sos-ux.spec.ts`.

Browser coverage includes combined demo filters/counts, server-side real search, explicit default Demo Mode, priority review, verification, selecting an alternative eligible team, assignment and lifecycle progression, cross-screen assignment/team state, availability labels and updates, drawer wheel scrolling and body-lock restoration, real assignment confirmation and rejected mutation, optional SOS payloads, GPS, map confirmation/reopening, Edit Report recovery, translations, and responsive/reduced-motion checks.

Build and final focused results are recorded in the PR. Full lint has a pre-existing `react-hooks/set-state-in-effect` error in `risk-zones/DistrictWeatherPanels.tsx:36`; that protected module is unchanged. Backend checks are unnecessary because no backend files changed. Real-data browser tests use isolated API fixtures; production persistence and real notification PR #24 are not claimed as validated.

Screenshots are saved under `frontend/test-results/` by the focused browser tests; they are local QA artifacts, not shipped assets.

## Changed files

- `frontend/src/components/dashboard/demo-environment.ts`
- `frontend/src/components/dashboard/incident-filters.ts`
- `frontend/src/components/dashboard/dashboard-context.tsx`
- `frontend/src/components/dashboard/DashboardOverview.tsx`
- `frontend/src/components/dashboard/IncidentManagement.tsx`
- `frontend/src/components/dashboard/IncidentQuickPreview.tsx`
- `frontend/src/components/dashboard/RecentActivity.tsx`
- `frontend/src/components/dashboard/incident-detail/use-incident-workspace.ts`
- `frontend/src/components/dashboard/incident-detail/IncidentWorkspace.tsx`
- `frontend/src/components/dashboard/incident-detail/IncidentFactCards.tsx`
- `frontend/src/components/dashboard/incident-detail/incident-detail.css`
- `frontend/src/components/assignments/AssignmentWorkspace.tsx`
- `frontend/src/components/assignments/use-assignment-workspace.ts`
- `frontend/src/components/rescue-teams/RescueTeamsWorkspace.tsx`
- `frontend/src/components/rescue-teams/use-rescue-teams.ts`
- `frontend/src/components/rescue-teams/TeamAssignmentDialog.tsx`
- `frontend/src/components/rescue-teams/TeamActivity.tsx`
- `frontend/src/components/rescue-teams/TeamDetails.tsx`
- `frontend/src/components/rescue-teams/TeamFormDialog.tsx`
- `frontend/src/components/layout/command-center.css`
- `frontend/src/components/layout/dashboard-shell.tsx`
- `frontend/src/components/sos/QuickSOSCorrected.tsx`
- `frontend/src/types/api.ts`
- `frontend/tests/final-qa.spec.ts`
- `frontend/tests/sos-ux.spec.ts`
- `frontend/playwright.qa.config.ts`
- `docs/final-qa-demo-workflows.md`
