import { test, expect } from "@playwright/test";

test.describe("Chatbot widget", () => {
  test("floating button is visible", async ({ page }) => {
    await page.goto("/");
    const btn = page.locator(".kc-chat-button");
    await expect(btn).toBeVisible();
  });

  test("opens panel on click and shows welcome", async ({ page }) => {
    await page.goto("/");
    await page.locator(".kc-chat-button").click();
    await expect(page.locator(".kc-chat-panel")).toBeVisible();
    await expect(
      page.locator(".kc-chat-msg.assistant").first(),
    ).toContainText(/K-Culture Elite Program/);
  });

  test("submits a message and receives a reply", async ({ page }) => {
    await page.goto("/");
    await page.locator(".kc-chat-button").click();
    await page.locator(".kc-chat-input").fill("What tracks do you offer?");
    await page.locator(".kc-chat-send").click();
    // 어시스턴트 응답이 나타날 때까지 대기 (최대 20s)
    await expect(page.locator(".kc-chat-msg.assistant").nth(1)).toBeVisible({
      timeout: 20_000,
    });
  });

  test("history persists across reload", async ({ page }) => {
    await page.goto("/");
    await page.locator(".kc-chat-button").click();
    await page.locator(".kc-chat-input").fill("Hello");
    await page.locator(".kc-chat-send").click();
    await expect(page.locator(".kc-chat-msg.user")).toBeVisible();
    await page.reload();
    await page.locator(".kc-chat-button").click();
    await expect(page.locator(".kc-chat-msg.user")).toContainText("Hello");
  });
});
