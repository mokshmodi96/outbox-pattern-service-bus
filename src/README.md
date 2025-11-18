
---

# **Outbox Pattern with Debezium, Kafka, PostgreSQL & Node.js**

A complete, production-ready implementation of the **Transactional Outbox Pattern** using:

- **PostgreSQL** with logical replication
- **Debezium** for Change Data Capture (CDC)
- **Kafka** for event streaming
- **Node.js Producer Service** (writes orders & outbox events)
- **Node.js Consumer Service** (reads Kafka events)

This solves the **dual-write problem** and ensures **reliable event publishing** across microservices.

---

## ⭐ Features

- Fully Dockerized infrastructure (Kafka, Zookeeper, Debezium, Postgres)
- Outbox table with atomic writes
- Debezium CDC → Kafka → Node consumer
- Express Producer API (`/orders`)
- Express Consumer service (KafkaJS)
- Supports multiple aggregate types (order, payment, etc.)
- Clean TypeScript project structure

---

## 📦 Project Structure

```
/
├── docker-compose.yml
├── postgres-init.sql
├── postgresql.conf
├── pg_hba.conf
├── src/
│   ├── producer.ts
│   └── consumer.ts
├── package.json
└── README.md
```

---

## 🏗 Architecture

```
   ┌──────────────┐       ┌──────────────┐       ┌──────────────┐        ┌──────────────┐
   │ Producer API  │       │ PostgreSQL    │       │ Debezium      │        │ Kafka Topics  │
   │ (Express)     │ ----> │ orders +      │ ----> │ Outbox Router │ -----> │  order, ...   │
   │               │       │ outbox_event  │       │ (CDC Engine)  │        │               │
   └──────────────┘       └──────────────┘       └──────────────┘        └──────────────┘
                                                                                 ▲
                                                                                 │
                                                                 ┌───────────────┴───────────────┐
                                                                 │ Consumer Service (KafkaJS)     │
                                                                 │ Reads Kafka events in real-time │
                                                                 └────────────────────────────────┘
```

---

## 🐳 Running the Environment

Start all services:

```bash
docker-compose up -d
```

This starts:

| Service          | Port | Description              |
| ---------------- | ---- | ------------------------ |
| PostgreSQL       | 5432 | Orders DB + Outbox table |
| Zookeeper        | 2181 | Kafka dependency         |
| Kafka Broker     | 9092 | Event streaming          |
| Debezium Connect | 8083 | Reads CDC from Postgres  |

---

## 🗃 PostgreSQL Initialization

The following file automatically runs on first startup:

**`postgres-init.sql`**

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS outbox_event (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aggregate_type VARCHAR(255),
  aggregate_id VARCHAR(255),
  type VARCHAR(255),
  payload JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

---

## 🔌 Register Debezium Outbox Connector

Run this AFTER `docker-compose` is up:

```bash
curl -X POST http://localhost:8083/connectors \
  -H "Content-Type: application/json" \
  -d '{
    "name": "outbox-connector",
    "config": {
      "connector.class": "io.debezium.connector.postgresql.PostgresConnector",
      "plugin.name": "pgoutput",
      "database.hostname": "postgres",
      "database.port": "5432",
      "database.user": "postgres",
      "database.password": "postgres",
      "database.dbname": "orders_db",
      "slot.name": "outbox_slot",
      "publication.autocreate.mode": "filtered",
      "topic.prefix": "orders",
      "table.include.list": "public.outbox_event",
      "tombstones.on.delete": "false",
      "transforms": "outbox",
      "transforms.outbox.type": "io.debezium.transforms.outbox.EventRouter",
      "transforms.outbox.table.field.event.id": "id",
      "transforms.outbox.table.field.event.key": "aggregate_id",
      "transforms.outbox.table.field.event.aggregate.type": "aggregate_type",
      "transforms.outbox.table.field.event.payload": "payload",
      "transforms.outbox.table.field.event.timestamp": "created_at",
      "transforms.outbox.route.by.field": "aggregate_type",
      "transforms.outbox.route.topic.replacement": "${routedByValue}"
    }
  }'
```

Check it:

```bash
curl http://localhost:8083/connectors/outbox-connector/status | jq
```

---

## 🧪 Testing Kafka Topics

List all topics:

```bash
docker exec -it kafka kafka-topics --list --bootstrap-server localhost:9092
```

Expected:

```
orders.public.outbox_event
order
```

Consume events:

```bash
docker exec -it kafka kafka-console-consumer \
  --bootstrap-server localhost:9092 \
  --topic order \
  --from-beginning
```

---

## 🧱 Running Producer Service

Start producer (Express API):

```bash
npm run start:producer
```

### Create an order:

```bash
curl -X POST http://localhost:3000/orders \
  -H "Content-Type: application/json" \
  -d '{"orderId":"2001","status":"CREATED"}'
```

This writes:

- `orders` table
- `outbox_event` table (Debezium streams it)

---

## 📡 Running Consumer Service

Start consumer:

```bash
npm run start:consumer
```

Expected output:

```
📦 Received event → { orderId: '2001', status: 'CREATED' }
```

---

## 🧬 End-to-End Flow

1. Call POST `/orders`
2. Producer inserts into orders + outbox_event (single transaction)
3. Postgres WAL logs the change
4. Debezium reads CDC
5. Debezium Outbox Router transforms event → Kafka topic (`order`)
6. Consumer receives JSON event
7. Event processing done reliably

---

## 🛑 Stopping Services

```bash
docker-compose down
```

Delete all data (reset everything):

```bash
docker-compose down -v
```

---

## 🚀 Future Improvements

- Add schema registry + Avro
- Multiple microservices consuming different aggregates
- Retry + dead-letter queues
- Kubernetes deployment
- Versioned event schemas

---

## 📝 License

MIT License

---
