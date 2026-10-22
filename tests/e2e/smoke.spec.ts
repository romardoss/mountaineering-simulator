// E2E smoke (ARCHITECTURE §8): all screens, default preset, a few steps, locale switch mid-game.
import { expect, test } from "@playwright/test";

test("configure the default preset, play steps, switch language", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Грати" }).click();
  await page.getByRole("button", { name: "Схил", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Вибір схилу" })).toBeVisible();
  await page.getByRole("button", { name: /Схил з деревами/ }).click();
  for (let i = 0; i < 6; i++) {
    const start = page.getByRole("button", { name: /Почати|Старт/ }).first();
    if (await start.isVisible().catch(() => false)) break;
    await page.getByRole("button", { name: /Далі/ }).first().click();
  }
  await page.getByRole("button", { name: /Почати|Старт/ }).first().click();
  await expect(page.getByRole("button", { name: /Виконати крок/ })).toBeVisible();
  // CR-18: right-click on the hill sends the selected member there
  const canvas = page.locator("canvas").first();
  const box = (await canvas.boundingBox())!;
  await canvas.click({ button: "right", position: { x: box.width * 0.75, y: box.height * 0.5 } });
  await expect(page.getByText(/Іти до \d/).first()).toBeVisible();
  for (let i = 0; i < 3; i++) {
    await page.getByRole("button", { name: /Виконати крок/ }).click();
    await page.keyboard.press("Space");
    await page.waitForTimeout(300);
  }
  await page.getByRole("button", { name: "EN" }).first().click();
  await expect(page.getByRole("button", { name: /Execute step|Run step|Do step/i })).toBeVisible();
  expect(errors).toEqual([]);
});

test("obstacle constructor: a copied hill appears in the play list", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Конструктор перешкод" }).click();
  await page.getByRole("button", { name: "Копіювати й змінити" }).first().click();
  await page.getByLabel("Назва").fill("Мій тестовий схил");
  await page.getByRole("button", { name: "Зберегти" }).click();
  await expect(page.getByRole("heading", { name: "Мій тестовий схил" })).toBeVisible();
  await page.getByText("Закріпи").first().click();
  await page.getByRole("button", { name: "Грати" }).click();
  await page.getByRole("button", { name: "Схил", exact: true }).click();
  await expect(page.getByRole("button", { name: /Мій тестовий схил/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("glossary and knot reference open from the menu", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Словник" }).click();
  await expect(page.getByText("Перила").first()).toBeVisible();
  await page.goto("/");
  await page.getByRole("button", { name: "Вузли" }).click();
  await expect(page.getByText("Схоплюючий Прусіка").first()).toBeVisible();
});
