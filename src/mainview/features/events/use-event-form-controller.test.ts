import { describe, expect, it } from "bun:test";
import {
  createEventFormState,
  eventFormReducer,
  updateEventFormField,
} from "./use-event-form-controller";

interface DemoForm {
  eventName: string;
  fields: number;
}

describe("updateEventFormField", () => {
  it("updates one field without mutating the original object", () => {
    const original: DemoForm = {
      eventName: "NRC 2026",
      fields: 1,
    };

    const updated = updateEventFormField(original, "fields", 2);

    expect(updated).toEqual({
      eventName: "NRC 2026",
      fields: 2,
    });
    expect(original.fields).toBe(1);
  });
});

describe("eventFormReducer", () => {
  it("handles submit state transitions", () => {
    const initial = createEventFormState<DemoForm>({
      eventName: "NRC 2026",
      fields: 1,
    });

    const submitting = eventFormReducer(initial, { type: "submitStart" });
    expect(submitting.isSubmitting).toBe(true);
    expect(submitting.errorMessage).toBeNull();
    expect(submitting.successMessage).toBeNull();

    const success = eventFormReducer(submitting, {
      message: "Saved",
      type: "submitSuccess",
    });
    expect(success.isSubmitting).toBe(false);
    expect(success.successMessage).toBe("Saved");

    const failed = eventFormReducer(submitting, {
      message: "Failed",
      type: "submitError",
    });
    expect(failed.isSubmitting).toBe(false);
    expect(failed.errorMessage).toBe("Failed");
  });

  it("updates form fields only when form is present", () => {
    const withForm = createEventFormState<DemoForm>({
      eventName: "NRC 2026",
      fields: 1,
    });

    const updated = eventFormReducer(withForm, {
      key: "eventName",
      type: "updateField",
      value: "NRC 2027",
    });
    expect(updated.form?.eventName).toBe("NRC 2027");

    const withoutForm = createEventFormState<DemoForm>(null);
    const unchanged = eventFormReducer(withoutForm, {
      key: "eventName",
      type: "updateField",
      value: "Ignored",
    });
    expect(unchanged.form).toBeNull();
  });
});
