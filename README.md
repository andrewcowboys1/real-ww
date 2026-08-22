# Callison Electric Heating & Cooling – Service Portal

## What's in this version

- **Work order status control** – Admin and techs change status with a dropdown (scheduled → on the way → in progress → completed / cancelled)
- **Leads section** – Add leads, update status, convert to request or work order
- **No invoices** – Removed bill pay / invoices
- **Photos, SMS (Quo), customer scheduling** still included
- Brand colors match callisonelectrichvac.com (navy + gold)

## Demo logins

| Role       | Email                  | Password |
|------------|------------------------|----------|
| Admin      | admin@callison.com     | admin123 |
| Technician | tech@callison.com      | tech123  |
| Customer   | customer@example.com   | cust123  |

## Deploy

Upload these files to the **root** of your GitHub repo (not inside a folder):
- index.html, app.js, server.js, package.json

Set Railway variables: QUO_API_KEY, QUO_FROM_NUMBER, PORT=3001
