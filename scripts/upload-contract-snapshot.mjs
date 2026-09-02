import { readFile } from "node:fs/promises";

const url = process.env.KYLON_CONTRACT_SNAPSHOT_URL;
const token = process.env.KYLON_CONTRACT_SNAPSHOT_TOKEN;
const MAX_ERROR_DETAIL_LENGTH = 2_000;

function errorDetails(responseBody, response) {
  let message = responseBody.trim();
  let requestId = response.headers.get("x-request-id");
  if (message) {
    try {
      const parsed = JSON.parse(message);
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.message === "string") message = parsed.message;
        else if (typeof parsed.error === "string") message = parsed.error;
        if (typeof parsed.requestId === "string") requestId ??= parsed.requestId;
      }
    } catch {
      // Preserve non-JSON response text for diagnostics.
    }
  }
  const details = [];
  if (message) details.push(message.replace(/\s+/g, " ").slice(0, MAX_ERROR_DETAIL_LENGTH));
  if (requestId) details.push(`request_id=${requestId}`);
  return details.length > 0 ? `: ${details.join(" · ")}` : "";
}

if (url || token) {
  if (!url || !token) throw new Error("Contract snapshot upload configuration is incomplete.");
  const registration = await readFile(
    new URL("../generated/app-registration.json", import.meta.url),
    "utf8",
  );
  let response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: registration,
      signal: AbortSignal.timeout(30_000),
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new Error(`Contract snapshot upload request failed: ${reason}`, { cause: error });
  }
  if (!response.ok) {
    const responseBody = await response.text();
    throw new Error(
      `Contract snapshot upload failed (${response.status})${errorDetails(responseBody, response)}`,
    );
  }
  console.log("Contract snapshot uploaded.");
}
