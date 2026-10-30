try {
  if (!process.env.HEALTHCHECK_URL)
    throw new Error("Configurá HEALTHCHECK_URL.");
  const response = await fetch(process.env.HEALTHCHECK_URL, {
    signal: AbortSignal.timeout(4000),
  });
  if (!response.ok || !(await response.json()).ok) process.exitCode = 1;
} catch {
  process.exitCode = 1;
}
