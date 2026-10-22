import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "node:crypto";
import { checkDatabaseConnection } from "./database.js";
import pool from "./database.js";
import { registerMarketplaceRoutes } from "./modules/marketplace-routes.js";
import { ensureSchema, registerStudentRoutes } from "./modules/student-routes.js";
import { registerLockerRoutes } from "./modules/locker-routes.js";

dotenv.config();

const app = express();
const emailServiceUrl = process.env.EMAIL_SERVICE_URL || "http://localhost:3001";

app.use(cors());
app.use(express.json());

registerMarketplaceRoutes(app, pool);
registerStudentRoutes(app, pool);
registerLockerRoutes(app, pool);

app.get("/api/health/database", async (_req, res) => {
    try {
        await checkDatabaseConnection();
        return res.json({ connected: true, database: process.env.DB_NAME || "edumart" });
    } catch (error) {
        console.error("Database connection error:", error.message);
        return res.status(503).json({ connected: false, message: "Database is unavailable." });
    }
});

app.post("/api/payment/create-checkout", async (req, res) => {
    try {
        const { items, buyerEmail, studentId, paymentMethod = "gcash" } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: "Your cart is empty." });
        }

        if (!studentId) {
            return res.status(401).json({ success: false, message: "Student authentication is required before checkout." });
        }

        const { rows: students } = await pool.query(
            "SELECT student_id, full_name, display_name, institutional_email, verification_status FROM students WHERE student_id = $1",
            [studentId]
        );
        if (!students[0] || students[0].verification_status !== "VERIFIED") {
            return res.status(403).json({ success: false, message: "Student account verification is required before checkout." });
        }

        const wanted = new Map();
        for (const item of items) {
            const itemId = Number(item?.[0]);
            if (!Number.isInteger(itemId) || itemId <= 0) {
                throw Object.assign(new Error("Invalid item in cart."), { statusCode: 400 });
            }
            const quantity = Math.max(1, Math.floor(Number(item[7]) || 1));
            wanted.set(itemId, (wanted.get(itemId) || 0) + quantity);
        }

        // Prices, names and stock come from the database, never from the browser.
        const { rows: catalogRows } = await pool.query(
            "SELECT item_id, name, price_centavos, stock FROM catalog_items WHERE item_id = ANY($1::int[])",
            [[...wanted.keys()]]
        );
        const orderItems = [...wanted].map(([itemId, quantity]) => {
            const row = catalogRows.find((entry) => entry.item_id === itemId);
            if (!row) throw Object.assign(new Error("An item in your cart is no longer available."), { statusCode: 409 });
            if (row.stock < quantity) {
                throw Object.assign(new Error(row.stock > 0 ? `Only ${row.stock} of "${row.name}" left.` : `"${row.name}" is sold out.`), { statusCode: 409 });
            }
            return { itemId, currency: "PHP", amount: row.price_centavos, name: row.name, quantity };
        });
        const lineItems = orderItems.map(({ currency, amount, name, quantity }) => ({ currency, amount, name, quantity }));

        const orderId = `ORDER-${Date.now()}-${crypto.randomBytes(4).toString("hex")}`;
        const orderAmount = lineItems.reduce(
            (sum, item) => sum + item.amount * item.quantity,
            0
        );
        const orderResponse = await fetch(`${emailServiceUrl}/orders`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orderId,
                customerName: students[0].display_name || students[0].full_name,
                customerEmail: buyerEmail || students[0].institutional_email,
                buyerStudentId: studentId,
                amount: orderAmount,
                items: orderItems,
            }),
        }).catch(() => {
            throw Object.assign(new Error(`Receipt service is not running at ${emailServiceUrl}. Start it with: cd email && npm start`), { statusCode: 503 });
        });

        if (!orderResponse.ok) {
            const errorBody = await orderResponse.text();
            throw new Error(`Receipt service returned ${orderResponse.status}: ${errorBody || "Unable to register the order."}`);
        }

        const encodedCredentials = Buffer.from(
            `${process.env.PAYMONGO_SECRET_KEY}:`
        ).toString("base64");

        const response = await fetch(
            "https://api.paymongo.com/v2/checkout_sessions",
            {
                method: "POST",

                headers: {
                    Authorization: `Basic ${encodedCredentials}`,
                    "Content-Type": "application/json",
                },

                body: JSON.stringify({
                    data: {
                        attributes: {
                            line_items: lineItems,
                            payment_method_types: [paymentMethod, "card", "qrph"].filter((method, index, methods) => methods.indexOf(method) === index),
                            ...(buyerEmail ? { billing: { email: buyerEmail } } : {}),
                            reference_number: orderId,
                            metadata: { order_id: orderId },
                            description: "EduMart academic marketplace order",
                            send_email_receipt: Boolean(buyerEmail),
                            show_description: true,
                            success_url: `${process.env.RECEIPT_SERVICE_URL || emailServiceUrl}/receipt/preview/${orderId}`,
                            cancel_url: `${process.env.FRONTEND_URL}/?payment=cancelled`,
                        },
                    },
                }),
            }
        ).catch(() => {
            throw Object.assign(new Error("Cannot reach PayMongo. Check your internet connection and PAYMONGO_SECRET_KEY."), { statusCode: 502 });
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json({
                message: data?.errors?.[0]?.detail || "PayMongo could not create the checkout session.",
            });
        }

        const checkoutUrl = data?.data?.attributes?.checkout_url;
        if (!checkoutUrl) {
            return res.status(502).json({ message: "PayMongo did not return a checkout URL." });
        }

        return res.json({ checkoutUrl });
    } catch (error) {
        console.error("Checkout session error:", error);
        return res.status(error.statusCode || 500).json({ message: error.message || "Unable to create checkout session." });
    }
});

try {
    await ensureSchema(pool);
} catch (error) {
    console.error("Schema setup failed:", error.message);
}

app.listen(Number(process.env.PORT || 3000), async () => {
    console.log("Server running on http://localhost:3000");
    try {
        await checkDatabaseConnection();
        console.log(`Database connected: ${process.env.DB_NAME || "edumart"}`);
    } catch (error) {
        console.error(`Database connection failed: ${error.message}`);
    }
});