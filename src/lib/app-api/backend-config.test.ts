import { describe, expect, it } from "vitest";
import { BackendConfigError, backendUrl, readBackendConfig } from "./backend-config";

const env = (values: Record<string, string>) => values as unknown as NodeJS.ProcessEnv;

describe("readBackendConfig", () => {
  it("reads the URL and strips trailing slashes", () => {
    expect(readBackendConfig(env({ BACKEND_API_URL: "http://127.0.0.1:8000/" })).baseUrl).toBe("http://127.0.0.1:8000");
  });

  it("treats a missing or blank API key as no key", () => {
    expect(readBackendConfig(env({ BACKEND_API_URL: "http://127.0.0.1:8000" })).apiKey).toBeNull();
    expect(readBackendConfig(env({ BACKEND_API_URL: "http://127.0.0.1:8000", BACKEND_API_KEY: "  " })).apiKey).toBeNull();
    expect(readBackendConfig(env({ BACKEND_API_URL: "http://127.0.0.1:8000", BACKEND_API_KEY: "secret" })).apiKey).toBe("secret");
  });

  it("rejects a missing or unusable URL", () => {
    expect(() => readBackendConfig(env({}))).toThrow(BackendConfigError);
    expect(() => readBackendConfig(env({ BACKEND_API_URL: "not-a-url" }))).toThrow(BackendConfigError);
    expect(() => readBackendConfig(env({ BACKEND_API_URL: "file:///etc/passwd" }))).toThrow(BackendConfigError);
  });
});

describe("backendUrl", () => {
  const config = { baseUrl: "http://127.0.0.1:8000", apiKey: null };

  it("builds absolute backend URLs and keeps the query string", () => {
    expect(backendUrl(config, "/api/interlink/suggestions")).toBe("http://127.0.0.1:8000/api/interlink/suggestions");
    expect(backendUrl(config, "api/sites")).toBe("http://127.0.0.1:8000/api/sites");
    expect(backendUrl(config, "/api/interlink/suggestions", "?status=PENDING&page=2")).toBe(
      "http://127.0.0.1:8000/api/interlink/suggestions?status=PENDING&page=2",
    );
  });
});
