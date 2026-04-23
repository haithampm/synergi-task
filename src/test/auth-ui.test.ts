import { describe, expect, it } from "vitest";
import { getAuthErrorMessage, isInAppBrowser } from "@/lib/auth-ui";

describe("auth ui helpers", () => {
  it("detects common in-app browser user agents", () => {
    expect(
      isInAppBrowser(
        "Mozilla/5.0 (Linux; Android 14; Pixel 7 Build/UP1A) AppleWebKit/537.36 Chrome/123.0.0.0 Mobile Safari/537.36 [FBAN/EMA;FBLC/en_US;FBAV/456.0.0.0.1;]",
      ),
    ).toBe(true);

    expect(
      isInAppBrowser(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/135.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("normalizes rate-limit auth errors into a helpful message", () => {
    expect(getAuthErrorMessage(new Error("email rate limit exceeded"))).toBe(
      "Too many reset emails were requested recently. Wait a minute, then try again or use Google sign-in.",
    );
  });
});
