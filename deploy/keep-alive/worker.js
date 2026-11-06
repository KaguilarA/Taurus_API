// Infrastructure only: no business data, authentication, or database access.
export async function checkBackend(env, request = fetch) {
  const origin = new URL(env.BACKEND_ORIGIN);
  if (
    origin.protocol !== "https:" ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash ||
    origin.username ||
    origin.password
  ) {
    throw new Error("Invalid backend origin");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 60000);
  const started = Date.now();
  try {
    const response = await request(new URL("/api/health", origin), {
      headers: {
        Accept: "application/json",
        "User-Agent": "Taurus-Backend-Health/1.0",
      },
        redirect: "manual",
      signal: controller.signal,
    });
    if (
      !response.ok ||
      !response.headers.get("content-type")?.includes("application/json")
    ) {
      await response.body?.cancel();
      throw new Error(`Backend health HTTP ${response.status}`);
    }
    const data = await response.json();
    if (data.ok !== true) throw new Error("Backend health is not ready");
    return { ok: true, durationMs: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

export default {
  async scheduled(controller, env) {
    const result = await checkBackend(env);
    console.log(JSON.stringify({ event: "backend-health", ...result }));
  },
  fetch() {
    return new Response("Not found", { status: 404 });
  },
};
