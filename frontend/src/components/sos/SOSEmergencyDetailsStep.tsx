"use client";
import { Camera } from "lucide-react";
import { Button, FormField, Input, Select, Textarea } from "@/components/ui";
import { emergencyChoices, type SOSDraft, type DraftErrors } from "./report";
import type { UpdateDraft } from "./SOSLocationStep";
export function SOSEmergencyDetailsStep({
  draft,
  errors,
  update,
  showMediaInfo,
}: {
  draft: SOSDraft;
  errors: DraftErrors;
  update: UpdateDraft;
  showMediaInfo: () => void;
}) {
  return (
    <div className="rqSosStepBody rqSosDetails">
      <p className="rqSosIntro">
        Share what you know. Leave optional information blank when you are
        unsure.
      </p>
      <fieldset className="rqSosFieldset">
        <legend>Who are you reporting for?</legend>
        <div className="rqSosRadioRow">
          {(
            [
              ["myself", "Myself"],
              ["someone-else", "Someone else"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="rqSosChoice">
              <input
                type="radio"
                name="reportingFor"
                value={value}
                checked={draft.reportingFor === value}
                onChange={() => update({ reportingFor: value })}
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      <FormField
        label="Your name"
        required
        error={errors.reporterName}
        description="The report needs a reporter name. You do not need an account."
      >
        {(props) => (
          <Input
            {...props}
            name="reporterName"
            autoComplete="name"
            maxLength={100}
            value={draft.reporterName}
            onChange={(event) => update({ reporterName: event.target.value })}
          />
        )}
      </FormField>
      <FormField
        label="Type of emergency"
        required
        error={errors.emergencyType}
      >
        {(props) => (
          <Select
            {...props}
            value={draft.emergencyType}
            onChange={(event) =>
              update({
                emergencyType: event.target.value as SOSDraft["emergencyType"],
              })
            }
          >
            <option value="">Choose an emergency</option>
            {emergencyChoices.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField
        label="What happened?"
        required
        error={errors.description}
        description="Describe the situation and the help needed. Avoid unnecessary private information."
      >
        {(props) => (
          <Textarea
            {...props}
            name="description"
            rows={4}
            maxLength={2000}
            value={draft.description}
            onChange={(event) => update({ description: event.target.value })}
          />
        )}
      </FormField>
      <div className="rqSosFieldGrid">
        <FormField
          label="People affected"
          required
          error={errors.peopleAffected}
          description="A positive estimate is required to record a report."
        >
          {(props) => (
            <Input
              {...props}
              name="peopleAffected"
              type="number"
              inputMode="numeric"
              min={1}
              max={10000}
              step={1}
              value={draft.peopleAffected}
              onChange={(event) =>
                update({ peopleAffected: event.target.value })
              }
            />
          )}
        </FormField>
        <FormField
          label="Immediate danger"
          description="Unknown remains unknown."
        >
          {(props) => (
            <Select
              {...props}
              value={draft.immediateDanger}
              onChange={(event) =>
                update({
                  immediateDanger: event.target
                    .value as SOSDraft["immediateDanger"],
                })
              }
            >
              <option value="unknown">Not sure</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </Select>
          )}
        </FormField>
      </div>
      <FormField
        label="Water level"
        description="Choose Not sure if you cannot judge it."
      >
        {(props) => (
          <Select
            {...props}
            value={draft.waterLevel}
            onChange={(event) =>
              update({
                waterLevel: event.target.value as SOSDraft["waterLevel"],
              })
            }
          >
            <option value="UNKNOWN">Not sure</option>
            <option value="NONE">No floodwater</option>
            <option value="LOW">Low</option>
            <option value="MODERATE">Moderate</option>
            <option value="HIGH">High</option>
          </Select>
        )}
      </FormField>
      <fieldset className="rqSosFieldset">
        <legend>People needing extra assistance (optional)</legend>
        <p className="helper">
          Leave counts blank if unknown. Enter 0 only when you know there are
          none. Categories may overlap.
        </p>
        <div className="rqSosFieldGrid">
          {(
            [
              ["children", "Children"],
              ["elderly", "Elderly people"],
              ["disabled", "People with disabilities"],
              ["medicalNeeds", "People with medical needs"],
            ] as const
          ).map(([key, label]) => (
            <FormField key={key} label={label} error={errors[key]}>
              {(props) => (
                <Input
                  {...props}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={10000}
                  step={1}
                  placeholder="Unknown"
                  value={draft[key]}
                  onChange={(event) => update({ [key]: event.target.value })}
                />
              )}
            </FormField>
          ))}
        </div>
      </fieldset>
      <FormField
        label="Contact phone (optional)"
        error={errors.reporterPhone}
        description="A phone number is not required. Use a number that is safe to share."
      >
        {(props) => (
          <Input
            {...props}
            name="reporterPhone"
            type="tel"
            autoComplete="tel"
            maxLength={32}
            value={draft.reporterPhone}
            onChange={(event) => update({ reporterPhone: event.target.value })}
          />
        )}
      </FormField>
      <FormField label="Additional notes (optional)">
        {(props) => (
          <Textarea
            {...props}
            rows={2}
            maxLength={300}
            value={draft.notes}
            onChange={(event) => update({ notes: event.target.value })}
          />
        )}
      </FormField>
      <Button variant="outline" onClick={showMediaInfo}>
        <Camera size={18} aria-hidden="true" />
        Photo and video availability
      </Button>
    </div>
  );
}
