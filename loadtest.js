import http from "k6/http";
import { check, sleep } from "k6";

export let options = {
  vus: 200, // 200 concurrent users
  duration: "60s",
};

export default function () {
  // 50% chance to POST, 50% to GET
  if (Math.random() < 0.5) {
    // POST /jobs
    let payload = JSON.stringify({ foo: "bar" });
    let params = { headers: { "Content-Type": "application/json" } };
    let res = http.post("http://localhost:3000/jobs", payload, params);
    check(res, { "POST status 200": (r) => r.status === 200 });
  } else {
    // Simulate a GET with a random UUID (most will be 404, that's OK for load)
    let fakeId = "00000000-0000-4000-8000-000000000000";
    let res = http.get(`http://localhost:3000/jobs/${fakeId}`);
    check(res, {
      "GET status 200 or 404": (r) => r.status === 200 || r.status === 404,
    });
  }
  sleep(0.1); // Small pause to simulate user think time
}
