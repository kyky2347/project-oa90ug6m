import { test, expect } from "@playwright/test";
test("methodology and product positioning remain available without a warehouse", async ({
  page,
}) => {
  await page.goto("/methodology");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(
    page
      .getByText("Final opportunityᵢ = 50 + cᵢ · (raw opportunityᵢ − 50)", {
        exact: false,
      })
      .first(),
  ).toBeVisible();
  await page.goto("/about");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.locator("body")).toContainText("PULSE");
});
