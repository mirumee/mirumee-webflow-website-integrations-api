import type { NextApiRequest, NextApiResponse } from "next";
import crypto from "crypto";
import { fetchJobOffers } from "@/lib/teamtailor";
import { syncJobOffersToWebflow } from "@/lib/webflow-jobs-sync";

/**
 * POST /api/sync-jobs-webhook
 *
 * Teamtailor webhook receiver for job.create / job.update / job.destroy events.
 * Verifies the `Teamtailor-Signature` header using TEAMTAILOR_WEBHOOK_SECRET,
 * then runs a full sync (same as /api/sync-jobs with archiving enabled).
 *
 * Setup in Teamtailor: Settings → Webhooks → Add webhook
 *   URL: https://<host>/app/api/sync-jobs-webhook
 *   Events: job.create, job.update, job.destroy
 */

const REPLAY_TOLERANCE_S = 300;

function verifySignature(payload: string, header: string, secret: string): boolean {
  const parts = header.split(",");
  const tsEntry = parts.find((p) => p.startsWith("t="));
  const sigEntry = parts.find((p) => p.startsWith("v1="));
  if (!tsEntry || !sigEntry) return false;

  const timestamp = tsEntry.slice(2);
  const signature = sigEntry.slice(3);

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (Number.isNaN(age) || age > REPLAY_TOLERANCE_S) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export const config = { api: { bodyParser: false } };

async function rawBody(req: NextApiRequest): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(typeof chunk === "string" ? Buffer.from(chunk) : chunk);
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

  const body = await rawBody(req);
  const sigHeader = req.headers["teamtailor-signature"];
  const sig = Array.isArray(sigHeader) ? sigHeader[0] : sigHeader;

  if (!sig || !verifySignature(body, sig, secret)) {
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
