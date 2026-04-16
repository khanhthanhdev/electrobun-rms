import { expect, test } from "@playwright/test";
import {
  createEventCode,
  createProvisionedEvent,
} from "../support/api-helpers";

test("creates an event and manages its default accounts flow", async ({
  page,
}) => {
  const eventCode = createEventCode("m");
  const eventName = `Manual Event ${eventCode.toUpperCase()}`;

  await page.goto("/create/event");

  await page.locator("#eventCode").fill(eventCode);
  await page.locator("#eventName").fill(eventName);
  await page.locator("#region").fill("Vietnam");
  await page.locator("#startDate").fill("2026-04-10");
  await page.locator("#endDate").fill("2026-04-11");
  await page.locator("#eventType").fill("1");
  await page.locator("#divisions").fill("1");
  await page.locator("#fields").fill("1");
  await page.getByRole("button", { name: "Create Event" }).click();

  await expect(page).toHaveURL(`/event/${eventCode}/dashboard/defaultaccounts`);
  await expect(
    page.getByRole("heading", { name: `Default Accounts - ${eventCode}` })
  ).toBeVisible();

  await page
    .getByRole("button", { name: "Regenerate Default Accounts" })
    .click();
  await expect(
    page.getByRole("button", { name: "Regenerate Accounts (Confirm)" })
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Regenerate Accounts (Confirm)" })
    .click();

  await expect(page.getByText("Regenerated", { exact: false })).toBeVisible();
  await expect(
    page.locator(".table-credentials tbody tr").first()
  ).toBeVisible();

  await page.getByRole("link", { name: "Back to Home" }).click();
  await expect(
    page.getByRole("button", { name: eventCode }).first()
  ).toBeVisible();

  await page.getByRole("button", { name: eventCode }).first().click();
  await expect(page).toHaveURL(`/event/${eventCode}`);
  await expect(
    page.getByRole("link", { name: "Event Dashboard" })
  ).toBeVisible();

  await page.getByRole("link", { name: "Event Dashboard" }).click();
  await expect(page).toHaveURL(`/event/${eventCode}/dashboard`);
  await expect(
    page.getByRole("heading", {
      name: `${eventCode}: ${eventName} — Dashboard`,
    })
  ).toBeVisible();
});

test("shows a validation error when creating an event with a duplicate code", async ({
  page,
  request,
}) => {
  const { eventCode } = await createProvisionedEvent(request);

  await page.goto("/create/event");

  await page.locator("#eventCode").fill(eventCode);
  await page.locator("#eventName").fill("Duplicate Event");
  await page.locator("#region").fill("Vietnam");
  await page.locator("#startDate").fill("2026-04-10");
  await page.locator("#endDate").fill("2026-04-11");
  await page.locator("#eventType").fill("1");
  await page.locator("#divisions").fill("1");
  await page.locator("#fields").fill("1");
  await page.getByRole("button", { name: "Create Event" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL("/create/event");
});

test("edits an event and persists updated details to the event home", async ({
  page,
  request,
}) => {
  const { eventCode, eventName } = await createProvisionedEvent(request);
  const updatedName = `${eventName} Updated`;

  await page.goto(`/event/${eventCode}/edit`);
  await expect(page.getByRole("heading", { name: "Edit Event" })).toBeVisible();

  await page.locator("#eventName").fill(updatedName);
  await page.locator("#region").fill("Ho Chi Minh City");
  await page.locator("#fields").fill("2");
  await page.getByRole("button", { name: "Save Event" }).click();

  await expect(page.getByText("Event updated successfully.")).toBeVisible();

  await page.goto(`/event/${eventCode}`);
  await expect(
    page.getByRole("heading", { name: `${eventCode}: ${updatedName}` })
  ).toBeVisible();
  await page.getByRole("link", { name: "Event Dashboard" }).click();
  await expect(page).toHaveURL(`/event/${eventCode}/dashboard`);
});

test("requires all mandatory fields before submitting", async ({ page }) => {
  await page.goto("/create/event");

  await page.getByRole("button", { name: "Create Event" }).click();

  await expect(page).toHaveURL("/create/event");
  const eventCodeInput = page.locator("#eventCode");
  const isInvalid =
    (await eventCodeInput.evaluate(
      (el: HTMLInputElement) => !el.validity.valid
    )) || (await page.getByRole("alert").isVisible());
  expect(isInvalid).toBe(true);
});
