import { test, expect, type Page } from "./map-test-fixtures";
import { MOCK_INCIDENTS, MOCK_RESCUE_TEAMS } from "../src/components/dashboard/mock-data";
import type { Assignment, Incident } from "../src/types/api";

async function setup(page: Page, options: { failure?: number; missing?: boolean; location?: boolean; sparse?: boolean } = {}) {
  let record: Incident = { ...structuredClone(MOCK_INCIDENTS[0]), isSimulated: false, status: "PENDING", assignedTeam: null, priorityOverrides: [],
    verification: { status: "NEEDS_REVIEW", requiresManualReview: true, isPotentialDuplicate: true, potentialDuplicateIncidents: ["661200000000000000000099"], missingFields: [], warnings: ["Possible duplicate needs coordinator review"] } };
  if (options.location === false) record.location = null;
  if (options.sparse) record = { ...record, peopleAffected: 0, vulnerablePeople: undefined, priorityReasons: [], priorityOverrides: [], verification: undefined };
  let team = { ...structuredClone(MOCK_RESCUE_TEAMS[0]), isSimulated: false, currentIncident: null as string | null, status: "AVAILABLE" as "AVAILABLE" | "BUSY" };
  const storedAssignments: Assignment[] = [];
  const writes: { path: string; body: Record<string, string> }[] = [];
  const reads: string[] = [];
  let missing = options.missing;
  await page.route("http://localhost:4000/v1/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: { _id: "012345678901234567890123", name: "Ayesha Khan", role: "admin", email: "test@example.com" } }) }));
  await page.route("http://localhost:4000/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status < 400, data }) });
    if (request.method() !== "GET") {
      const body = request.postDataJSON(); writes.push({ path, body });
      if (options.failure) return reply(null, options.failure);
      if (path.endsWith("/verification")) record = { ...record, verification: { ...record.verification!, status: body.status, reviewNotes: body.notes, reviewedAt: new Date().toISOString() } };
      if (path.endsWith("/priority")) record = { ...record, priorityLevel: body.priorityLevel, priorityScore: 50, priorityOverrides: [{ previousPriority: record.priorityLevel, newPriority: body.priorityLevel, previousScore: record.priorityScore, newScore: 50, reason: body.reason, coordinatorId: "012345678901234567890123", timestamp: new Date().toISOString() }] };
      if (path.endsWith("/assignments")) {
        record = { ...record, status: "ASSIGNED", assignedTeam: team._id };
        team = { ...team, status: "BUSY", currentIncident: record._id };
        const assignment: Assignment = { _id: "661200000000000000000077", incidentId: record._id, teamId: team._id, status: "ACTIVE", assignedAt: new Date().toISOString(), completedAt: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), isSimulated: false };
        storedAssignments.push(assignment);
        return reply(assignment, 201);
      }
      if (path.endsWith("/status")) {
        record = { ...record, status: body.status };
        if (body.status === "RESOLVED") { record.assignedTeam = null; team = { ...team, status: "AVAILABLE", currentIncident: null }; storedAssignments[0].status = "COMPLETED"; storedAssignments[0].completedAt = new Date().toISOString(); }
      }
      return reply(record);
    }
    reads.push(url.pathname + url.search);
    if (path.endsWith("/recommendations")) return reply({ manualSelectionRequired: true, distanceType: "APPROXIMATE_STRAIGHT_LINE_KM", message: "Manual coordinator selection required.", items: options.location === false ? [] : [{ team, approximateDistanceKm: 2.5, capacityWarning: "Multiple trips may be needed" }] });
    if (path.endsWith(record._id)) return reply(missing ? null : record, missing ? 404 : 200);
    const items = path.endsWith("/incidents") ? (url.searchParams.get("status") && url.searchParams.get("status") !== record.status ? [] : [record]) : path.endsWith("/rescue-teams") ? [team] : storedAssignments;
    return reply({ items, pagination: { page: 1, limit: 100, total: items.length, totalPages: 1 } });
  });
  return { id: record._id, teamId: team._id, writes, reads, restore: () => { missing = false; }, update: (patch: Partial<Incident>) => { record = { ...record, ...patch }; } };
}
async function open(page: Page, id: string) {
  await page.goto(`/dashboard/incidents/${id}`);
  await expect(page.getByRole("heading", { name: "Incident Details", exact: true })).toBeVisible();
}
test("incident workspace is reachable from the list preview and Overview popup", async ({ page }) => {
  await setup(page);
  await page.goto("/dashboard/incidents");
  await page.getByRole("button", { name: "Preview demo incident workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Incident Details", exact: true })).toBeVisible();
  await expect(page.getByText("Simulation / Prototype · Read-only incident")).toBeVisible();
  await page.goto("/dashboard?demo=true");
  await page.locator(".rqCommandIncident").first().click();
  await page.getByRole("dialog").getByRole("button", { name: "Open full incident workspace", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Incident Details", exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/dashboard\/incidents\/[a-f0-9]{24}\?demo=true/);
});
test("incident list preserves filtering and navigates to a durable detail URL", async ({ page }, info) => {
  const api = await setup(page);
  await page.goto("/dashboard/incidents");
  await expect(page.locator(".rqIncidentRow")).toHaveCount(1);
  await page.getByPlaceholder("Search loaded records").fill("no matching report");
  await expect(page.getByText("No incidents match the current filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await page.getByRole("combobox", { name: "Filter by status" }).selectOption("RESOLVED");
  await expect.poll(() => api.reads.some(path => path.includes("status=RESOLVED"))).toBe(true);
  await expect(page.getByText("No incidents match the current filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(page.locator(".rqIncidentRow")).toHaveCount(1);
  await page.screenshot({ path: info.outputPath("incident-list.png"), fullPage: true });
  await page.locator(".rqIncidentRow").click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/incidents/${api.id}$`), { timeout: 20000 });
  await expect(page.locator(".sidebar-nav a[aria-current=page]")).toHaveText("Incidents");
  await page.reload();
  await expect(page.getByRole("heading", { name: "Incident Details", exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to incidents", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard\/incidents$/);
});
test("workspace uses real priority, vulnerability, verification flags and map coordinates", async ({ page }) => {
  const api = await setup(page); await open(page, api.id);
  await expect(page.getByRole("img", { name: "Priority score 92 out of 100" })).toBeVisible();
  await expect(page.getByText("Immediate danger reported", { exact: true }).first()).toBeVisible();
  await page.locator(".rqDetailVerificationDisclosure > summary").click();
  await expect(page.getByText("Possible duplicate needs coordinator review")).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Maps" })).toHaveAttribute("href", /mlat=24\.8315&mlon=67\.1245/);
  await expect(page.locator(".rqDetailMap.leaflet-container")).toBeVisible();
  await expect(page.getByText(/92%|96%|2,800/)).toHaveCount(0);
  await expect(page.locator(".rqDetailMedia")).toContainText("No attached media supplied");
  await expect(page.locator(".rqDetailMedia img")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Post Note", exact: true })).toBeDisabled();
  await page.getByRole("button", { name: "Zoom incident map in" }).click();
  await page.getByTitle("Reported incident location", { exact: true }).click();
  await expect(page.locator(".leaflet-popup")).toContainText("Focus halo is decorative");
});
test("recommendation selection, confirmed assignment, verification and resolution use actual clients", async ({ page }) => {
  const api = await setup(page); await open(page, api.id);
  await page.locator(".rqDetailRecommendations li button").click();
  expect(api.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Assign Team", exact: true }).click();
  expect(api.writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm assignment", exact: true }).click();
  await expect(page.locator(".rqDetailStatus")).toContainText("ASSIGNED");
  expect(api.writes[0]).toEqual({ path: "/api/assignments", body: { incidentId: api.id, teamId: api.teamId } });
  await expect(page.getByRole("button", { name: "Assign Team", exact: true })).toHaveCount(0);
  await page.locator(".rqDetailVerificationDisclosure > summary").click();
  await page.getByLabel("Verification decision", { exact: true }).selectOption("VERIFIED");
  await page.getByLabel("Review notes", { exact: true }).fill("Coordinator confirmed the report by phone.");
  await page.getByRole("button", { name: "Record verification", exact: true }).click();
  await expect(page.getByText("Verification review recorded.")).toBeVisible();
  for (const value of ["IN_PROGRESS", "RESOLVED"]) {
    await page.getByLabel("New incident status", { exact: true }).selectOption(value);
    await page.getByRole("button", { name: "Confirm status change", exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true }).click();
    await expect(page.locator(".rqDetailStatus [aria-current=step]")).toContainText(value.replaceAll("_", " "));
  }
  await expect(page.locator(".rqDetailTimeline")).toContainText("Assignment completed");
  expect(api.writes.map(write => write.path.split("/").at(-1))).toEqual(["assignments", "verification", "status", "status"]);
});
for (const failure of [400, 409, 500]) test(`assignment failure ${failure} preserves selection without false success`, async ({ page }) => {
  const api = await setup(page, { failure }); await open(page, api.id);
  await page.locator(".rqDetailRecommendations li button").click();
  await page.getByRole("button", { name: "Assign Team", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm assignment", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.locator(".rqDetailAssignment select").first()).toHaveValue(api.teamId);
  await expect(page.locator(".rqDetailNotice.is-success")).toHaveCount(0);
  await expect(page.locator(".rqDetailStatus [aria-current=step]")).toContainText("PENDING");
  if (failure === 500) await expect(page.getByText(/I reviewed current records/)).toBeVisible();
});
test("priority override requires an explanation and confirmation", async ({ page }) => {
  const api = await setup(page); await open(page, api.id);
  await page.getByRole("button", { name: "Adjust Priority", exact: true }).click();
  await page.getByLabel("New priority", { exact: true }).selectOption("HIGH");
  await page.getByLabel("Override explanation", { exact: true }).fill("On-site coordinator confirmed reduced immediate risk.");
  await page.getByRole("button", { name: "Review priority change", exact: true }).click();
  expect(api.writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("img", { name: "Priority score 50 out of 100" })).toBeVisible();
  await expect(page.locator(".rqDetailOverrideNote")).toContainText("reduced immediate risk");
  expect(api.writes[0].body).toEqual({ priorityLevel: "HIGH", reason: "On-site coordinator confirmed reduced immediate risk." });
});
test("sparse records preserve known zero and show missing coordinates and history honestly", async ({ page }) => {
  const api = await setup(page, { location: false, sparse: true }); api.update({ createdAt: "", updatedAt: "" }); await open(page, api.id);
  await expect(page.getByRole("heading", { name: "Location verification required", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Open in Maps" })).toHaveCount(0);
  await expect(page.locator(".rqDetailMap")).toHaveCount(0);
  await expect(page.locator(".rqDetailPeople strong")).toHaveText("0");
  await expect(page.locator(".rqDetailVulnerabilityGrid dd").first()).toHaveText("Not reported");
  await expect(page.getByText("No timestamped activity is available.")).toBeVisible();
  await expect(page.getByText("No eligible rescue teams are currently available.", { exact: false })).toBeVisible();
});
test("invalid and missing IDs show errors and recover without demo fallback", async ({ page }) => {
  const api = await setup(page, { missing: true });
  await page.goto("/dashboard/incidents/not-an-id");
  await expect(page.getByText("Invalid incident reference.")).toBeVisible();
  expect(api.reads.some(path => path.endsWith("/not-an-id"))).toBe(false);
  await page.goto(`/dashboard/incidents/${api.id}`);
  await expect(page.getByText(/Incident not found. It may have been removed/)).toBeVisible();
  api.restore(); await page.getByRole("button", { name: "Retry incident", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Incident Details", exact: true })).toBeVisible();
});
test("demo route remains read-only and does not request recommendations for simulated IDs", async ({ page }) => {
  const api = await setup(page);
  await page.goto(`/dashboard/incidents/${MOCK_INCIDENTS[0]._id}?demo=true`);
  await expect(page.getByText("Simulation / Prototype · Read-only incident")).toBeVisible();
  await expect(page.locator(".rqDetailMedia img")).toBeVisible();
  await expect(page.getByRole("button", { name: "Assign Team", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Record verification", exact: true })).toHaveCount(0);
  expect(api.reads.filter(path => path.endsWith(`/incidents/${MOCK_INCIDENTS[0]._id}`))).toHaveLength(0);
  expect(api.reads.filter(path => path.endsWith("/recommendations"))).toHaveLength(0);
  expect(api.writes).toHaveLength(0);
});
test("polling preserves unsent review notes and updates the current incident", async ({ page }) => {
  const api = await setup(page); await open(page, api.id);
  await page.locator(".rqDetailVerificationDisclosure > summary").click();
  await page.getByLabel("Review notes", { exact: true }).fill("Unsent review draft remains intact.");
  api.update({ peopleAffected: 23 });
  await expect(page.locator(".rqDetailPeople strong")).toHaveText("23", { timeout: 12000 });
  await expect(page.getByLabel("Review notes", { exact: true })).toHaveValue("Unsent review draft remains intact.");
});
test("verification rejection preserves the review draft", async ({ page }) => {
  const api = await setup(page, { failure: 409 }); await open(page, api.id);
  await page.locator(".rqDetailVerificationDisclosure > summary").click();
  await page.getByLabel("Verification decision", { exact: true }).selectOption("VERIFIED");
  await page.getByLabel("Review notes", { exact: true }).fill("Draft review must survive a conflict.");
  await page.getByRole("button", { name: "Record verification", exact: true }).click();
  await expect(page.locator(".rqDetailNotice.is-error")).toBeVisible();
  await expect(page.getByLabel("Review notes", { exact: true })).toHaveValue("Draft review must survive a conflict.");
  await expect(page.locator(".rqDetailHero")).toContainText("NEEDS REVIEW");
});
test("rejected lifecycle change preserves the stored status", async ({ page }) => {
  const api = await setup(page, { failure: 409 }); api.update({ status: "ASSIGNED", assignedTeam: api.teamId }); await open(page, api.id);
  await page.getByLabel("New incident status", { exact: true }).selectOption("IN_PROGRESS");
  await page.getByRole("button", { name: "Confirm status change", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm change", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.locator(".rqDetailStatus [aria-current=step]")).toContainText("ASSIGNED");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("New incident status", { exact: true })).toHaveValue("IN_PROGRESS");
});
for (const failure of [403, 500, "network"] as const) test(`incident load failure ${failure} does not show demo data`, async ({ page }) => {
  const api = await setup(page);
  await page.route(`http://localhost:4000/api/incidents/${api.id}`, route => failure === "network" ? route.abort("connectionfailed") : route.fulfill({ status: failure, contentType: "application/json", body: JSON.stringify({ success: false }) }));
  await page.goto(`/dashboard/incidents/${api.id}`);
  await expect(page.getByRole("heading", { name: "Incident unavailable", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry incident", exact: true })).toBeVisible();
  await expect(page.locator(".rqDetailMedia")).toHaveCount(0);
});
test("expired API session returns to sign-in", async ({ page }) => {
  const api = await setup(page);
  await page.route(`http://localhost:4000/api/incidents/${api.id}`, route => route.fulfill({ status: 401, contentType: "application/json", body: JSON.stringify({ success: false }) }));
  await page.goto(`/dashboard/incidents/${api.id}`);
  await expect(page).toHaveURL(/\/login\?reason=expired/);
});
test("missing optional priority and verification data remain readable", async ({ page }) => {
  const api = await setup(page, { sparse: true });
  api.update({ priorityScore: undefined as unknown as number, priorityReasons: null as unknown as string[], priorityOverrides: null as unknown as Incident["priorityOverrides"], verification: undefined });
  await open(page, api.id);
  await expect(page.getByRole("img", { name: "CRITICAL priority, numeric score unavailable" })).toBeVisible();
  await expect(page.getByText("Priority reasons were not supplied.")).toBeVisible();
});
test("minimal SOS report with omitted optional fields renders cleanly", async ({ page }) => {
  const api = await setup(page);
  api.update({
    description: undefined,
    reporterName: undefined,
    reporterPhone: undefined,
    peopleAffected: undefined,
    vulnerablePeople: undefined,
    waterLevel: undefined,
    immediateDanger: undefined,
  });
  await open(page, api.id);
  await expect(page.getByRole("heading", { name: "Incident unavailable" })).toHaveCount(0);
  await expect(page.getByText("No detailed field narrative provided by reporter.")).toBeVisible();
  await expect(page.getByText("Not reported").first()).toBeVisible();
});
test("incident with explicit null optional fields renders correctly without throwing", async ({ page }) => {
  const api = await setup(page);
  api.update({
    description: null,
    reporterName: null,
    reporterPhone: null,
    peopleAffected: null,
    vulnerablePeople: null,
    waterLevel: null,
    immediateDanger: null,
  });
  await open(page, api.id);
  await expect(page.getByRole("heading", { name: "Incident unavailable" })).toHaveCount(0);
  await expect(page.getByText("No detailed field narrative provided by reporter.")).toBeVisible();
});
test("visual review in both themes and all required widths", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", error => errors.push(error.message));
  const api = await setup(page); await page.setViewportSize({ width: 1440, height: 1000 }); await open(page, api.id);
  await page.addStyleTag({ content: "nextjs-portal { display:none!important }" });
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await expect(page.locator(".rqDetailMap.leaflet-container")).toBeVisible();
  await page.waitForTimeout(1000);
  await page.locator(".rqDetailRecommendations li button").click();
  await page.locator(".rqDetailAssignment").screenshot({ path: info.outputPath("assignment-selection.png") });
  await page.locator(".rqDetailLocation").screenshot({ path: info.outputPath("incident-location.png") });
  for (const width of [320, 375, 390, 430, 768, 1024, 1280, 1440, 1650, 1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(120);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true);
    if ([390, 1440, 1650, 1920].includes(width)) await page.screenshot({ path: info.outputPath(`incident-dark-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await page.screenshot({ path: info.outputPath("incident-light-1440.png"), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Assign Team", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const bounds = await dialog.boundingBox();
  expect(bounds!.width).toBeLessThanOrEqual(390);
  expect(bounds!.height).toBeLessThanOrEqual(844);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  expect(errors).toEqual([]);
});
