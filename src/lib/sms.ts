import "server-only";

// Sends a "new leads assigned" SMS to a salesperson's own mobile.
//
// Indian SMS must use a DLT-registered template. Register this text (the
// {#var#} slots are the two variables we send) and put the template/flow id in
// the env vars below:
//
//   {#var#} new lead(s) assigned to you in DSPACE ERP. First: {#var#}. Please login to view.
//
//   SMS_PROVIDER     "msg91" | "fast2sms"   (unset = SMS is switched off)
//   SMS_API_KEY      MSG91 authkey, or Fast2SMS API key
//   SMS_TEMPLATE_ID  MSG91 Flow template id, or Fast2SMS DLT message id
//   SMS_SENDER_ID    Fast2SMS DLT sender id (6-char header). Not needed for MSG91.

export type LeadAlert = { phone: string; count: number; firstLead: string };

const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);

export function smsEnabled() {
  return Boolean(process.env.SMS_PROVIDER && process.env.SMS_API_KEY && process.env.SMS_TEMPLATE_ID);
}

async function sendOne(a: LeadAlert): Promise<void> {
  const provider = process.env.SMS_PROVIDER;
  const key = process.env.SMS_API_KEY!;
  const template = process.env.SMS_TEMPLATE_ID!;
  const var1 = String(a.count);
  const var2 = clip(a.firstLead || "—", 30);

  if (provider === "msg91") {
    const res = await fetch("https://control.msg91.com/api/v5/flow", {
      method: "POST",
      headers: { authkey: key, "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({ template_id: template, short_url: "0", recipients: [{ mobiles: a.phone, var1, var2 }] }),
    });
    const body = await res.text();
    if (!res.ok || /"type"\s*:\s*"error"/i.test(body)) throw new Error(`MSG91 ${res.status}: ${body.slice(0, 200)}`);
    return;
  }

  if (provider === "fast2sms") {
    const res = await fetch("https://www.fast2sms.com/dev/bulkV2", {
      method: "POST",
      headers: { authorization: key, "content-type": "application/json" },
      body: JSON.stringify({
        route: "dlt",
        sender_id: process.env.SMS_SENDER_ID || "",
        message: template,
        variables_values: `${var1}|${var2}`,
        numbers: a.phone.replace(/^91/, ""),
        flash: 0,
      }),
    });
    const j: any = await res.json().catch(() => ({}));
    if (!res.ok || j.return === false) throw new Error(`Fast2SMS ${res.status}: ${JSON.stringify(j).slice(0, 200)}`);
    return;
  }

  throw new Error(`Unknown SMS_PROVIDER "${provider}"`);
}

// One message per person. Never throws — a failed SMS must not break lead import.
export async function sendLeadAlerts(alerts: LeadAlert[]): Promise<{ sent: number; failed: number; errors: string[] }> {
  const out = { sent: 0, failed: 0, errors: [] as string[] };
  if (!smsEnabled()) return out;
  for (const a of alerts) {
    if (!a.phone) continue;
    try {
      await sendOne(a);
      out.sent++;
    } catch (e) {
      out.failed++;
      out.errors.push(e instanceof Error ? e.message : String(e));
    }
  }
  return out;
}
