import type { NextApiRequest, NextApiResponse } from "next";
import {
  CALENDAR_LINKS,
  DEFAULT_CALENDAR_LINK,
  isKnownSalesUser,
} from "@/lib/pipedrive";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const { to } = req.query;
  const userId = typeof to === "string" ? to : undefined;
  const calendarUrl = isKnownSalesUser(userId)
    ? CALENDAR_LINKS[userId]
    : DEFAULT_CALENDAR_LINK;

  res.redirect(302, calendarUrl);
}
