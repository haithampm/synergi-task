const IN_APP_BROWSER_PATTERNS = [
  /fban/i,
  /fbav/i,
  /instagram/i,
  /line\//i,
  /micromessenger/i,
  /tiktok/i,
  /snapchat/i,
  /linkedinapp/i,
  /wv\)/i,
  /; wv/i,
  /webview/i,
];

export const isInAppBrowser = (userAgent?: string) => {
  const value =
    userAgent ??
    (typeof navigator !== "undefined" ? navigator.userAgent : "");

  return IN_APP_BROWSER_PATTERNS.some((pattern) => pattern.test(value));
};

export const getAuthErrorMessage = (error: unknown) => {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "";

  if (/email rate limit exceeded/i.test(message)) {
    return "Too many reset emails were requested recently. Wait a minute, then try again or use Google sign-in.";
  }

  if (/invalid login credentials/i.test(message)) {
    return "Incorrect email or password. Try again or use Forgot password.";
  }

  if (/provider is not enabled/i.test(message)) {
    return "Google sign-in is not available right now. Please use email sign-in.";
  }

  return message || "Authentication failed";
};
