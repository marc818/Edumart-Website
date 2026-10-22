import crypto from "node:crypto";

// Starting catalog + stock. Stock is only seeded once (ON CONFLICT DO NOTHING), so later
// changes made in the database are never overwritten. Edit with:
//   UPDATE catalog_items SET stock = 3 WHERE item_id = 1;
const SEED_ITEMS = [
  [1, "Books", "Engineering Mechanics: Statics", "Maria L.", 650, "📘", "Good"],
  [2, "Books", "Fundamentals of Electric Circuits", "Paolo R.", 800, "📗", "Like new"],
  [3, "Calculators", "Casio fx-991EX", "Kim T.", 700, "🧮", "Good"],
  [4, "Drafting Tools", "Drafting Set with T-Square", "Ana C.", 450, "📐", "Good"],
  [5, "Lab Equipment", "Lab Gown, Size M", "Jerome D.", 250, "🥼", "Like new"],
  [6, "Lab Equipment", "Digital Multimeter", "Rico S.", 520, "🔌", "Good"],
  [7, "Reviewers", "Board Exam Reviewer, Civil Engineering", "Lea M.", 180, "📝", "Used"],
  [8, "Books", "Thermodynamics, 8th Edition", "Carl V.", 720, "📙", "Good"],
  [9, "Reviewers", "Circuits 1 Reviewer", "Daniel K.", 80, "📄", "Used"],
];
const DEFAULT_STOCK = 5;

// Additive and idempotent: safe to run on every start.
export async function ensureSchema(pool) {
  await pool.query("ALTER TABLE students ADD COLUMN IF NOT EXISTS display_name VARCHAR(80)");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalog_items (
      item_id INTEGER PRIMARY KEY,
      category VARCHAR(100) NOT NULL,
      name VARCHAR(180) NOT NULL,
      seller VARCHAR(120) NOT NULL,
      price_centavos INTEGER NOT NULL CHECK (price_centavos >= 0),
      icon VARCHAR(16),
      condition_label VARCHAR(60) NOT NULL,
      stock INTEGER NOT NULL DEFAULT ${DEFAULT_STOCK} CHECK (stock >= 0),
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
  for (const [id, category, name, seller, price, icon, condition] of SEED_ITEMS) {
    await pool.query(
      `INSERT INTO catalog_items (item_id, category, name, seller, price_centavos, icon, condition_label, stock)
       VALUES ($1::int, $2::varchar, $3::varchar, $4::varchar, $5::int, $6::varchar, $7::varchar, $8::int)
       ON CONFLICT (item_id) DO NOTHING`,
      [id, category, name, seller, price * 100, icon, condition, DEFAULT_STOCK]
    );
  }
}

function fail(statusCode, message) {
  return Object.assign(new Error(message), { statusCode });
}

function numericId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Same header-based identity the rest of the API uses today: the caller can only touch their own row.
function ownStudentId(request) {
  const id = numericId(request.params.studentId);
  if (!id) throw fail(400, "Invalid student ID.");
  if (numericId(request.get("x-student-id")) !== id) throw fail(403, "You can only access your own profile.");
  return id;
}

function sendError(response, error) {
  if (!error.statusCode) console.error(error);
  return response.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : "Request failed." });
}

export function registerStudentRoutes(app, pool) {
  app.get("/api/catalog", async (_request, response) => {
    try {
      const { rows } = await pool.query(
        `SELECT item_id, category, name, seller, price_centavos, icon, condition_label, stock
         FROM catalog_items ORDER BY item_id`
      );
      return response.json({ success: true, items: rows });
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.get("/api/students/:studentId/profile", async (request, response) => {
    try {
      const studentId = ownStudentId(request);
      const { rows } = await pool.query(
        `SELECT student_id, full_name, display_name, institutional_email, student_number, school,
                college, program, year_level, contact, verification_status
         FROM students WHERE student_id = $1::bigint`,
        [studentId]
      );
      if (!rows[0]) throw fail(404, "Student not found.");
      return response.json({ success: true, student: rows[0] });
    } catch (error) {
      return sendError(response, error);
    }
  });

  app.patch("/api/students/:studentId/display-name", async (request, response) => {
    try {
      const studentId = ownStudentId(request);
      const displayName = String(request.body?.displayName ?? "").replace(/[\u0000-\u001f\u007f]/g, "").trim();
      if (!displayName) throw fail(400, "Display name is required.");
      if (displayName.length > 80) throw fail(400, "Display name must be 80 characters or fewer.");
      const { rowCount } = await pool.query(
        "UPDATE students SET display_name = $1::varchar, updated_at = CURRENT_TIMESTAMP WHERE student_id = $2::bigint",
        [displayName, studentId]
      );
      if (!rowCount) throw fail(404, "Student not found.");
      return response.json({ success: true, displayName });
    } catch (error) {
      return sendError(response, error);
    }
  });

  // Called by the receipt service once PayMongo confirms a payment.
  app.post("/api/internal/stock/deduct", async (request, response) => {
    const expected = process.env.INTERNAL_API_KEY;
    if (!expected) return response.status(503).json({ success: false, message: "INTERNAL_API_KEY is not configured on the main server." });
    const given = Buffer.from(request.get("x-internal-key") || "");
    const wanted = Buffer.from(expected);
    if (given.length !== wanted.length || !crypto.timingSafeEqual(given, wanted)) {
      return response.status(401).json({ success: false, message: "Invalid internal key." });
    }

    let client;
    try {
      const items = Array.isArray(request.body?.items) ? request.body.items : [];
      const deductions = items.map((entry) => ({ itemId: numericId(entry?.itemId), quantity: numericId(entry?.quantity) }));
      if (!deductions.length || deductions.some((entry) => !entry.itemId || !entry.quantity)) throw fail(400, "Invalid items.");

      client = await pool.connect();
      await client.query("BEGIN");
      for (const { itemId, quantity } of deductions) {
        await client.query(
          "UPDATE catalog_items SET stock = GREATEST(stock - $2::int, 0) WHERE item_id = $1::int",
          [itemId, quantity]
        );
      }
      await client.query("COMMIT");
      return response.json({ success: true });
    } catch (error) {
      if (client) await client.query("ROLLBACK").catch(() => {});
      return sendError(response, error);
    } finally {
      client?.release();
    }
  });
}