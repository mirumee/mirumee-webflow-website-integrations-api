import type { NextApiRequest, NextApiResponse } from "next";
import { getCorsHeaders } from "@/lib/cors";
import { fetchUser } from "@/lib/pipedrive";

const CALENDAR_LINKS: Record<string, string> = {
  "24022103": "https://calendar.app.google/UKzornFSVfqTjpjH6",
  "17062690": "https://calendar.app.google/fF41H84PgsiTZ2Jm8",
  "25079049": "https://calendar.app.google/L3fY4xaEJ9C3RzFq5",
};

const DEFAULT_CALENDAR_LINK = "https://calendar.app.google/j9UF6htRL44FCMKL9";

const DEFAULT_PIPEDRIVE_USER_ID = "24022103";

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
    const defaultUserId = DEFAULT_PIPEDRIVE_USER_ID;

    const targetId = userId || defaultUserId;
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
