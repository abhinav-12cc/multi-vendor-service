const express = require("express");
const axios = require("axios");
const app = express();
app.use(express.json());

// Synchronous vendor: replies immediately
app.post("/vendor-sync", (req, res) => {
  setTimeout(() => {
    res.json({ result: `SYNC: processed ${JSON.stringify(req.body)}` });
  }, 1000); // Simulate 1s processing
});

// Asynchronous vendor: replies later via webhook
app.post("/vendor-async", (req, res) => {
  const { request_id, callback_url, ...payload } = req.body;
  setTimeout(() => {
    // Simulate async callback after 3 seconds
    setTimeout(async () => {
      try {
        await axios.post(callback_url, {
          request_id,
          result: { result: `ASYNC: processed ${JSON.stringify(payload)}` },
        });
      } catch (err) {
        console.error("Failed to call webhook:", err.message);
      }
    }, 3000);
    res.json({ status: "accepted" });
  }, 500);
});

app.listen(4000, () => console.log("Vendor mocks running on port 4000"));
