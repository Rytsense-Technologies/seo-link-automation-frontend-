import { describe, expect, it } from "vitest";
import { authResponse, hasValidCredentials, readAuthConfig } from "./basic-auth";

const basic = (user, password) => `Basic ${Buffer.from(`${user}:${password}`, "utf8").toString("base64")}`;
const PROTECTED = { BASIC_AUTH_USER: "reviewer", BASIC_AUTH_PASSWORD: "s3cret:with-colon", NODE_ENV: "production" };

describe("readAuthConfig", () => {
  it("is protected when both credentials are set", () => {
    expect(readAuthConfig(PROTECTED)).toEqual({ mode: "protected", user: "reviewer", password: "s3cret:with-colon" });
  });

  it("stays open in development when nothing is configured", () => {
    expect(readAuthConfig({ NODE_ENV: "development" }).mode).toBe("open");
  });

  it("never runs open in production, or with only one of the two values", () => {
    expect(readAuthConfig({ NODE_ENV: "production" }).mode).toBe("misconfigured");
    expect(readAuthConfig({ BASIC_AUTH_USER: "reviewer", NODE_ENV: "development" }).mode).toBe("misconfigured");
    expect(readAuthConfig({ BASIC_AUTH_PASSWORD: "x", NODE_ENV: "production" }).mode).toBe("misconfigured");
  });
});

describe("hasValidCredentials", () => {
  const config = { user: "reviewer", password: "s3cret:with-colon" };

  it("accepts exactly the configured user and password (passwords may contain colons)", async () => {
    expect(await hasValidCredentials(basic("reviewer", "s3cret:with-colon"), config)).toBe(true);
  });

  it.each([
    ["wrong password", basic("reviewer", "nope")],
    ["wrong user", basic("admin", "s3cret:with-colon")],
    ["empty", basic("", "")],
    ["missing header", null],
    ["not Basic", "Bearer abc"],
    ["no separator", `Basic ${Buffer.from("reviewer").toString("base64")}`],
    ["not base64", "Basic %%%"],
  ])("rejects %s", async (_, header) => {
    expect(await hasValidCredentials(header, config)).toBe(false);
  });
});

describe("authResponse", () => {
  it("challenges a request without valid credentials", async () => {
    const res = await authResponse(null, PROTECTED);
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe('Basic realm="SEO Link Automation", charset="UTF-8"');
    expect(await res.text()).not.toContain("s3cret");
  });

  it("lets a request with valid credentials through", async () => {
    expect(await authResponse(basic("reviewer", "s3cret:with-colon"), PROTECTED)).toBeNull();
  });

  it("refuses to serve an unconfigured production deployment", async () => {
    expect((await authResponse(null, { NODE_ENV: "production" })).status).toBe(503);
  });

  it("does not get in the way of local development", async () => {
    expect(await authResponse(null, { NODE_ENV: "development" })).toBeNull();
  });
});

describe("non-ASCII credentials", () => {
  it("decodes UTF-8 user names and passwords", async () => {
    const env = { BASIC_AUTH_USER: "réviseur", BASIC_AUTH_PASSWORD: "pässwörd✓", NODE_ENV: "production" };
    expect(await authResponse(basic("réviseur", "pässwörd✓"), env)).toBeNull();
    expect((await authResponse(basic("reviseur", "pässwörd✓"), env)).status).toBe(401);
  });
});
