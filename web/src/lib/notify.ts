// Notification wording lives here so seed data and live sends match exactly.
// Notifications never contain report or incident details: only "ready" + where to read it.
export function reportNotifications(parent: { id: number; name: string }, childFirst: string, reportId: number) {
  const first = parent.name.split(" ")[0];
  return [
    { parentId: parent.id, channel: "whatsapp" as const, kind: "daily_report" as const, recordId: reportId,
      title: "Sunny Days Childcare",
      body: `Hi ${first} 👋 Today's report for ${childFirst} has been sent. Open the Littlelog app to check it.` },
    { parentId: parent.id, channel: "email" as const, kind: "daily_report" as const, recordId: reportId,
      title: `${childFirst}'s daily report is ready`,
      body: `Hi ${first}, ${childFirst}'s daily report from Sunny Days Childcare is ready. Tap "View report" to read it in Littlelog.` },
    { parentId: parent.id, channel: "push" as const, kind: "daily_report" as const, recordId: reportId,
      title: "Littlelog", body: `${childFirst}'s report for today is ready 😊` },
  ];
}

export function incidentNotifications(parent: { id: number; name: string }, childFirst: string, incidentId: number) {
  const first = parent.name.split(" ")[0];
  return [
    { parentId: parent.id, channel: "whatsapp" as const, kind: "incident" as const, recordId: incidentId,
      title: "Sunny Days Childcare",
      body: `Hi ${first}, an incident report about ${childFirst} is ready for you to read in the Littlelog app.` },
    { parentId: parent.id, channel: "email" as const, kind: "incident" as const, recordId: incidentId,
      title: `Incident report for ${childFirst}`,
      body: `Hi ${first}, an incident report about ${childFirst} has been approved by the director. Please read it in Littlelog.` },
    { parentId: parent.id, channel: "push" as const, kind: "incident" as const, recordId: incidentId,
      title: "Littlelog", body: `New incident report for ${childFirst}` },
  ];
}

type ChannelRules = { notifyWhatsapp: boolean; notifyEmail: boolean; notifyPush: boolean };
/** Keep only the channels the center has switched on, and WhatsApp only for parents who opted in. */
export function allowedFor<T extends { channel: "whatsapp" | "email" | "push" }>(
  items: T[], center: ChannelRules, parent: { whatsappOptIn: boolean },
) {
  return items.filter((n) =>
    n.channel === "whatsapp" ? center.notifyWhatsapp && parent.whatsappOptIn
      : n.channel === "email" ? center.notifyEmail
      : center.notifyPush);
}
