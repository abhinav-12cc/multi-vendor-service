const amqp = require("amqplib");
const mongoose = require("mongoose");
const axios = require("axios");
const Bottleneck = require("bottleneck");
require("dotenv").config();

const MONGO_URL = process.env.MONGO_URL || "mongodb://localhost:27017/jobs";
const RABBIT_URL = process.env.RABBIT_URL || "amqp://localhost";
const VENDOR_MOCK_URL = process.env.VENDOR_MOCK_URL || "http://localhost:4000";
const API_URL = process.env.API_URL || "http://api:3000";

const jobSchema = new mongoose.Schema({
  request_id: String,
  payload: Object,
  status: String,
  result: Object,
  vendor: String,
});
const Job = mongoose.model("Job", jobSchema);

const vendorLimiter = new Bottleneck({
  minTime: 200, // 5 calls per second
});

async function cleanResult(result) {
  // Example: trim all string fields
  if (typeof result === "object") {
    for (let key in result) {
      if (typeof result[key] === "string") {
        result[key] = result[key].trim();
      }
    }
  }
  return result;
}

async function processJob(job) {
  // Update status to processing
  await Job.updateOne({ request_id: job.request_id }, { status: "processing" });

  try {
    if (job.vendor === "sync") {
      // Call sync vendor with rate limiting
      const response = await vendorLimiter.schedule(() =>
        axios.post(`${VENDOR_MOCK_URL}/vendor-sync`, job.payload)
      );
      const cleaned = await cleanResult(response.data);
      await Job.updateOne(
        { request_id: job.request_id },
        { status: "complete", result: cleaned }
      );
    } else {
      // Call async vendor with rate limiting
      await vendorLimiter.schedule(() =>
        axios.post(`${VENDOR_MOCK_URL}/vendor-async`, {
          ...job.payload,
          request_id: job.request_id,
          callback_url: `${API_URL}/vendor-webhook/async`,
        })
      );
      // Status will be updated by webhook
    }
  } catch (err) {
    await Job.updateOne({ request_id: job.request_id }, { status: "failed" });
    console.error("Job failed:", err);
  }
}

async function connectRabbitMQWithRetry() {
  let connected = false;
  let conn, ch;
  while (!connected) {
    try {
      conn = await amqp.connect(RABBIT_URL);
      ch = await conn.createChannel();
      await ch.assertQueue("jobs");
      connected = true;
      console.log("Worker connected to RabbitMQ");
    } catch (err) {
      console.log("Worker waiting for RabbitMQ... retrying in 2s");
      await new Promise((res) => setTimeout(res, 2000));
    }
  }
  return ch;
}

async function main() {
  await mongoose.connect(MONGO_URL);
  const channel = await connectRabbitMQWithRetry();
  console.log("Worker listening for jobs...");

  channel.consume("jobs", async (msg) => {
    if (msg !== null) {
      const { request_id, vendor } = JSON.parse(msg.content.toString());
      const job = await Job.findOne({ request_id });
      if (job) {
        await processJob(job);
      }
      channel.ack(msg);
    }
  });
}

main().catch(console.error);
