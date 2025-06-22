const express = require("express");
const mongoose = require("mongoose");
const amqp = require("amqplib");
const { v4: uuidv4 } = require("uuid");
require("dotenv").config();

const app = express();
app.use(express.json());

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/jobs";
const RABBIT_URL = process.env.RABBIT_URL || "amqp://localhost";

// MongoDB Job Schema
const jobSchema = new mongoose.Schema({
  request_id: String,
  payload: Object,
  status: String,
  result: Object,
  vendor: String,
});
const Job = mongoose.model("Job", jobSchema);

let channel;

async function connectRabbitMQWithRetry() {
  let connected = false;
  let conn, ch;
  while (!connected) {
    try {
      conn = await amqp.connect(RABBIT_URL);
      ch = await conn.createChannel();
      await ch.assertQueue("jobs");
      connected = true;
      console.log("Connected to RabbitMQ");
    } catch (err) {
      console.log("Waiting for RabbitMQ... retrying in 2s");
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  return ch;
}

// Connect to MongoDB and RabbitMQ
async function init() {
  await mongoose.connect(MONGO_URL);
  channel = await connectRabbitMQWithRetry();
  app.listen(3000, () => console.log("API running on port 3000"));
}
init().catch(console.error);

// POST /jobs
app.post("/jobs", async (req, res) => {
  const request_id = uuidv4();
  const vendor = Math.random() < 0.5 ? "sync" : "async"; // Randomly pick vendor
  const job = new Job({
    request_id,
    payload: req.body,
    status: "pending",
    vendor,
  });
  await job.save();
  // Push to queue
  channel.sendToQueue(
    "jobs",
    Buffer.from(JSON.stringify({ request_id, vendor }))
  );
  res.json({ request_id });
});

// GET /jobs/:id
app.get("/jobs/:id", async (req, res) => {
  const job = await Job.findOne({ request_id: req.params.id });
  if (!job) return res.status(404).json({ error: "Not found" });
  if (job.status === "complete") {
    res.json({ status: "complete", result: job.result });
  } else if (job.status === "failed") {
    res.json({ status: "failed" });
  } else {
    res.json({ status: "processing" });
  }
});

// Webhook for async vendor
app.post("/vendor-webhook/async", async (req, res) => {
  const { request_id, result } = req.body;
  const job = await Job.findOne({ request_id });
  if (!job) return res.status(404).json({ error: "Not found" });
  job.status = "complete";
  job.result = result;
  await job.save();
  res.json({ status: "ok" });
});
