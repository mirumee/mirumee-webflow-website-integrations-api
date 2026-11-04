import type { NextApiRequest, NextApiResponse } from "next";
import { getCorsHeaders } from "@/lib/cors";
import {
  fetchUser,
  isKnownSalesUser,
  CALENDAR_LINKS,
  DEFAULT_CALENDAR_LINK,
} from "@/lib/pipedrive";

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

  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const userId = req.query.userId as string | undefined;
    const defaultUserId = process.env.PIPEDRIVE_DEFAULT_USER_ID;

    const targetId = isKnownSalesUser(userId) ? userId : defaultUserId;
    if (!targetId) {
      return res
        .status(400)
        .json({ error: "No userId provided and no default configured" });
    }

    const user = await fetchUser(targetId);

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const calendarLink =
      CALENDAR_LINKS[String(user.id)] ?? DEFAULT_CALENDAR_LINK;

    return res.status(200).json({
      id: user.id,
      name: user.name,
      icon_url: user.icon_url,
      calendar_link: calendarLink,
    });
  } catch (error) {
    console.error("get-pipedrive-user error:", error);
    return res.status(500).json({ error: "Internal server error" });
  }
}
