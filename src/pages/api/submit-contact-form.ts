import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { getCorsHeaders } from "@/lib/cors";
import { createPerson, createDeal, createNote } from "@/lib/pipedrive";
import { appendContactToSheet } from "@/lib/google-sheets";

const DEFAULT_PIPEDRIVE_USER_ID = "24022103";

const contactFormSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  message: z.string().min(1),
  pipedriveUserId: z
    .union([z.string(), z.number()])
    .optional()
    .transform((val) => (val != null ? String(val) : undefined)),
});

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
    const data = contactFormSchema.parse(body);

    if (data.email.toLowerCase().endsWith("@gmail.com")) {
      await appendContactToSheet(data);
      return res.status(201).json({ message: "success" });
    }

    const defaultUserId = DEFAULT_PIPEDRIVE_USER_ID;
    const targetUserId = data.pipedriveUserId || defaultUserId;

    if (!targetUserId) {
      return res.status(500).json({ error: "No Pipedrive user ID available" });
    }

    const person = await createPerson({
      name: data.name,
      email: data.email,
      phone: data.phone,
    });

    const deal = await createDeal({
      name: data.name,
      email: data.email,
      message: data.message,
      userId: targetUserId,
      personId: person.id,
    });

    await createNote({
      message: data.message,
      dealId: deal.id,
      personId: person.id,
      userId: targetUserId,
    });

    return res.status(201).json({ message: "success" });
  } catch (error) {
    console.error("submit-contact-form error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
