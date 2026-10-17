import { test, expect, type Page } from "@playwright/test";
import { MOCK_RESCUE_TEAMS, MOCK_INCIDENTS } from "../src/components/dashboard/mock-data";
import type { RescueTeam, Assignment } from "../src/types/api";

async function setup(page: Page, options: { failGet?: boolean; failWrite?: number; totals?: number[]; empty?: boolean; noLocation?: boolean } = {}) {
  const incident = { ...structuredClone(MOCK_INCIDENTS[0]), isSimulated: false, status: "PENDING", assignedTeam: null };
  let records: RescueTeam[] = options.empty ? [] : MOCK_RESCUE_TEAMS.map((team,index) => ({ ...structuredClone(team), isSimulated: false, status: index === 1 ? "BUSY" : index === 2 ? "OFFLINE" : "AVAILABLE", currentIncident: index === 1 ? incident._id : null, contact: { phone: "+92 300 1234567", email: "lead@example.com", leadName: "Test Coordinator" } }));
  if (options.noLocation && records[0]) records[0].location = null as unknown as RescueTeam["location"];
  const writes: { path: string; body: Record<string, unknown> }[] = [], reads: string[] = [];
  const assigned = { _id: "661200000000000000000077", incidentId: { _id: incident._id, emergencyType: incident.emergencyType, priorityLevel: incident.priorityLevel, status: "ASSIGNED" }, teamId: { _id: records[0]?._id, name: records[0]?.name }, status: "COMPLETED", assignedAt: "2026-10-17T10:00:00Z", completedAt: "2026-10-17T11:00:00Z", createdAt: "2026-10-17T10:00:00Z", updatedAt: "2026-10-17T11:00:00Z", isSimulated: false };
  await page.route("http://localhost:4000/v1/**", route => route.fulfill({ contentType: "application/json", body: JSON.stringify({ success: true, data: { _id: "012345678901234567890123", name: "Ayesha Khan", role: "admin", email: "admin@example.com" } }) }));
  await page.route("http://localhost:4000/api/**", async route => {
    const request = route.request(), url = new URL(request.url()), path = url.pathname;
    const reply = (data: unknown, status = 200) => route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ success: status < 400, data }) });
    if (request.method() !== "GET") {
      const body = request.postDataJSON(); writes.push({ path, body });
      if (options.failWrite) return reply(null, options.failWrite);
      if (path === "/api/rescue-teams") { const team = { ...body, _id: "662200000000000000000099", currentIncident: null, isSimulated: false, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() } as RescueTeam; records.unshift(team); return reply(team, 201); }
      if (path === "/api/assignments") { records = records.map(team => team._id === body.teamId ? { ...team, status: "BUSY", currentIncident: String(body.incidentId) } : team); return reply({ ...assigned, _id: "661200000000000000000088", status: "ACTIVE" } as unknown as Assignment, 201); }
      const id = path.split("/").at(-1); const current = records.find(team => team._id === id);
      if (!current) return reply(null,404);
      if (body.status && (current.status === "BUSY" || current.currentIncident)) return reply(null,409);
      const updated = { ...current, ...body } as RescueTeam; records = records.map(team => team._id === id ? updated : team); return reply(updated);
    }
    reads.push(url.pathname + url.search);
    if (options.failGet && path.startsWith("/api/rescue-teams")) return reply(null,503);
    if (path.endsWith("/recommendations")) return reply({ items: records.filter(team => team.status === "AVAILABLE").map(team => ({ team, approximateDistanceKm: 2.5, capacityWarning: null })), manualSelectionRequired: true, distanceType: "APPROXIMATE_STRAIGHT_LINE_KM", message: "Manual selection required." });
    if (path.startsWith("/api/rescue-teams/")) { const record = records.find(team => team._id === path.split("/").at(-1)); return reply(record ? { ...record, currentIncident: record.currentIncident ? { _id: record.currentIncident, emergencyType: "FLOOD", status: "ASSIGNED" } : null } : null, record ? 200 : 404); }
    if (path === "/api/assignments") { const requested = url.searchParams.get("teamId"); const items = !options.empty && (!requested || requested === records[0]?._id) ? [assigned] : []; return reply({ items, pagination: { page: 1, limit: 5, total: items.length, totalPages: items.length ? 1 : 0 } }); }
    if (path === "/api/incidents") return reply({ items: [incident], pagination: { page: 1, limit: 20, total: 1, totalPages: 1 } });
    const status = url.searchParams.get("status"), capability = url.searchParams.get("capability"), search = url.searchParams.get("search")?.toLowerCase();
    const filtered = records.filter(team => (!status || team.status === status) && (!capability || team.capabilities.includes(capability as never)) && (!search || `${team.name} ${team.teamCode}`.toLowerCase().includes(search)));
    const limit = Number(url.searchParams.get("limit") || 20), currentPage = Number(url.searchParams.get("page") || 1);
    const total = options.totals && limit === 1 ? options.totals[status === "AVAILABLE" ? 1 : status === "BUSY" ? 2 : status === "OFFLINE" ? 3 : 0] : filtered.length;
    return reply({ items: filtered.slice((currentPage-1)*limit,currentPage*limit), pagination: { page: currentPage, limit, total, totalPages: Math.ceil(total/limit) } });
  });
  return { reads, writes, first: records[0], second: records[1], third: records[2], update: (id: string, patch: Partial<RescueTeam>) => { records = records.map(team => team._id === id ? { ...team, ...patch } : team); } };
}
async function open(page: Page) { await page.goto("/dashboard/rescue-teams"); await expect(page.getByRole("heading", { name: "Rescue Team Management", exact: true })).toBeVisible(); }
async function fillRegistration(page: Page) {
  await page.getByLabel("Team name", { exact: true }).fill("Community Response North");
  await page.getByLabel("Unique team code", { exact: true }).fill("CR-NORTH");
  await page.getByLabel("Response capacity", { exact: true }).fill("12");
  await page.getByRole("checkbox", { name: "Water Rescue", exact: true }).check();
  await page.getByLabel("Base / station address", { exact: true }).fill("North Karachi base");
  await page.getByLabel("Latitude", { exact: true }).fill("24.94");
  await page.getByLabel("Longitude", { exact: true }).fill("67.04");
}
test("sidebar route, exact server totals and directory statuses", async ({ page }) => {
  await setup(page, { totals: [250,150,80,20] }); await open(page);
  await expect(page.locator(".rtDirectoryRow")).toHaveCount(8);
  await expect(page.locator(".rtMetric strong")).toHaveText(["250","150","80","20"]);
  await expect(page.locator(".sidebar-nav a[aria-current=page]")).toContainText("Rescue Teams");
  await expect(page.locator(".rtDirectory .status-BUSY")).toHaveText("On Mission");
  await expect(page.locator(".rtDirectory .status-OFFLINE")).toHaveText("Offline");
});
test("server search, status/capability filters and local sorting", async ({ page }) => {
  const api = await setup(page); await open(page); await expect(page.locator(".rtDirectoryRow")).toHaveCount(8);
  await page.getByLabel("Search teams by name or code", { exact: true }).fill("Bravo");
  await expect(page.locator(".rtDirectoryRow")).toHaveCount(1);
  expect(api.reads.some(path => path.includes("search=Bravo"))).toBe(true);
  await page.getByLabel("Search teams by name or code", { exact: true }).fill("");
  await page.getByLabel("Filter teams by status", { exact: true }).selectOption("OFFLINE");
  await expect(page.locator(".rtDirectoryRow")).toHaveCount(1);
  await expect(page.locator(".rtDirectoryRow")).toContainText(api.third.name);
  await page.getByLabel("Filter teams by status", { exact: true }).selectOption("");
  await page.getByLabel("Filter teams by capability", { exact: true }).selectOption("MEDICAL");
  await expect.poll(() => api.reads.some(path => path.includes("capability=MEDICAL"))).toBe(true);
  await page.getByLabel("Filter teams by capability", { exact: true }).selectOption("");
  await page.getByLabel("Sort loaded teams", { exact: true }).selectOption("name");
  await expect(page.locator(".rtDirectoryRow").first()).toContainText("Alpha");
});
test("directory, map selection, profile tabs and real populated history stay synchronized", async ({ page }) => {
  const api = await setup(page); await open(page);
  await expect(page.locator(".rtDetails h3")).toHaveText(api.first.name);
  await expect(page.locator(".rtActivity")).toContainText("Assignment completed");
  expect(api.reads.some(path => path.includes(`teamId=${api.first._id}`))).toBe(true);
  await page.getByRole("tab", { name: "Capabilities", exact: true }).click();
  await expect(page.locator(".rtCapabilityChips")).toContainText("Water Rescue");
  await page.getByRole("tab", { name: "Overview", exact: true }).click();
  await expect(page.getByTitle(`Select team ${api.second.name}`, { exact: true })).toBeVisible();
  await page.getByTitle(`Select team ${api.second.name}`, { exact: true }).click();
  await expect(page.locator(".rtDetails h3")).toHaveText(api.second.name);
  await expect(page.locator(".rtDirectoryRow[aria-pressed=true]")).toContainText(api.second.name);
  await expect(page.locator(".rtMap .leaflet-popup")).toContainText(api.second.name);
  await expect(page.getByRole("button", { name: "Assign to Incident", exact: true })).toBeDisabled();
  await expect(page.locator(".rtDetails")).toContainText("availability is controlled by the incident lifecycle");
  await expect(page.getByRole("button", { name: "Set Available", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Full Profile", exact: true }).click();
  await expect(page.getByRole("dialog")).toContainText("Contact lead");
});
test("registration validates, persists and selects the returned team", async ({ page }) => {
  const api = await setup(page); await open(page);
  await page.getByRole("button", { name: "Register Team", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Register team", exact: true }).click();
  expect(api.writes).toHaveLength(0);
  await fillRegistration(page);
  await page.getByRole("dialog").getByRole("button", { name: "Register team", exact: true }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.locator(".rtDetails h3")).toHaveText("Community Response North");
  expect(api.writes[0].path).toBe("/api/rescue-teams");
  expect(api.writes[0].body).not.toHaveProperty("currentIncident");
});
test("duplicate registration rejects without losing form values", async ({ page }) => {
  const api = await setup(page, { failWrite: 409 }); await open(page);
  await page.getByRole("button", { name: "Register Team", exact: true }).click(); await fillRegistration(page);
  await page.getByRole("dialog").getByRole("button", { name: "Register team", exact: true }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toBeVisible();
  await expect(page.getByLabel("Team name", { exact: true })).toHaveValue("Community Response North");
  expect(api.writes).toHaveLength(1);
});
test("BUSY profile editing excludes status and immutable relationships", async ({ page }) => {
  const api = await setup(page); await open(page);
  await page.locator(".rtDirectoryRow").filter({ hasText: api.second.name }).click();
  await expect(page.locator(".rtDetails h3")).toHaveText(api.second.name);
  await page.getByRole("button", { name: "Edit selected team", exact: true }).click();
  await expect(page.getByLabel("Availability", { exact: true })).toHaveCount(0);
  await expect(page.getByLabel("Unique team code", { exact: true })).toBeDisabled();
  await page.getByLabel("Team name", { exact: true }).fill("Medical Response Updated");
  await page.getByRole("button", { name: "Save team changes", exact: true }).click();
  await expect(page.locator(".rtDetails h3")).toHaveText("Medical Response Updated");
  expect(api.writes[0].body).not.toHaveProperty("status"); expect(api.writes[0].body).not.toHaveProperty("teamCode"); expect(api.writes[0].body).not.toHaveProperty("currentIncident");
  await expect(page.locator(".rtDetails .rtStatus")).toHaveText("On Mission");
});
test("available/offline transitions require confirmation and refresh all views", async ({ page }) => {
  const api = await setup(page); await open(page);
  await page.getByRole("button", { name: "Set Offline", exact: true }).click();
  expect(api.writes).toHaveLength(0);
  await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".rtDetails .rtStatus")).toHaveText("Offline");
  await page.getByRole("button", { name: "Set Available", exact: true }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Confirm", exact: true }).click();
  await expect(page.locator(".rtDetails .rtStatus")).toHaveText("Available");
  expect(api.writes.map(write => write.body.status)).toEqual(["OFFLINE","AVAILABLE"]);
});
test("incident assignment checks eligibility and only writes after confirmation", async ({ page }) => {
  const api = await setup(page); await open(page);
  await page.getByRole("button", { name: "Assign to Incident", exact: true }).click();
  await page.getByLabel("Pending incident", { exact: true }).selectOption(MOCK_INCIDENTS[0]._id);
  await expect(page.getByRole("button", { name: "Review assignment", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Review assignment", exact: true }).click(); expect(api.writes).toHaveLength(0);
  await page.getByRole("button", { name: "Confirm assignment", exact: true }).click();
  await expect(page.locator(".rtDetails .rtStatus")).toHaveText("On Mission");
  expect(api.writes[0]).toEqual({ path: "/api/assignments", body: { incidentId: MOCK_INCIDENTS[0]._id, teamId: api.first._id } });
});
test("missing location is visible in directory but has no fabricated marker", async ({ page }) => {
  const api = await setup(page, { noLocation: true }); await open(page);
  await expect(page.locator(".rtDirectoryRow").first()).toContainText("Location not provided");
  await expect(page.getByTitle(`Select team ${api.first.name}`, { exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Focus selected team", exact: true })).toBeDisabled();
});
test("empty API and failed API states never substitute demo records", async ({ page }) => {
  await setup(page, { empty: true }); await open(page);
  await expect(page.getByText("No teams registered yet.")).toBeVisible();
  await expect(page.locator(".rtMetric strong")).toHaveText(["0","0","0","0"]);
  await setup(page, { failGet: true }); await page.reload();
  await expect(page.getByText(/No demo records have been substituted/)).toBeVisible();
  await expect(page.locator(".rtDirectoryRow")).toHaveCount(0);
});
test("selection, tabs and form drafts survive polling", async ({ page }) => {
  const api = await setup(page); await open(page); await page.locator(".rtDirectoryRow").filter({ hasText: api.second.name }).click();
  await expect(page.locator(".rtDetails h3")).toHaveText(api.second.name);
  await page.getByRole("tab", { name: "Capabilities", exact: true }).click();
  await page.getByRole("button", { name: "Edit selected team", exact: true }).click();
  await page.getByLabel("Team name", { exact: true }).fill("Unsent team profile draft"); api.update(api.second._id,{ capacity: 42 });
  await expect.poll(() => api.reads.filter(path => path === `/api/rescue-teams/${api.second._id}`).length, { timeout: 14000 }).toBeGreaterThan(1);
  await expect(page.getByLabel("Team name", { exact: true })).toHaveValue("Unsent team profile draft");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("tab", { name: "Capabilities", exact: true })).toHaveAttribute("aria-selected","true");
});
test("read-only demo teams do not send mutation requests", async ({ page }) => {
  const api = await setup(page); await page.goto("/dashboard/rescue-teams?demo=true");
  await expect(page.getByText("Simulation / Prototype · Sample teams · Read-only")).toBeVisible();
  await expect(page.getByRole("button", { name: "Register Team", exact: true })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Assign to Incident", exact: true })).toBeDisabled();
  expect(api.writes).toHaveLength(0);
});
test("visual comparison, responsive sizes, light mode and existing route navigation", async ({ page }, info) => {
  const errors: string[] = []; page.on("pageerror", failure => errors.push(failure.message)); await setup(page);
  await page.setViewportSize({ width: 1648, height: 928 }); await open(page);
  await page.getByRole("button", { name: "Switch to dark mode", exact: true }).click();
  await page.addStyleTag({ content: "nextjs-portal {display:none!important}" });
  await expect(page.locator(".rtMap.leaflet-container")).toBeVisible(); await page.waitForTimeout(1000);
  for (const width of [320,375,390,430,768,1024,1280,1440,1648,1920]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : width === 1648 ? 928 : width === 1920 ? 1080 : 900 });
    await page.evaluate(() => window.scrollTo(0,0)); await page.waitForTimeout(100);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `overflow at ${width}`).toBe(true);
    if ([390,768,1440,1648,1920].includes(width)) await page.screenshot({ path: info.outputPath(`rescue-teams-dark-${width}.png`), fullPage: true });
  }
  await page.setViewportSize({ width: 1440, height: 900 }); await page.getByRole("button", { name: "Switch to light mode", exact: true }).click();
  await page.screenshot({ path: info.outputPath("rescue-teams-light-1440.png"), fullPage: true });
  await page.getByRole("button", { name: "Register Team", exact: true }).click(); await page.setViewportSize({ width: 390, height: 844 });
  const box = await page.getByRole("dialog").boundingBox(); expect(box!.width).toBeLessThanOrEqual(390); expect(box!.height).toBeLessThanOrEqual(844);
  await page.keyboard.press("Escape"); await page.setViewportSize({ width: 1440, height: 900 });
  await page.getByRole("link", { name: "Overview", exact: true }).click(); await expect(page).toHaveURL(/\/dashboard$/);
  await page.getByRole("link", { name: "Incidents", exact: true }).click(); await expect(page.getByRole("heading", { name: "Incident Management", exact: true })).toBeVisible(); expect(errors).toEqual([]);
});
