// "Have a problem?" messages go to the developer's inbox through FormSubmit (formsubmit.co),
// a form-to-email relay: no account and no server of ours. The first message ever sent triggers a
// one-time activation email to the address below; after that, messages arrive normally.
// The API key is never included.

export const DEVELOPER_EMAIL = "daniel.idemudia08@gmail.com";
export const FEEDBACK_ENDPOINT = `https://formsubmit.co/ajax/${DEVELOPER_EMAIL}`;
export const APP_VERSION = "v2";

export type Feedback = { topic: string; message: string; replyTo?: string };

export async function sendFeedback(f: Feedback): Promise<void> {
  const body = {
    _subject: `Thinka's AQM Prep: ${f.topic}`,
    _template: "table",
    _captcha: "false",
    _honey: "",
    Topic: f.topic,
    Message: f.message.slice(0, 5000),
    "Reply to": f.replyTo?.trim() || "(not given)",
    Page: location.hash || "#/",
    Browser: navigator.userAgent.slice(0, 200),
    Version: APP_VERSION,
    ...(f.replyTo?.trim() ? { _replyto: f.replyTo.trim() } : {}),
  };
  let res: Response;
  try {
    res = await fetch(FEEDBACK_ENDPOINT, {
      method: "POST",
      // FormSubmit identifies the sending website from the Referer header and refuses requests
      // without one. The site's policy is no-referrer, so this one request sends just the origin.
      referrerPolicy: "origin",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error("Couldn't reach the message service. Check your connection, or email the developer directly.");
  }
  const data = (await res.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
  if (!res.ok || data.success === "false" || data.success === false) {
    throw new Error(data.message || `The message service returned an error (${res.status}).`);
  }
}

export function mailtoFallback(f: Feedback): string {
  const body = `${f.message}\n\n---\nPage: ${location.hash || "#/"}\nVersion: ${APP_VERSION}`;
  return `mailto:${DEVELOPER_EMAIL}?subject=${encodeURIComponent(`Thinka's AQM Prep: ${f.topic}`)}&body=${encodeURIComponent(body)}`;
}
