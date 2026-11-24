import { expect, test } from "@playwright/test";
import { t } from "@microbeta/i18n";

test("la page d'accueil s'affiche", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.status()).toBe(200);

  await expect(page).toHaveTitle(t("app.name"));
  await expect(page.getByRole("heading", { level: 1, name: t("app.name") })).toBeVisible();
  await expect(page.getByText(t("app.tagline"))).toBeVisible();
});
