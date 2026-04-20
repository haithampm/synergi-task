import fs from "node:fs/promises";
import path from "node:path";
import { chromium } from "@playwright/test";

const baseUrl = process.env.MANUAL_BASE_URL ?? "http://127.0.0.1:4173";
const outputDir = path.resolve("docs", "screenshots");

const session = {
  access_token: "demo-access-token",
  refresh_token: "demo-refresh-token",
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: {
    id: "00000000-0000-4000-8000-000000000001",
    aud: "authenticated",
    role: "authenticated",
    email: "manual.demo@synergi.local",
    email_confirmed_at: new Date().toISOString(),
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Manual Demo User" },
    identities: [],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
};

const shots = [
  { file: "dashboard-overview.png", path: "/", waitFor: "text=Advanced Dashboard" },
  { file: "projects-portfolio.png", path: "/projects", waitFor: "text=Projects" },
  { file: "tasks-workspace.png", path: "/tasks", waitFor: "text=Tasks" },
  { file: "schedule-planner.png", path: "/schedule", waitFor: "text=Schedule" },
  { file: "calendar-planner.png", path: "/calendar", waitFor: "text=Calendar" },
  { file: "documents-drive.png", path: "/documents", waitFor: "text=Documents" },
  { file: "team-chat.png", path: "/team-chat", waitFor: "text=Team Chat" },
  { file: "app-monitor.png", path: "/app-monitor", waitFor: "text=App Monitor" },
  { file: "settings-admin.png", path: "/settings", waitFor: "text=Professional Settings" },
];

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

await fs.mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1080 },
  deviceScaleFactor: 1.25,
});

await context.addInitScript((payload) => {
  localStorage.setItem("sb-cfmryfivleirdmlcapbc-auth-token", JSON.stringify(payload));
}, session);

const page = await context.newPage();

for (const shot of shots) {
  await page.goto(`${baseUrl}${shot.path}`, { waitUntil: "networkidle" });
  await page.waitForLoadState("networkidle");
  await page.waitForSelector(shot.waitFor, { timeout: 15000 });
  await wait(750);
  await page.screenshot({
    path: path.join(outputDir, shot.file),
    fullPage: true,
  });
  console.log(`captured ${shot.file}`);
}

await browser.close();
