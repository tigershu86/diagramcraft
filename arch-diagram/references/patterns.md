# Architecture Diagram Patterns Library

Pre-built node and edge configurations. Copy and modify for the user's specific system.

---

## 1. Microservices Architecture (Medium — 10 nodes)

**Canvas**: 1000 × 720

**Tiers**:
```
Client Layer:   y=40,  h=100
Edge Layer:     y=160, h=100
API Layer:      y=280, h=100
Service Layer:  y=400, h=120
Data Layer:     y=540, h=140
```

**Nodes** (x, y, w=140, h=60 unless noted):
```
browser:        x=430, y=65   — Web Client, 🌐, #E8F4FD/#2E86C1
load_balancer:  x=430, y=185  — Load Balancer, ⚖️, #FEF9E7/#F39C12
api_gateway:    x=430, y=305  — API Gateway, 🔀, #EBF5FB/#2980B9
user_svc:       x=160, y=425  — User Service, 🟢, #EAFAF1/#27AE60
order_svc:      x=360, y=425  — Order Service, 🟢, #EAFAF1/#27AE60
product_svc:    x=560, y=425  — Product Service, 🟢, #EAFAF1/#27AE60
notify_svc:     x=760, y=425  — Notify Service, 🟢, #EAFAF1/#27AE60
user_db:        x=100, y=570  — Users DB, 🗄️, #EBF5FB/#2471A3, cylinder
order_db:       x=300, y=570  — Orders DB, 🗄️, #EBF5FB/#2471A3, cylinder
redis:          x=550, y=570  — Redis Cache, ⚡, #FDEDEC/#E74C3C
message_queue:  x=750, y=570  — Message Queue, 📨, #FFF3E0/#E67E22
```

**Edges**:
```
browser → load_balancer:   "HTTPS"
load_balancer → api_gateway: "HTTP"
api_gateway → user_svc:    "REST"
api_gateway → order_svc:   "REST"
api_gateway → product_svc: "REST"
order_svc → notify_svc:    "Event", dashed
user_svc → user_db:        "SQL"
order_svc → order_db:      "SQL"
order_svc → redis:         "Read/Write"
notify_svc → message_queue: "Pub/Sub"
```

---

## 2. URL Shortener (Simple — 6 nodes)

**Canvas**: 700 × 580

**Nodes**:
```
browser:      x=270, y=65   — Web Client, 🌐
load_balancer:x=270, y=185  — Load Balancer, ⚖️
api_server:   x=270, y=305  — API Server, Node/Go
cache:        x=100, y=425  — Redis Cache, ⚡
db:           x=300, y=450  — URL Database, 🗄️, cylinder
analytics:    x=500, y=425  — Analytics Service, 📊
```

**Edges**:
```
browser → load_balancer:  "HTTPS"
load_balancer → api_server: "HTTP"
api_server → cache:       "Cache Lookup"
api_server → db:          "SQL"
api_server → analytics:   "Async", dashed
```

---

## 3. Chat Application (WebSocket — 8 nodes)

**Canvas**: 900 × 700

**Nodes**:
```
mobile:       x=150, y=65   — Mobile App, 📱
web:          x=400, y=65   — Web App, 🌐
load_balancer:x=280, y=185  — Load Balancer, ⚖️
chat_server:  x=160, y=305  — Chat Server, 💬
presence:     x=400, y=305  — Presence Service
redis_pub:    x=160, y=425  — Redis Pub/Sub, ⚡
msg_db:       x=100, y=560  — Messages DB, 🗄️, cylinder
user_db:      x=300, y=560  — Users DB, 🗄️, cylinder
push_notify:  x=600, y=425  — Push Notification, 🔔, dashed-rect
```

**Key edges**:
```
mobile/web → load_balancer:   "WebSocket"
load_balancer → chat_server:  "WS"
chat_server → redis_pub:      "Pub/Sub"
chat_server → msg_db:         "Write"
chat_server → push_notify:    "FCM/APNS", dashed
```

---

## 4. E-commerce Platform (Complex — 14 nodes)

**Canvas**: 1200 × 900

