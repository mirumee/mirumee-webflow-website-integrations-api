import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { fetchJobOffers } from "@/lib/teamtailor";
import { syncJobOffersToWebflow } from "@/lib/webflow-jobs-sync";

/**
 * POST /api/sync-jobs-webhook
 *
 * Teamtailor company webhook receiver for job.create / job.update / job.destroy.
 * Verifies the TT-Signature header (v1 or v2) using TEAMTAILOR_WEBHOOK_SECRET,
 * then runs a full sync against the Webflow CMS.
 *
 * Setup in Teamtailor: Settings → Integrations → Webhooks → Add webhook
 *   URL:    https://<host>/app/api/sync-jobs-webhook
 *   Events: job.create, job.update, job.destroy
 *   Signature version: v2 (recommended) or v1
 */

const REPLAY_TOLERANCE_S = 300;

/**
 * v2: TT-Signature header is base64-encoded "t=<ts>,v2=<hmac-hex>"
 * HMAC = SHA-256(secret, "<ts>.<rawBody>")
 */
function verifyV2(rawBody: string, header: string, secret: string): boolean {
  let decoded: string;
  try {
    decoded = Buffer.from(header, "base64").toString("utf-8");
  } catch {
    return false;
  }

  const parts = decoded.split(",");
  const tsEntry = parts.find((p) => p.startsWith("t="));
  const sigEntry = parts.find((p) => p.startsWith("v2="));
  if (!tsEntry || !sigEntry) return false;

  const timestamp = tsEntry.slice(2);
  const received = sigEntry.slice(3);

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isNaN(age) || age > REPLAY_TOLERANCE_S) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  try {
    return crypto.timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * v1 (legacy): TT-Signature header is base64(hex(HMAC-SHA256(secret, resourceId)))
 * resourceId comes from payload.data.id
 */
function verifyV1(rawBody: string, header: string, secret: string): boolean {
  let resourceId: string;
  try {
    const parsed = JSON.parse(rawBody) as { payload?: { data?: { id?: unknown } } };
    resourceId = String(parsed?.payload?.data?.id ?? "");
  } catch {
    return false;
  }
  if (!resourceId) return false;

  const hmacHex = crypto.createHmac("sha256", secret).update(resourceId).digest("hex");
  const expected = Buffer.from(hmacHex).toString("base64");

  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

export const config = { api: { bodyParser: false } };

async function readRawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : (chunk as Buffer));
  }
  return Buffer.concat(chunks).toString("utf-8");
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const secret = process.env.TEAMTAILOR_WEBHOOK_SECRET?.trim();
  if (!secret) {
    console.error("sync-jobs-webhook: Missing TEAMTAILOR_WEBHOOK_SECRET");
    return res.status(500).json({ error: "Webhook not configured" });
  }

  const body = await readRawBody(req);

  // Teamtailor company webhooks use the TT-Signature header
  const sigHeader = req.headers["tt-signature"];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

  if (!sig) {
    return res.status(401).json({ error: "Missing signature" });
  }

  const valid = verifyV2(body, sig, secret) || verifyV1(body, sig, secret);
  if (!valid) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  try {
    const offers = await fetchJobOffers();
    const result = await syncJobOffersToWebflow(offers, { archiveMissing: true });
    console.log("sync-jobs-webhook: synced", result);
    return res.status(200).json({ ok: true, ...result });
  } catch (error) {
    console.error("sync-jobs-webhook error:", error);
    const message = error instanceof Error ? error.message : String(error);
    return res.status(500).json({ error: "Sync failed", details: message });
  }
}
