// Pluggable e-mail delivery. Defaults to "console" which simply logs the magic
// link to the server output — perfect for local dev and demos. Set
// EMAIL_PROVIDER=resend (+ RESEND_API_KEY) to send real e-mails.

interface MagicLinkEmail {
  to: string;
  url: string;
}

const FROM = process.env.EMAIL_FROM || "GTM Tool <gtm@oss.ventures>";

export async function sendMagicLinkEmail({ to, url }: MagicLinkEmail): Promise<void> {
  const provider = (process.env.EMAIL_PROVIDER || "console").toLowerCase();

  if (provider === "resend") {
    await sendViaResend(to, url);
    return;
  }

  // console (default)
  console.log(
    `\n========================== MAGIC LINK ==========================\n` +
      `To: ${to}\n` +
      `Sign-in link (valid 15 min):\n${url}\n` +
      `================================================================\n`
  );
}

async function sendViaResend(to: string, url: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("EMAIL_PROVIDER=resend but RESEND_API_KEY is not set");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: FROM,
      to,
      subject: "Your sign-in link — OSS GTM Tool",
      html: magicLinkHtml(url),
      text: `Sign in to the OSS GTM Tool:\n${url}\n\nThis link expires in 15 minutes.`,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend error ${res.status}: ${body}`);
  }
}

function magicLinkHtml(url: string): string {
  return `
  <div style="font-family: ui-sans-serif, system-ui, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
    <h2 style="color:#312e81; margin-bottom: 8px;">OSS GTM Tool</h2>
    <p style="color:#334155;">Click the button below to sign in. This link is valid for 15 minutes and can be used once.</p>
    <p style="margin: 24px 0;">
      <a href="${url}" style="background:#4f46e5; color:#fff; text-decoration:none; padding:12px 20px; border-radius:8px; display:inline-block;">Sign in</a>
    </p>
    <p style="color:#94a3b8; font-size:12px;">If you didn't request this, you can safely ignore this e-mail.</p>
  </div>`;
}
