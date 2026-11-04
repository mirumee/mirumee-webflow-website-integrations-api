import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/cors";
import {
  createPerson,
  createDeal,
  createNote,
  findPersonByEmail,
  isKnownSalesUser,
  attributionToDealFields,
  formatAttributionNote,
} from "@/lib/pipedrive";

const attrValue = z.string().max(500).optional().catch(undefined);

const attributionSchema = z
  .object({
    utm_source: attrValue,
    utm_medium: attrValue,
    utm_campaign: attrValue,
    utm_term: attrValue,
    utm_content: attrValue,
    gclid: attrValue,
    gbraid: attrValue,
    wbraid: attrValue,
    landing_page: attrValue,
    referrer: attrValue,
    ga_client_id: attrValue,
    ga_session_id: attrValue,
  })
  .optional()
  .catch(undefined);

const contactFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(1),
  pipedriveUserId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val != null ? String(val) : undefined)),
  attribution: attributionSchema,
});

// Cloudflare sends the visitor's city as raw UTF-8 bytes, which can reach us
// decoded as latin1 ("WrocÅ\x82aw"). Re-decode those back to UTF-8.
function getVisitorCity(req: NextApiRequest): string | undefined {
  const raw = req.headers["cf-ipcity"] ?? req.headers["x-wf-geo-city"];
  const value = (Array.isArray(raw) ? raw[0] : raw)?.trim();
  if (!value) return undefined;
  if (/[\u0080-\u00ff]/.test(value) && !/[^\u0000-\u00ff]/.test(value)) {
    const decoded = Buffer.from(value, "latin1").toString("utf8");
    if (!decoded.includes("\ufffd")) return decoded.slice(0, 100);
  }
  return value.slice(0, 100);
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse,
) {
  const origin = (req.headers.origin as string | null) ?? null;
  const corsHeaders = getCorsHeaders(origin);
  Object.entries(corsHeaders).forEach(([key, value]) =>
    res.setHeader(key, value),
  );

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const parsed = contactFormSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Invalid input" });
    }
    const data = parsed.data;

    // Only route to known salespeople; a stale or tampered ?to= falls back
    // to the default user instead of failing the deal.
    const defaultUserId = process.env.PIPEDRIVE_DEFAULT_USER_ID;
    const targetUserId = isKnownSalesUser(data.pipedriveUserId)
      ? data.pipedriveUserId
      : defaultUserId;

    if (!targetUserId) {
      return res.status(500).json({ error: "No Pipedrive user ID available" });
    }

    const city = getVisitorCity(req);
    const attribution = city ? { ...data.attribution, city } : data.attribution;

    const person =
      (await findPersonByEmail(data.email)) ??
      (await createPerson({
        name: data.name,
        email: data.email,
        phone: data.phone,
      }));

    const deal = await createDeal({
      name: data.name,
      email: data.email,
      message: city ? `${data.message}\n\nCity: ${city}` : data.message,
      userId: targetUserId,
      personId: person.id,
      customFields: attributionToDealFields(attribution),
    });

    await createNote({
      message: data.message + formatAttributionNote(attribution),
      dealId: deal.id,
      personId: person.id,
      userId: targetUserId,
    });

    return res.status(201).json({ message: "success", dealId: deal.id });
  } catch (error) {
    console.error("submit-contact-form error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
