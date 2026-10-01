export function localWorkerEnabled() {
  if (process.env.VERCEL || process.env.LOCAL_WORKER_ENABLED !== "1")
    return false;
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(
      new URL(process.env.APP_ORIGIN ?? "").hostname,
    );
  } catch {
    return false;
  }
}
