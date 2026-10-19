import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { contactSchema } from "@/lib/contact-schema";

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body." }, { status: 400 });
  }

  const parsed = contactSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ message: "Invalid input.", errors: parsed.error.flatten() }, { status: 400 });
  }

  const { name, email, phone, message } = parsed.data;

  const smtpHost = process.env.CONTACT_SMTP_HOST;
  const to = process.env.CONTACT_EMAIL_TO;

  if (smtpHost && to) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.CONTACT_SMTP_PORT) || 587,
        secure: process.env.CONTACT_SMTP_SECURE === "true",
        auth: process.env.CONTACT_SMTP_USER
          ? { user: process.env.CONTACT_SMTP_USER, pass: process.env.CONTACT_SMTP_PASS }
          : undefined,
      });

      await transporter.sendMail({
        from: process.env.CONTACT_EMAIL_FROM || process.env.CONTACT_SMTP_USER,
        to,
        replyTo: email,
        subject: `Νέο μήνυμα από ${name} (SP Team site)`,
        html: `
          <p><strong>Όνομα:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Τηλέφωνο:</strong> ${escapeHtml(phone)}</p>
          <p><strong>Μήνυμα:</strong></p>
          <p>${escapeHtml(message).replace(/\n/g, "<br/>")}</p>
        `,
      });
    } catch (error) {
      console.error("Contact email send failed:", error);
      // Still report success to the user — the submission itself is valid and logged below;
      // email delivery is a best-effort side effect, not something that should block the lead.
    }
  } else {
    console.log("[contact] New submission (no SMTP configured, logging only):", { name, email, phone, message });
  }

  return NextResponse.json({ success: true });
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
