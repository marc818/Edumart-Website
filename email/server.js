require("dotenv").config();

const express = require("express");
const crypto = require("crypto");

const {
  createOrder,
  getOrder,
  updateOrder,
  getLockerSnapshot,
  secureLockerForPaidOrder
} = require("./orderStore");

const {
  makeReceiptNumber,
  makeClaimToken,
  makeReceiptQR
} = require("./receiptService");

const { sendReceiptEmail } = require("./emailService");
const { validateRetrieval, consumeRetrieval } = require("./lockerService");

const app = express();
const PORT = Number(process.env.EMAIL_PORT || 3001);

function verifyPayMongoSignature(rawBody, signatureHeader) {
  const secret = process.env.PAYMONGO_WEBHOOK_SECRET;
  if (!secret) return process.env.ALLOW_UNVERIFIED_WEBHOOKS === "true";
  if (!signatureHeader) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(",").map((part) => part.split("=", 2))
  );
  const timestamp = parts.t;
  const signature = parts[process.env.PAYMONGO_LIVEMODE === "true" ? "li" : "te"];
  if (!timestamp || !signature) return false;

  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${timestamp}.${rawBody}`)
    .digest("hex");

  const expectedBuffer = Buffer.from(expected);
  const signatureBuffer = Buffer.from(signature);
  return expectedBuffer.length === signatureBuffer.length &&
    crypto.timingSafeEqual(expectedBuffer, signatureBuffer);
}

function findPaymentData(value) {
  if (!value || typeof value !== "object") return null;
  if (value.metadata?.order_id || value.reference_number) return value;
  for (const child of Object.values(value)) {
    const result = findPaymentData(child);
    if (result) return result;
  }
  return null;
}

app.post(
  "/webhooks/paymongo",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    const rawBody = req.body.toString("utf8");

    if (!verifyPayMongoSignature(rawBody, req.get("Paymongo-Signature"))) {
      return res.status(401).json({ success: false, error: "Invalid webhook signature." });
    }

    try {
      const payload = JSON.parse(rawBody);
      const eventType = payload?.data?.attributes?.type || payload?.type || "";
      if (!eventType.toLowerCase().includes("paid")) {
        return res.json({ received: true, ignored: true });
      }

      const paymentData = findPaymentData(payload);
      const orderId = paymentData?.metadata?.order_id || paymentData?.reference_number;
      const paymentId = paymentData?.id || payload?.data?.id || `PAYMONGO-${Date.now()}`;

      if (!orderId) {
        return res.status(400).json({ success: false, error: "Webhook did not contain an order ID." });
      }

      const order = await completePaidOrder(orderId, paymentId);
      return res.json({ success: true, orderId: order.orderId });
    } catch (error) {
      console.error("PayMongo webhook error:", error);
      return res.status(400).json({ success: false, error: error.message });
    }
  }
);

/*
 * DEMO ORDER
 * Creates an unpaid order.
 */
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ service: "receipt", status: "ok" });
});

/*
 * Locker availability for the dashboards. Includes buyer details, so only the main server
 * (which filters it per role) may call it, using the shared INTERNAL_API_KEY.
 */
app.get("/lockers/status", (req, res) => {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    return res.status(503).json({ success: false, error: "INTERNAL_API_KEY is not configured on the receipt service." });
  }
  const given = Buffer.from(req.get("x-internal-key") || "");
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
    return res.status(401).json({ success: false, error: "Invalid internal key." });
  }
  return res.json({ success: true, lockers: getLockerSnapshot() });
});



app.post("/locker/retrieve", (req, res) => {
  const { orderId, claimToken, buyerEmail, lockerId } = req.body || {};
  const order = getOrder(orderId);
  const validation = validateRetrieval(order, { orderId, claimToken, buyerEmail, lockerId });

  if (!validation.valid) {
    const status = validation.code === "ORDER_NOT_FOUND" ? 404 : 409;
    return res.status(status).json({
      success: false,
      lockerOpened: false,
      code: validation.code,
      message: "QR retrieval validation failed."
    });
  }

  const result = consumeRetrieval(order, { orderId, claimToken, buyerEmail, lockerId });
  updateOrder(orderId, order);

  return res.json({
    success: true,
    lockerOpened: true,
    orderId: result.orderId,
    lockerId: result.lockerId,
    retrievedAt: result.retrievedAt
  });
});

app.post("/orders", (req, res) => {
  const { orderId, customerName, customerEmail, buyerStudentId, amount, items } = req.body;

  if (!orderId || !customerEmail || !Number.isFinite(Number(amount))) {
    return res.status(400).json({ success: false, error: "Invalid order data." });
  }

  const existing = getOrder(orderId);
  if (existing) {
    return res.json({ success: true, order: existing, existing: true });
  }

  const order = createOrder({
    orderId,
    customerName: customerName || customerEmail,
    customerEmail,
    buyerStudentId: buyerStudentId ? Number(buyerStudentId) : null,
    amount: Number(amount),
    items: Array.isArray(items) ? items : []
  });

  return res.json({ success: true, order });
});

app.post("/demo/create-order", (req, res) => {
  if (process.env.ALLOW_DEMO_PAYMENT !== "true") {
    return res.status(403).json({
      success: false,
      error: "Demo mode is disabled."
    });
  }

  const {
    orderId,
    customerName,
    customerEmail,
    amount,
    items
  } = req.body;

  if (!orderId || !customerName || !customerEmail || !amount) {
    return res.status(400).json({
      success: false,
      error: "orderId, customerName, customerEmail and amount are required."
    });
  }

  const order = createOrder({
    orderId,
    customerName,
    customerEmail,
    amount: Number(amount),
    items: Array.isArray(items) ? items : []
  });

  res.json({ success: true, order });
});

/*
 * DEMO PAYMENT SUCCESS
 * This simulates a verified PayMongo successful payment.
 *
 * Do NOT use this endpoint for production payment confirmation.
 */
app.post("/demo/payment-success/:orderId", async (req, res) => {
  if (process.env.ALLOW_DEMO_PAYMENT !== "true") {
    return res.status(403).json({
      success: false,
      error: "Demo mode is disabled."
    });
  }

  try {
    const result = await completePaidOrder(
      req.params.orderId,
      "DEMO-PAYMENT-" + crypto.randomBytes(8).toString("hex")
    );

    res.json({
      success: true,
      message: "Payment simulated. Receipt and QR generated.",
      order: result
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message
    });
  }
});

function receiptStatus(req, res) {
  const order = getOrder(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      found: false,
      receiptReady: false,
      message: "Order not found."
    });
  }

  const receiptReady = Boolean(
    order.receiptNumber && order.claimToken && order.qrUrl
  );

  return res.json(receiptReady ? {
    found: true,
    receiptReady: true,
    orderId: order.orderId,
    receiptNumber: order.receiptNumber,
    paymentStatus: order.paymentStatus,
    paymentId: order.paymentId,
    qrUrl: order.qrUrl,
    buyerName: order.customerName,
    buyerEmail: order.customerEmail,
    total: Number(order.amount || 0) / 100
  } : {
    found: true,
    receiptReady: false,
    paymentStatus: order.paymentStatus
  });
}

app.get("/api/receipt-status/:orderId", receiptStatus);
app.get("/api/orders/:orderId/receipt-status", receiptStatus);

app.get("/receipt/preview/:orderId", async (req, res) => {
  const order = getOrder(req.params.orderId);

  if (!order) {
    return res.status(404).send("<h1>Receipt not found</h1><p>This order does not exist.</p>");
  }

  if (order.paymentStatus !== "PAID" || !order.claimToken) {
    return res.status(202).send(`
      <!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment Processing</title></head>
      <body style="font-family:Arial,sans-serif;padding:32px"><h1>Payment received</h1><p>Your receipt is still being generated. Please refresh this page in a moment.</p><script>
        async function checkReceipt(orderId) {
          try {
            const response = await fetch('/api/receipt-status/' + encodeURIComponent(orderId));
            const data = await response.json();

            if (data.receiptReady) {
              clearInterval(receiptChecker);
              window.location.href = '/receipt/preview/' + encodeURIComponent(orderId);
            }
          } catch (error) {
            console.error('Receipt status check failed:', error);
          }
        }

        const receiptChecker = setInterval(() => {
          checkReceipt(${JSON.stringify(req.params.orderId)});
        }, 3000);
      </script></body></html>
    `);
  }

  const { qrBuffer } = await makeReceiptQR(order.orderId, order.claimToken);
  const qrImage = `data:image/png;base64,${qrBuffer.toString("base64")}`;
  const rows = order.items.map((item) => `
    <tr><td>${escapeHtml(item.name)}</td><td>${Number(item.quantity || 1)}</td><td>${money(item.amount * Number(item.quantity || 1))}</td></tr>
  `).join("");

  return res.send(`
