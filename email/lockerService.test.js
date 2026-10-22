const test = require("node:test");
const assert = require("node:assert/strict");
const { validateRetrieval, consumeRetrieval } = require("./lockerService");

function makeOrder(overrides = {}) {
  return {
    orderId: "ORDER-1001",
    claimToken: "token-1001",
    customerEmail: "buyer@example.com",
    paymentStatus: "PAID",
    lockerId: "LOCKER-001",
    qrExpiresAt: "2030-01-01T00:00:00.000Z",
    claimed: false,
    retrievalStatus: "READY",
    ...overrides,
  };
}

const now = new Date("2029-01-01T00:00:00.000Z");
const request = { orderId: "ORDER-1001", claimToken: "token-1001", buyerEmail: "buyer@example.com", lockerId: "LOCKER-001" };

test("valid QR code authorizes locker opening and consumes the QR", () => {
  const order = makeOrder();
  const result = consumeRetrieval(order, request, now);
  assert.equal(result.valid, true);
  assert.equal(result.lockerId, "LOCKER-001");
  assert.equal(order.retrievalStatus, "USED");
});

test("invalid QR code is rejected", () => {
  assert.equal(validateRetrieval(makeOrder(), { ...request, claimToken: "wrong" }, now).code, "INVALID_QR");
});

test("expired QR code is rejected", () => {
  assert.equal(validateRetrieval(makeOrder({ qrExpiresAt: "2028-01-01T00:00:00.000Z" }), request, now).code, "EXPIRED_QR");
});

test("already-used QR code is rejected", () => {
  assert.equal(validateRetrieval(makeOrder({ claimed: true, retrievalStatus: "USED" }), request, now).code, "ALREADY_USED");
});

test("QR code for another transaction is rejected", () => {
  assert.equal(validateRetrieval(makeOrder({ orderId: "ORDER-2002" }), request, now).code, "INVALID_QR");
});

test("correct transaction with incorrect locker is rejected", () => {
  assert.equal(validateRetrieval(makeOrder(), { ...request, lockerId: "LOCKER-002" }, now).code, "LOCKER_MISMATCH");
});

test("buyer mismatch is rejected", () => {
  assert.equal(validateRetrieval(makeOrder(), { ...request, buyerEmail: "other@example.com" }, now).code, "BUYER_MISMATCH");
});

test("unverified payment is rejected", () => {
  assert.equal(validateRetrieval(makeOrder({ paymentStatus: "PENDING" }), request, now).code, "PAYMENT_NOT_VERIFIED");
});

test("a consumed QR cannot be reused", () => {
  const order = makeOrder();
  consumeRetrieval(order, request, now);
  assert.equal(validateRetrieval(order, request, now).code, "ALREADY_USED");
});
