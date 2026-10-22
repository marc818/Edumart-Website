const fs = require("fs");
const path = require("path");
const { lockerState } = require("./lockerService");

const FILE = path.join(__dirname, "orders.json");

function readDB() {
  if (!fs.existsSync(FILE)) {
    fs.writeFileSync(FILE, JSON.stringify({ orders: {} }, null, 2));
  }
  const db = JSON.parse(fs.readFileSync(FILE, "utf8"));
  let changed = false;

  for (const order of Object.values(db.orders)) {
    if (!order.lockerId) {
      order.lockerId = assignLocker(db);
      changed = true;
    }
    if (!order.retrievalStatus) {
      order.retrievalStatus = order.claimed ? "USED" : "READY";
      changed = true;
    }
    if (order.paymentStatus === "PAID" && !order.qrExpiresAt && order.paidAt) {
      order.qrExpiresAt = new Date(
        new Date(order.paidAt).getTime() + Number(process.env.QR_EXPIRY_HOURS || 48) * 60 * 60 * 1000
      ).toISOString();
      changed = true;
    }
  }

  if (changed) writeDB(db);
  return db;
}

function writeDB(db) {
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function lockerCount() {
  return Number(process.env.LOCKER_COUNT || 10);
}

function holdMinutes() {
  return Number(process.env.LOCKER_HOLD_MINUTES || 60);
}

function lockerIds() {
  return Array.from({ length: lockerCount() }, (_, index) => `LOCKER-${String(index + 1).padStart(3, "0")}`);
}

// Lockers that are currently taken. Collected, failed and lapsed-unpaid orders release theirs.
function takenLockers(db, exceptOrderId = null) {
  const taken = new Set();
  for (const order of Object.values(db.orders)) {
    if (order.orderId === exceptOrderId) continue;
    if (lockerState(order, new Date(), holdMinutes())) taken.add(order.lockerId);
  }
  return taken;
}

function assignLocker(db, exceptOrderId = null) {
  const taken = takenLockers(db, exceptOrderId);
  const locker = lockerIds().find(id => !taken.has(id));
  if (!locker) throw new Error("No lockers are currently available.");
  return locker;
}

/*
 * Called when a payment is confirmed. If the unpaid hold lapsed and another buyer was given
 * the same locker in the meantime, move this order to a free one so two paid orders never share a locker.
 */
function secureLockerForPaidOrder(orderId) {
  const db = readDB();
  const order = db.orders[orderId];
  if (!order) return null;
  const taken = takenLockers(db, orderId);
  if (order.lockerId && !taken.has(order.lockerId)) return order.lockerId;
  try {
    order.lockerId = assignLocker(db, orderId);
    writeDB(db);
  } catch (error) {
    console.error(`No free locker for paid order ${orderId}; keeping ${order.lockerId}.`);
  }
  return order.lockerId;
}

/*
 * Snapshot of every locker for the dashboards. Contains buyer details, so it is only
 * served to the main server (see /lockers/status), which decides what each role may see.
 */
function getLockerSnapshot() {
  const db = readDB();
  const now = new Date();
  const byLocker = new Map();
  for (const order of Object.values(db.orders)) {
    const state = lockerState(order, now, holdMinutes());
    if (state) byLocker.set(order.lockerId, { order, state });
  }
  return lockerIds().map(lockerId => {
    const entry = byLocker.get(lockerId);
    if (!entry) return { lockerId, status: "AVAILABLE" };
    const { order, state } = entry;
    return {
      lockerId,
      status: state,
      orderId: order.orderId,
      buyerStudentId: order.buyerStudentId ?? null,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      items: (order.items || []).map(item => ({ name: item.name, quantity: Number(item.quantity || 1) })),
      amount: order.amount,
      paidAt: order.paidAt || null,
      qrExpiresAt: order.qrExpiresAt || null,
      qrExpired: Boolean(order.qrExpiresAt && new Date(order.qrExpiresAt).getTime() <= now.getTime())
    };
  });
}

function createOrder(order) {
  const db = readDB();
  const lockerId = order.lockerId || assignLocker(db);

  db.orders[order.orderId] = {
    ...order,
    lockerId,
    createdAt: new Date().toISOString(),
    paymentStatus: "PENDING",
    claimStatus: "NOT_READY",
    claimToken: null,
    receiptNumber: null,
    qrUrl: null,
    emailSent: false,
    retrievalStatus: "READY",
    qrExpiresAt: null,
    retrievedAt: null,
    lockerOpenedAt: null,
    claimedAt: null
  };

  writeDB(db);
  return db.orders[order.orderId];
}

function getOrder(orderId) {
  return readDB().orders[orderId] || null;
}

function updateOrder(orderId, changes) {
  const db = readDB();

  if (!db.orders[orderId]) {
    throw new Error(`Order ${orderId} does not exist.`);
  }

  db.orders[orderId] = {
    ...db.orders[orderId],
    ...changes
  };

  writeDB(db);
  return db.orders[orderId];
}

module.exports = { createOrder, getOrder, updateOrder, getLockerSnapshot, secureLockerForPaidOrder };