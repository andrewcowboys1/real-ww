# Callison Electric Heating & Cooling – Service Portal

## Features
- Work order status control (admin + tech dropdowns)
- Leads section with convert to job/request
- Photos, Quo SMS (on the way / complete / schedule)
- **Quo call webhook** → auto-create Lead + Work Order from incoming calls

## Demo logins
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@callison.com | admin123 |
| Tech | tech@callison.com | tech123 |
| Customer | customer@example.com | cust123 |

## Deploy (Railway + GitHub)
Upload these to the **root** of the repo (no folders):
- index.html, app.js, server.js, package.json

Railway variables:
- QUO_API_KEY
- QUO_FROM_NUMBER
- PORT=3001

## Quo call → Work order setup

1. Deploy the app and copy your public URL, e.g.  
   `https://real-ww-production-7a87.up.railway.app`

2. In Quo: **Settings → Webhooks → Create webhook**
   - URL: `https://YOUR-RAILWAY-URL/api/webhooks/quo`
   - Events: `call.completed`, `call.ringing`, `call.missed` (optional: `message.received`)
   - Resource: your business phone number(s)

3. When someone calls your Quo number:
   - App creates a **Lead** (source: Phone call)
   - App creates a **Work order** (status: scheduled, unassigned)
   - You assign a tech and set date in the Jobs tab

Matches existing customers by phone when possible.
