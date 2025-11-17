import express from "express";
import { Kafka } from "kafkajs";

const app = express();
const port = 3001;

// Kafka setup
const kafka = new Kafka({
  brokers: ["localhost:9092"], // From docker-compose advertised listener
});

const consumer = kafka.consumer({ groupId: "order-service" });

const runConsumer = async () => {
  await consumer.connect();
  await consumer.subscribe({ topic: "order", fromBeginning: true });

  await consumer.run({
    eachMessage: async ({ topic, message }) => {
      if (!message.value) return;

      const raw = message.value.toString();
      const msg = JSON.parse(raw);
      const event = msg.payload ? JSON.parse(msg.payload) : msg;

      console.log(`📦 Received from topic [${topic}] ->`, event);
    },
  });
};

runConsumer().catch(console.error);

app.get("/", (_, res) => res.send("Kafka Consumer is running..."));

app.listen(port, () =>
  console.log(`📡 Consumer server listening on http://localhost:${port}`)
);