**Tiers**:
```
Client:   y=40,  h=100
Edge:     y=160, h=100  — CDN + LB
API:      y=280, h=100
Services: y=400, h=130
Data:     y=550, h=160
External: y=730, h=100
```

**Nodes**:
```
browser:        x=550, y=65  — Web Client, 🌐
cdn:            x=300, y=185 — CDN, 🌍, #E8F8F5/#1ABC9C
load_balancer:  x=600, y=185 — Load Balancer, ⚖️
api_gateway:    x=550, y=305 — API Gateway, 🔀
auth_svc:       x=100, y=425 — Auth Service, 🔐
user_svc:       x=280, y=425 — User Service
catalog_svc:    x=460, y=425 — Catalog Service
cart_svc:       x=640, y=425 — Cart Service
order_svc:      x=820, y=425 — Order Service
redis:          x=100, y=580 — Redis Cache, ⚡
user_db:        x=260, y=590 — Users DB, cylinder
product_db:     x=430, y=590 — Products DB, cylinder
order_db:       x=600, y=590 — Orders DB, cylinder
search:         x=770, y=580 — Elasticsearch, 🔍
payment_gw:     x=300, y=755 — Payment Gateway, 💳, dashed-rect
email_svc:      x=700, y=755 — Email Service, 📧, dashed-rect
```

---

## 5. Video Streaming (YouTube-like — 11 nodes)

**Canvas**: 1100 × 760

**Key components**:
```
creator_client:  Upload client
cdn:             Global CDN distribution
api_gateway:     REST API
upload_svc:      Video upload handler
transcode_svc:   FFmpeg transcoding (multiple quality)
metadata_svc:    Title, description, tags
recommend_svc:   Recommendation ML model
object_storage:  S3-compatible blob store
metadata_db:     Video metadata SQL DB
cache:           Redis view counts cache
queue:           Job queue (transcode jobs)
```

**Key flows**:
```
creator_client → api_gateway: "Upload (chunked)"
api_gateway → upload_svc: REST
upload_svc → queue: "Transcode Job"
queue → transcode_svc: "Consume"
transcode_svc → object_storage: "Store HLS chunks"
object_storage → cdn: "Origin pull"
cdn → viewer_client: "HLS stream"
```

---

## 6. ML Serving Pipeline (8 nodes)

**Canvas**: 900 × 680

**Tiers**:
```
Input Layer:    y=40,  h=100
Processing:     y=160, h=100
Serving:        y=280, h=120
Data/Storage:   y=420, h=120
Monitoring:     y=560, h=100
```

**Nodes**:
```
client:          Web/Mobile client
api_gateway:     REST API Gateway
feature_store:   Feature Store (Redis), ⚡
model_server:    Model Server (TF Serving / Triton)
ab_router:       A/B Testing Router
model_registry:  MLflow Model Registry, 📦
prediction_db:   Prediction Log DB, cylinder
monitor:         Prometheus + Grafana, 📊, dashed-rect
```

---

## 7. Event-Driven Architecture (Kafka — 9 nodes)

**Canvas**: 1000 × 700

**Central component**: Kafka cluster (wide box, centered)

**Nodes**:
```
producers:   3 producer services on left
kafka:       Large central box (w=300), "Apache Kafka 📨"
consumers:   3 consumer services on right
schema_reg:  Schema Registry (above kafka)
zookeeper:   ZooKeeper (below kafka), dashed
```

**Layout note**: Producers on left → Kafka center → Consumers on right (left-to-right flow, not top-to-bottom for this pattern)

---

## 8. Three-Tier Web App (Simple — 5 nodes)

**Canvas**: 650 × 560

```
browser → nginx (LB) → app_server → postgres (DB)
                    ↓
                  redis (cache)
```

Perfect for simple requests or as a starting point to expand.

---

## Icon Quick Reference

```
🌐 Web Client    📱 Mobile      💻 Desktop
⚖️ Load Balancer 🔀 API Gateway  🌍 CDN
🟢 Service       🔐 Auth        📊 Analytics/Monitor
🗄️ SQL DB        📦 NoSQL DB    ⚡ Cache
📨 Queue/Kafka   💾 Storage     🔍 Search
💳 Payment       📧 Email       🔗 External
☁️ Cloud         🐳 Container   🤖 ML Model
```
