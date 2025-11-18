import express from "express";
import { Pool } from "pg";

const app = express();
app.use(express.json());

const pool = new Pool({
  user: "postgres",
  host: "localhost",
  password: "postgres",
  port: 5432,
  database: "orders_db",
});

app.post("/orders", async (req, res) => {
  const { orderId, status } = req.body;

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO orders (id, status) VALUES ($1, $2) ON CONFLICT (id) DO NOTHING",
      [orderId, status]
    );

    // Insert into outbox_event
    await client.query(
      `INSERT INTO outbox_event (aggregate_type, aggregate_id, type, payload)
       VALUES ($1, $2, $3, $4)`,
      ["order", orderId, "OrderCreated", JSON.stringify({ orderId, status })]
    );

    await client.query("COMMIT");

    res.status(201).json({ message: "Order created successfully" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Transaction failed:", err);
    res.status(500).json({ error: "Failed to create order" });
  } finally {
    client.release();
  }
});

app.listen(3000, () => {
  console.log("🚀 Producer server running on http://localhost:3000");
});
