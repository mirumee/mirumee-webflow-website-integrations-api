import type { NextApiRequest, NextApiResponse } from "next";

const CALENDAR_LINKS: Record<string, string> = {
  "24022103": "https://calendar.app.google/UKzornFSVfqTjpjH6",
  "17062690": "https://calendar.app.google/fF41H84PgsiTZ2Jm8",
  "25079049": "https://calendar.app.google/L3fY4xaEJ9C3RzFq5",
};

const DEFAULT_CALENDAR_LINK = "https://calendar.app.google/UKzornFSVfqTjpjH6";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { to } = req.query;
  const userId = typeof to === "string" ? to : undefined;
  const calendarUrl =
    (userId && CALENDAR_LINKS[userId]) || DEFAULT_CALENDAR_LINK;

  res.redirect(302, calendarUrl);
}
