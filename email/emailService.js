const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

function money(centavos) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(centavos || 0) / 100);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function receiptEmail(order) {
  const rows = (order.items || []).map(item => {
    const quantity = Number(item.quantity || 1);
    const amount = Number(item.amount || 0) * quantity;

    return `
      <tr>
        <td style="padding:9px;border-bottom:1px solid #e5e5e5;">
          ${escapeHtml(item.name)}
        </td>
        <td style="padding:9px;text-align:center;border-bottom:1px solid #e5e5e5;">
          ${quantity}
        </td>
        <td style="padding:9px;text-align:right;border-bottom:1px solid #e5e5e5;">
          ${money(amount)}
        </td>
      </tr>`;
  }).join("");

  const text = `
EDUMART
OFFICIAL ELECTRONIC RECEIPT

Receipt Number: ${order.receiptNumber}
Order Number: ${order.orderId}
Date: ${new Date(order.paidAt).toLocaleString("en-PH")}
Customer: ${order.customerName}
Email: ${order.customerEmail}

PAYMENT STATUS: PAID
Payment Reference: ${order.paymentId || "N/A"}

TOTAL PAID: ${money(order.amount)}

Please present the QR code attached to this receipt when claiming your order.

QR Verification:
${order.qrUrl}

EDUMART Team
`.trim();

  const html = `
<!doctype html>
<html>
<body style="margin:0;background:#f4f6f9;font-family:Arial,sans-serif;color:#222;">
  <div style="max-width:680px;margin:28px auto;background:#fff;border-radius:14px;overflow:hidden;">
    <div style="background:#0b5ed7;color:#fff;padding:26px;">
      <h1 style="margin:0;letter-spacing:1px;">EDUMART</h1>
      <p style="margin:6px 0 0;">OFFICIAL ELECTRONIC RECEIPT</p>
    </div>

    <div style="padding:28px;">
      <div style="border-bottom:1px solid #ddd;padding-bottom:18px;">
        <h2 style="margin:0 0 15px;">Payment Receipt</h2>
        <p><strong>Receipt Number:</strong> ${escapeHtml(order.receiptNumber)}</p>
        <p><strong>Order Number:</strong> ${escapeHtml(order.orderId)}</p>
        <p><strong>Assigned Locker:</strong> ${escapeHtml(order.lockerId || "N/A")}</p>
        <p><strong>Date:</strong> ${escapeHtml(new Date(order.paidAt).toLocaleString("en-PH"))}</p>
        <p><strong>Customer:</strong> ${escapeHtml(order.customerName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(order.customerEmail)}</p>
      </div>

      <div style="margin:22px 0;background:#d1e7dd;color:#0f5132;padding:13px;border-radius:8px;">
        <strong>✓ PAYMENT STATUS: PAID</strong><br>
        Payment Reference: ${escapeHtml(order.paymentId || "N/A")}
      </div>

      <h3>Order Details</h3>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;padding:9px;">Item</th>
            <th style="padding:9px;">Qty</th>
            <th style="text-align:right;padding:9px;">Amount</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="text-align:right;font-size:21px;font-weight:bold;margin-top:20px;">
        TOTAL PAID: ${money(order.amount)}
      </div>

      <div style="text-align:center;margin:35px 0;">
        <h3>ORDER CLAIM QR CODE</h3>
        <img src="cid:receipt-qr"
             alt="EDUMART receipt claim QR code"
             style="width:300px;height:300px;">
        <p style="font-size:13px;color:#666;">
          Present this QR code when claiming your order.
        </p>
      </div>

      <div style="background:#fff3cd;padding:15px;border-radius:8px;font-size:13px;">
        <strong>Important:</strong>
        This QR code is unique to this receipt and order.
        Do not share it with another person.
      </div>

      <p style="margin-top:25px;">
        Thank you for using <strong>EDUMART</strong>.
      </p>
    </div>
  </div>
</body>
</html>`;

  return {
    subject: `EDUMART Official Receipt — ${order.receiptNumber}`,
    text,
    html
  };
}

async function sendReceiptEmail(order, qrBuffer) {
  const email = receiptEmail(order);
  const recipients = [
    order.customerEmail,
    process.env.ADMIN_EMAIL || process.env.SMTP_USER
  ].filter(Boolean);

  const info = await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: [...new Set(recipients)],
    subject: email.subject,
    text: email.text,
    html: email.html,
    attachments: [{
      filename: `${order.receiptNumber}-QR.png`,
      content: qrBuffer,
      cid: "receipt-qr"
    }]
  });

  return info;
}

module.exports = { sendReceiptEmail, receiptEmail };