<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>EDUMART Official Receipt</title>
<style>body{margin:0;background:#eef1f5;font-family:Arial,sans-serif;color:#222}header{background:#0b5ed7;color:#fff;padding:22px}main{max-width:900px;margin:24px auto;padding:0 16px}.receipt{border:1px solid #ddd;border-radius:10px;overflow:hidden;background:#fff}.top{background:#0b5ed7;color:#fff;padding:24px}.body{padding:26px}table{width:100%;border-collapse:collapse}td,th{padding:9px;border-bottom:1px solid #eee;text-align:left}td:nth-child(2),th:nth-child(2){text-align:center}td:last-child,th:last-child{text-align:right}.qr{display:block;width:230px;height:230px;margin:20px auto}.paid{display:inline-block;background:#d1e7dd;color:#0f5132;padding:6px 10px;border-radius:20px;font-weight:bold}.note{background:#fff3cd;padding:14px;border-radius:8px;font-size:13px}.back{display:inline-block;margin-top:18px;background:#0b5ed7;color:#fff;padding:12px 15px;border-radius:8px;text-decoration:none}@media(max-width:600px){.body{padding:18px}}</style>
</head><body><header><h1>EDUMART Official Receipt</h1><p>Payment confirmed and receipt generated</p></header><main><div class="receipt"><div class="top"><h1 style="margin:0">EDUMART</h1><p style="margin:5px 0 0">OFFICIAL ELECTRONIC RECEIPT</p></div><div class="body"><h2>Payment Receipt</h2><p><strong>Receipt Number:</strong> ${escapeHtml(order.receiptNumber)}</p><p><strong>Order Number:</strong> ${escapeHtml(order.orderId)}</p><p><strong>Customer:</strong> ${escapeHtml(order.customerName)}</p><p><strong>Email:</strong> ${escapeHtml(order.customerEmail)}</p><p><strong>Date:</strong> ${escapeHtml(new Date(order.paidAt).toLocaleString("en-PH"))}</p><div class="paid">✓ PAYMENT STATUS: PAID</div><p><strong>Payment Reference:</strong> ${escapeHtml(order.paymentId)}</p><h3>Order Details</h3><table><tr><th>Item</th><th>Qty</th><th>Amount</th></tr>${rows}</table><h2 style="text-align:right">TOTAL PAID: ${money(order.amount)}</h2><h3 style="text-align:center;margin-top:30px">ORDER CLAIM QR CODE</h3><img class="qr" src="${qrImage}" alt="EDUMART receipt claim QR code"><p style="text-align:center;color:#666">Present this QR code when claiming your order.</p><div class="note"><strong>Important:</strong> This QR code is unique to this receipt and order. Do not share it.</div><p>Thank you for using <strong>EDUMART</strong>.</p><a class="back" href="${escapeHtml(process.env.FRONTEND_URL || "http://localhost:5173")}">Return to EduMart</a></div></div></main></body></html>
  `);
});

/*
 * Production integration point:
 *
 * Your existing PayMongo backend should call:
 *
 *     completePaidOrder(orderId, paymentId)
 *
 * ONLY after PayMongo has confirmed that the payment is successful.
 *
 * The PayMongo webhook endpoint itself should verify the
 * Paymongo-Signature header before calling this function.
 */

app.get("/receipt/verify/:orderId/:token", (req, res) => {
  const order = getOrder(req.params.orderId);

  if (!order || order.claimToken !== req.params.token) {
    return res.status(404).send(`
      <h1>Invalid Receipt QR</h1>
      <p>This receipt QR code is invalid or does not exist.</p>
    `);
  }

  const claimStatus = order.claimed
    ? "CLAIMED"
    : order.paymentStatus === "PAID"
      ? "PAID — READY TO CLAIM"
      : "NOT PAID";

  res.send(`
<!doctype html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>EDUMART Receipt Verification</title>
<style>
body{font-family:Arial;background:#f3f5f8;padding:25px}
.card{max-width:520px;margin:auto;background:white;padding:25px;border-radius:14px}
.ok{color:#198754}.bad{color:#dc3545}
</style>
</head>
<body>
<div class="card">
<h1>EDUMART Receipt Verification</h1>
<p><strong>Receipt:</strong> ${escapeHtml(order.receiptNumber)}</p>
<p><strong>Order:</strong> ${escapeHtml(order.orderId)}</p>
<p><strong>Assigned Locker:</strong> ${escapeHtml(order.lockerId || "N/A")}</p>
<p><strong>Customer:</strong> ${escapeHtml(order.customerName)}</p>
<p><strong>QR Expiration:</strong> ${escapeHtml(new Date(order.qrExpiresAt).toLocaleString("en-PH"))}</p>
<p><strong>Total:</strong> ₱${(Number(order.amount) / 100).toFixed(2)}</p>
<p><strong>Payment:</strong> <span class="ok">PAID</span></p>
<p><strong>Claim Status:</strong>
<span class="${order.claimed ? "bad" : "ok"}">${claimStatus}</span></p>
</div>
</body>
</html>
  `);
});

/*
 * Marks an order as claimed.
 *
 * In production, protect this endpoint with owner/staff authentication
 * and perform the update inside a database transaction/row lock.
 */
app.post("/owner/claim-order/:orderId/:token", (req, res) => {
  const order = getOrder(req.params.orderId);

  if (!order || order.claimToken !== req.params.token) {
    return res.status(404).json({
      success: false,
      error: "Invalid receipt QR."
    });
  }

  if (order.paymentStatus !== "PAID") {
    return res.status(409).json({
      success: false,
      error: "Order has not been paid."
    });
  }

  if (order.claimed) {
    return res.status(409).json({
      success: false,
      error: "Order has already been claimed."
    });
  }

  const updated = updateOrder(order.orderId, {
    claimed: true,
    claimStatus: "CLAIMED",
    claimedAt: new Date().toISOString()
  });

  res.json({
    success: true,
    message: "Order successfully claimed.",
    order: updated
  });
});

/*
 * THIS IS THE CORE FUNCTION.
 *
 * Call this only after a real payment has been verified.
 */
async function completePaidOrder(orderId, paymentId) {
  const existing = getOrder(orderId);

  if (!existing) {
    throw new Error(`Order ${orderId} was not found.`);
  }

  /*
   * Idempotency:
   * If the webhook/payment confirmation is received more than once,
   * don't create another receipt or send another email.
   */
  if (
    existing.paymentStatus === "PAID" &&
    existing.claimToken &&
    existing.receiptNumber
  ) {
    return existing;
  }

  const receiptNumber = makeReceiptNumber(orderId);
  const claimToken = makeClaimToken();

  const { qrUrl, qrBuffer } = await makeReceiptQR(
    orderId,
    claimToken
  );
  const qrExpiresAt = new Date(
    Date.now() + Number(process.env.QR_EXPIRY_HOURS || 48) * 60 * 60 * 1000
  ).toISOString();

  const paidOrder = updateOrder(orderId, {
    paymentStatus: "PAID",
    claimStatus: "READY_TO_CLAIM",
    paymentId,
    receiptNumber,
    paidAt: new Date().toISOString(),
    claimToken,
    qrUrl,
    qrExpiresAt,
    retrievalStatus: "READY"
  });

  deductStock(paidOrder).catch((error) => {
    console.error(`Stock deduction failed for ${orderId}:`, error.message);
  });

  sendReceiptEmail(paidOrder, qrBuffer)
    .then((info) => {
      updateOrder(orderId, {
        emailSent: true,
        emailMessageId: info.messageId
      });
    })
    .catch((error) => {
      /* Payment remains PAID if email delivery fails. */
      updateOrder(orderId, {
        emailSent: false,
        emailError: error.message
      });
      console.error(`Receipt email failed for ${orderId}:`, error.message);
    });

  return paidOrder;
}

/*
 * Tells the main server to lower stock for the items in a paid order.
 * Runs once per order (completePaidOrder returns early for already-paid orders).
 * Needs INTERNAL_API_KEY (same value in both .env files) and optionally BACKEND_URL.
 */
async function deductStock(order) {
  const items = (order.items || [])
    .filter((item) => item.itemId)
    .map((item) => ({ itemId: item.itemId, quantity: Number(item.quantity || 1) }));
  if (!items.length || order.stockDeducted) return;

  const response = await fetch(`${process.env.BACKEND_URL || "http://localhost:3000"}/api/internal/stock/deduct`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-key": process.env.INTERNAL_API_KEY || ""
    },
    body: JSON.stringify({ orderId: order.orderId, items })
  });
  if (!response.ok) {
    throw new Error(`Main server returned ${response.status}: ${await response.text()}`);
  }
  updateOrder(order.orderId, { stockDeducted: true });
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function money(centavos) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP"
  }).format(Number(centavos || 0) / 100);
}

const server = app.listen(PORT, () => {
  console.log(`EDUMART Receipt Service running on http://localhost:${PORT}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`Receipt service is already running on port ${PORT}.`);
    return;
  }

  throw error;
});

module.exports = { completePaidOrder };