# Callison Electric Heating & Cooling – Service Portal

## Features
- Work order status control
- Leads pipeline by status: New · Contacted · Quoted · Converted · Lost
- Quo call webhook → Lead + Work Order
- Quo **call transcript / summary** → problem description, address hints, service type
- Quoted leads: automatic SMS follow-up after 3 days
- Photos, On-the-Way / Complete SMS

## Demo logins
admin@callison.com / admin123 · tech@callison.com / tech123 · customer@example.com / cust123

## Quo webhooks (Settings → Webhooks)
URL: `https://YOUR-RAILWAY-URL/api/webhooks/quo`

Subscribe to:
- call.completed, call.ringing, call.missed
- message.received (optional)
- **call.transcript.completed**
- **call.summary.completed**

Railway env: QUO_API_KEY, QUO_FROM_NUMBER, PORT=3001
