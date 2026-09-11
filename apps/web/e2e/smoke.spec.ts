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

test("language preference survives navigation and reload on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/about");
  await page.getByRole("button", { name: "简体中文", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "读懂城市的复杂",
  );
  await page.getByRole("link", { name: "方法说明", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "没有黑箱",
  );
  await page.reload();
  await expect(page.getByRole("button", { name: "简体中文" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "No black box.",
  );
  await expect(
    page.getByRole("navigation", { name: "Main navigation" }),
  ).toBeVisible();
});
