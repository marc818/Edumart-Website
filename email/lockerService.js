const RETRIEVAL_FAILURES = Object.freeze({
  INVALID_QR: "INVALID_QR",
  ORDER_NOT_FOUND: "ORDER_NOT_FOUND",
  BUYER_MISMATCH: "BUYER_MISMATCH",
  EXPIRED_QR: "EXPIRED_QR",
  ALREADY_USED: "ALREADY_USED",
  LOCKER_MISMATCH: "LOCKER_MISMATCH",
  PAYMENT_NOT_VERIFIED: "PAYMENT_NOT_VERIFIED",
});

function normalize(value) {
  return String(value ?? "").trim().toLowerCase();
}

function validateRetrieval(order, request, now = new Date()) {
  if (!order) return { valid: false, code: RETRIEVAL_FAILURES.ORDER_NOT_FOUND };
  if (!request?.claimToken || request.claimToken !== order.claimToken) {
    return { valid: false, code: RETRIEVAL_FAILURES.INVALID_QR };
  }
  if (order.paymentStatus !== "PAID") {
    return { valid: false, code: RETRIEVAL_FAILURES.PAYMENT_NOT_VERIFIED };
  }
  if (order.claimed || order.retrievalStatus === "USED") {
    return { valid: false, code: RETRIEVAL_FAILURES.ALREADY_USED };
  }
  if (order.qrExpiresAt && new Date(order.qrExpiresAt).getTime() <= now.getTime()) {
    return { valid: false, code: RETRIEVAL_FAILURES.EXPIRED_QR };
  }
  if (request.orderId && request.orderId !== order.orderId) {
    return { valid: false, code: RETRIEVAL_FAILURES.INVALID_QR };
  }
  if (request.buyerEmail && normalize(request.buyerEmail) !== normalize(order.customerEmail)) {
    return { valid: false, code: RETRIEVAL_FAILURES.BUYER_MISMATCH };
  }
  if (request.lockerId && request.lockerId !== order.lockerId) {
    return { valid: false, code: RETRIEVAL_FAILURES.LOCKER_MISMATCH };
  }
  if (!order.lockerId) {
    return { valid: false, code: RETRIEVAL_FAILURES.LOCKER_MISMATCH };
  }
  return { valid: true, code: null };
}

function consumeRetrieval(order, request, now = new Date()) {
  const validation = validateRetrieval(order, request, now);
  if (!validation.valid) return validation;

  order.claimed = true;
  order.claimStatus = "CLAIMED";
  order.retrievalStatus = "USED";
  order.retrievedAt = now.toISOString();
  order.lockerOpenedAt = now.toISOString();

  return {
    valid: true,
    code: null,
    orderId: order.orderId,
    lockerId: order.lockerId,
    retrievedAt: order.retrievedAt,
  };
}

module.exports = { validateRetrieval, consumeRetrieval, RETRIEVAL_FAILURES };

/*
 * Locker occupancy.
 *   OCCUPIED  - the order is paid and the item has not been collected yet
 *   RESERVED  - the order is waiting for payment and is still inside the hold window
 *   null      - the locker is free (never assigned, collected, failed, or the unpaid hold lapsed)
 */
const LOCKER_STATES = Object.freeze({ OCCUPIED: "OCCUPIED", RESERVED: "RESERVED" });

function orderCreatedAt(order) {
  if (order.createdAt) return new Date(order.createdAt).getTime();
  // Orders saved before createdAt existed carry their creation time in the ID: ORDER-<ms>-<hex>.
  const stamp = Number(String(order.orderId || "").split("-")[1]);
  return Number.isFinite(stamp) && stamp > 0 ? stamp : 0;
}

function lockerState(order, now = new Date(), holdMinutes = 60) {
  if (!order || !order.lockerId) return null;
  if (order.paymentStatus === "PAID") {
    return order.claimed || order.retrievalStatus === "USED" ? null : LOCKER_STATES.OCCUPIED;
  }
  if (order.paymentStatus === "PENDING") {
    const age = now.getTime() - orderCreatedAt(order);
    return age < holdMinutes * 60 * 1000 ? LOCKER_STATES.RESERVED : null;
  }
  return null;
}

module.exports = { validateRetrieval, consumeRetrieval, RETRIEVAL_FAILURES, lockerState, LOCKER_STATES };
