import { test, expect } from "@playwright/test";
import {
  emptyDraft,
  validateDetails,
  validateLocation,
  selectedLocation,
  toIncidentInput,
  reportDescription,
  type SOSDraft,
} from "../src/components/sos/report";
const valid: SOSDraft = {
  ...emptyDraft,
  reporterName: "SIMULATED Reporter",
  emergencyType: "FLOOD",
  description: "SIMULATED rising water near the village",
  peopleAffected: "3",
  locationChoice: "manual",
  area: "SIMULATED village landmark",
};
test("requires actual API fields without manufacturing defaults", () => {
  const errors = validateDetails(emptyDraft);
  expect(errors.reporterName).toBeTruthy();
  expect(errors.emergencyType).toBeTruthy();
  expect(errors.peopleAffected).toBeTruthy();
  expect(errors.description).toBeTruthy();
  expect(validateDetails(valid)).toEqual({});
});
test("manual address is unverified text with no fabricated coordinates", () => {
  const input = toIncidentInput(valid);
  expect(input.location).toBeNull();
  expect(input.description).toContain(
    "Reported location (coordinates unverified): SIMULATED village landmark",
  );
  expect(validateLocation(valid)).toEqual({});
});
test("unknown danger, phone, and assistance counts remain omitted", () => {
  const input = toIncidentInput(valid);
  expect(input).not.toHaveProperty("immediateDanger");
  expect(input).not.toHaveProperty("reporterPhone");
  expect(input).not.toHaveProperty("vulnerablePeople");
  expect(input.waterLevel).toBe("UNKNOWN");
});
test("known zero counts and explicit no danger are preserved", () => {
  const input = toIncidentInput({
    ...valid,
    children: "0",
    elderly: "1",
    immediateDanger: "no",
  });
  expect(input.vulnerablePeople).toEqual({ children: 0, elderly: 1 });
  expect(input.immediateDanger).toBe(false);
});
test("accepts explicit zero coordinates and validates bounds and partial pairs", () => {
  expect(selectedLocation({ ...valid, latitude: "0", longitude: "0" })).toEqual(
    { latitude: 0, longitude: 0, address: valid.area },
  );
  for (const latitude of ["91", "NaN", "Infinity", " "])
    expect(
      validateLocation({ ...valid, latitude, longitude: "67" }).latitude,
    ).toBeTruthy();
  expect(
    validateLocation({ ...valid, latitude: "24", longitude: "181" }).longitude,
  ).toBeTruthy();
});
test("requires a deliberate location choice and accepts explicit unknown", () => {
  expect(validateLocation(emptyDraft).locationChoice).toBeTruthy();
  expect(
    validateLocation({ ...emptyDraft, locationChoice: "unknown" }),
  ).toEqual({});
});
test("validates optional phone, counts and combined description limits", () => {
  expect(
    validateDetails({ ...valid, reporterPhone: "abc" }).reporterPhone,
  ).toBeTruthy();
  expect(validateDetails({ ...valid, children: "-1" }).children).toBeTruthy();
  expect(
    validateDetails({ ...valid, peopleAffected: "0" }).peopleAffected,
  ).toBeTruthy();
  expect(
    validateDetails({
      ...valid,
      description: "x".repeat(2000),
      notes: "extra notes",
    }).description,
  ).toBeTruthy();
});
test("normalizes multiline text to the backend's text contract and records reporting context", () => {
  const draft = {
    ...valid,
    description: "Floodwater\nnear the road",
    reportingFor: "someone-else" as const,
  };
  expect(reportDescription(draft)).not.toContain("\n");
  expect(toIncidentInput(draft).description).toContain(
    "Reporting on behalf of someone else.",
  );
  expect(
    validateDetails({ ...valid, description: "<script>bad</script>" })
      .description,
  ).toBeTruthy();
});
