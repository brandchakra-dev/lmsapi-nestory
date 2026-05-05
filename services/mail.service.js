const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ─── Verify connection on startup ─────────────────────────────────────────────
transporter.verify((err) => {
  if (err) console.error("Mail transporter error:", err.message);
  else     console.log("Mail transporter ready — Hostinger mail connected");
});

// ─── Helper: details object → HTML table rows ─────────────────────────────────
const detailRows = (details) => {
  if (!details || typeof details !== "object") return "";
  return Object.entries(details)
    .filter(([, v]) => v)
    .map(([k, v], i) => `
      <tr style="background:${i % 2 === 0 ? "#f9f9f9" : "#fff"}">
        <td style="padding:8px 14px;color:#888;font-size:13px;white-space:nowrap">${k}</td>
        <td style="padding:8px 14px;font-size:13px">${v}</td>
      </tr>`)
    .join("");
};

// ─── Admin email ──────────────────────────────────────────────────────────────
exports.sendLeadEmailToAdmin = async (lead) => {
  try {
    await transporter.sendMail({
      from:    `"The Nestory LMS" <${process.env.SMTP_USER === "info@thenestory.in"
                 ? process.env.ADMIN_EMAIL
                 : process.env.SMTP_USER}>`,
      to:      process.env.ADMIN_EMAIL,
      subject: `New Lead — ${lead.name} | ${lead.phone}`,
      html: `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Arial,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0">
  <tr><td align="center" style="padding:32px 16px">
    <table width="560" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08)">

      <!-- Header -->
      <tr>
        <td style="background:#1a1a2e;padding:24px 28px">
          <p style="margin:0;font-size:11px;color:#888;letter-spacing:1px;text-transform:uppercase">The Nestory LMS</p>
          <h1 style="margin:6px 0 0;color:#fff;font-size:20px;font-weight:600">New Facebook Lead</h1>
        </td>
      </tr>

      <!-- Lead info table -->
      <tr><td style="padding:24px 28px 8px">
        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #eee;border-radius:8px;overflow:hidden">
          <tr style="background:#f9f9f9">
            <td style="padding:8px 14px;color:#888;font-size:13px;white-space:nowrap">Name</td>
            <td style="padding:8px 14px;font-size:13px;font-weight:600">${lead.name}</td>
          </tr>
          <tr style="background:#fff">
            <td style="padding:8px 14px;color:#888;font-size:13px">Phone</td>
            <td style="padding:8px 14px;font-size:13px">
              <a href="tel:+91${lead.phone}" style="color:#1a1a2e;text-decoration:none;font-weight:600">${lead.phone}</a>
            </td>
          </tr>
          <tr style="background:#f9f9f9">
            <td style="padding:8px 14px;color:#888;font-size:13px">Email</td>
            <td style="padding:8px 14px;font-size:13px">${lead.email || "—"}</td>
          </tr>
          <tr style="background:#fff">
            <td style="padding:8px 14px;color:#888;font-size:13px">Ad name</td>
            <td style="padding:8px 14px;font-size:13px">${lead.fbAdName || "—"}</td>
          </tr>
          <tr style="background:#f9f9f9">
            <td style="padding:8px 14px;color:#888;font-size:13px">Adset</td>
            <td style="padding:8px 14px;font-size:13px">${lead.fbAdsetName || "—"}</td>
          </tr>
          <tr style="background:#fff">
            <td style="padding:8px 14px;color:#888;font-size:13px">Assigned to</td>
            <td style="padding:8px 14px;font-size:13px">${lead.assignedManagerName || "—"}</td>
          </tr>
          ${detailRows(lead.details)}
        </table>
      </td></tr>

      <!-- Timestamp -->
      <tr><td style="padding:16px 28px">
        <p style="margin:0;font-size:12px;color:#aaa;border-left:3px solid #1a1a2e;padding-left:10px">
          Received at ${new Date().toLocaleString("en-IN", {
            timeZone:     "Asia/Kolkata",
            day:          "2-digit",
            month:        "short",
            year:         "numeric",
            hour:         "2-digit",
            minute:       "2-digit",
          })} IST
        </p>
      </td></tr>

      <!-- Footer -->
      <tr>
        <td style="background:#f9f9f9;padding:16px 28px;border-top:1px solid #eee">
          <p style="margin:0;font-size:11px;color:#bbb;text-align:center">
            The Nestory LMS — Automated notification. Do not reply.
          </p>
        </td>
      </tr>

    </table>
  </td></tr>
</table>
</body>
</html>`,
    });

    console.log("Admin email sent →", process.env.ADMIN_EMAIL);
  } catch (err) {
    console.error("Admin email failed:", err.message);
  }
};