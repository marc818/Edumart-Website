const crypto = require("crypto");
const QRCode = require("qrcode");

function makeReceiptNumber(orderId) {
  return `EDU-${orderId}-${Date.now()}`;
}

function makeClaimToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function makeReceiptQR(orderId, token) {
  const base =
    (process.env.APP_BASE_URL || "http://localhost:3001").replace(/\/$/, "");

  const qrUrl =
    `${base}/receipt/verify/${encodeURIComponent(orderId)}/${token}`;

  const qrBuffer = await QRCode.toBuffer(qrUrl, {
    type: "png",
    width: 360,
    margin: 2,
    errorCorrectionLevel: "M"
  });

  return { qrUrl, qrBuffer };
}

module.exports = {
  makeReceiptNumber,
  makeClaimToken,
  makeReceiptQR
};
