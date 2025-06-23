# Multi-Vendor Data Fetch Service

A backend system that unifies access to multiple external data vendors (sync & async), with rate-limiting, job status tracking, and a clean internal API.

---

## Quick Start

**Requirements:**

- Docker & Docker Compose
- Node.js (for running the load test script)
- k6 (for load testing)

**1. Clone the repository:**

```sh
git clone <repo-url>
cd multi-vendor-service
```

**2. Start all services:**

```sh
docker-compose up --build
```

- This will start: MongoDB, RabbitMQ, API, Worker, and Vendor Mocks.

**3. Run the load test (in a new terminal):**

```sh
k6 run loadtest.js
```

---

## Architecture Diagram

```
+--------+      +---------+      +---------+      +-------------+
| Client | ---> |  API    | ---> | RabbitMQ| ---> |   Worker    |
+--------+      +---------+      +---------+      +-------------+
                    |                                  |
                    |                                  v
                    |                        +-------------------+
                    |                        | Vendor Mocks      |
                    |                        | (Sync & Async)    |
                    |                        +-------------------+
                    |                                  |
                    v                                  v
               +---------+                      +-------------+
               | MongoDB | <--------------------| Webhook     |
               +---------+                      +-------------+
```

---

## Endpoints & Usage

### 1. **Submit a Job**

```sh
curl -X POST http://localhost:3000/jobs -H "Content-Type: application/json" -d "{\"foo\":\"bar\"}"
```

**Response:**  
`{"request_id":"<uuid>"}`

### 2. **Check Job Status**

```sh
curl http://localhost:3000/jobs/<request_id>
```

**Response:**

- If complete: `{"status":"complete","result":{...}}`
- If processing: `{"status":"processing"}`

### 3. **Webhook (for async vendor, handled internally)**

- `POST /vendor-webhook/async` (used by vendor-mocks, not for direct user calls)

---

## Key Design Decisions & Trade-offs

- **Microservices:** Each component (API, Worker, Vendor Mocks) is a separate Node.js service for clarity and isolation.
- **Queue (RabbitMQ):** Decouples job submission from processing, ensuring reliability and scalability.
- **Rate Limiting:** Worker uses [bottleneck](https://www.npmjs.com/package/bottleneck) to ensure vendor APIs are not overwhelmed (5 calls/sec).
- **Sync & Async Vendors:** Both are mocked; async vendor uses a webhook callback to simulate delayed responses.
- **Docker Compose:** One command spins up the entire stack for easy local development and testing.
- **No PII/cleaning:** Example cleaning trims string fields; can be extended for real PII removal.

---

## Load Test

- **Script:** See `loadtest.js`
- **How to run:**  
  `k6 run loadtest.js`
- **Scenario:** 200 concurrent users, 60 seconds, random mix of POST and GET.
- **Sample Results:**
  - ~19,000 requests in 60s (~305 req/s)
  - 100% check pass rate
  - ~50% failed requests (expected for random GETs with fake IDs)
  - Average response time: ~540ms

**Analysis:**

- The system handled high concurrency without crashing.
- Most failures were 404s from GETs with random IDs (expected).
- Rate-limiting kept vendor calls within safe bounds.
- For higher throughput, consider scaling workers or tuning MongoDB/RabbitMQ.

---

## Postman Collection / cURL

- See above for cURL commands.
- You can import these into Postman for manual testing.

---

## Extra Credit (Not Implemented)

- Unit tests, CI, Prometheus metrics, graceful shutdown, circuit-breaker (can be added if time allows).

---

**Author:**  
Abhinav Srivastava
abhinavsrivastava103@gmail.com
