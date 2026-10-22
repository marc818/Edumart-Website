import crypto from "node:crypto";
import { getAdmin } from "./marketplace-routes.js";

// Locker data lives in the receipt service (orders.json). The main server reads it with the shared
// INTERNAL_API_KEY and decides what each role may see.

function fail(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function numericId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function sendError(response, error) {
  if (!error.statusCode) console.error(error);
  return response.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Request failed." });
}

async function fetchLockers() {
  const base = process.env.EMAIL_SERVICE_URL || "http://localhost:3001";
  const key = process.env.INTERNAL_API_KEY;
  if (!key) throw fail(503, "INTERNAL_API_KEY is not configured on the main server.");
  const result = await fetch(`${base}/lockers/status`, { headers: { "x-internal-key": key } }).catch(() => {
    throw fail(503, `Locker service is not running at ${base}. Start it with: cd email && npm start`);
  });
  if (!result.ok) throw fail(502, `Locker service returned ${result.status}.`);
  const data = await result.json();
  return Array.isArray(data.lockers) ? data.lockers : [];
}

function summarize(lockers) {
  const count = (status) => lockers.filter((locker) => locker.status === status).length;
  return { total: lockers.length, available: count("AVAILABLE"), reserved: count("RESERVED"), occupied: count("OCCUPIED") };
}

// Same header-based identity the rest of the student API uses: callers can only read their own data.
function ownStudentId(request) {
  const id = numericId(request.params.studentId);
  if (!id) throw fail(400, "Invalid student ID.");
  if (numericId(request.get("x-student-id")) !== id) throw fail(403, "You can only access your own lockers.");
  return id;
}

export function registerLockerRoutes(app, pool) {
  // Anonymous overview: status per locker, no buyer or order details.
  app.get("/api/lockers", async (_request, response) => {
    try {
      const lockers = await fetchLockers();
      return response.json({
        success: true,
        summary: summarize(lockers),
        lockers: lockers.map(({ lockerId, status }) => ({ lockerId, status })),
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return sendError(response, error);
    }
  });

  // The student's own paid lockers (paid and not yet collected). Only these are highlighted for them.
  app.get("/api/students/:studentId/lockers", async (request, response) => {
    try {
      const studentId = ownStudentId(request);
      const { rows } = await pool.query("SELECT institutional_email FROM students WHERE student_id = $1::bigint", [studentId]);
      if (!rows[0]) throw fail(404, "Student not found.");
      const email = String(rows[0].institutional_email || "").trim().toLowerCase();

      const lockers = await fetchLockers();
      const mine = lockers.filter((locker) =>
        locker.status === "OCCUPIED" &&
        (locker.buyerStudentId
          ? Number(locker.buyerStudentId) === studentId
          // Orders saved before buyerStudentId existed can only be matched by email.
          : String(locker.customerEmail || "").trim().toLowerCase() === email)
      ).map((locker) => ({
        lockerId: locker.lockerId,
        orderId: locker.orderId,
        items: locker.items,
        paidAt: locker.paidAt,
        qrExpiresAt: locker.qrExpiresAt,
        qrExpired: locker.qrExpired,
      }));

      return response.json({
        success: true,
        summary: summarize(lockers),
        lockers: lockers.map(({ lockerId, status }) => ({ lockerId, status })),
        mine,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      return sendError(response, error);
    }
  });

  // Administrators see who each occupied locker belongs to.
  app.get("/api/admin/lockers", async (request, response) => {
    try {
      await getAdmin(pool, request);
      const lockers = await fetchLockers();
      return response.json({ success: true, summary: summarize(lockers), lockers, updatedAt: new Date().toISOString() });
    } catch (error) {
      return sendError(response, error);
    }
  });
}