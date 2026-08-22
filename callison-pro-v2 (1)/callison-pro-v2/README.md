# Callison Electric & HVAC – Service Portal v2.1

## New in this version

### Customer features
- **Sign up / Sign in** – create account and log in
- **Schedule appointments** – pick service type, date, time, describe issue, attach photos
- **Pay bills** – view unpaid invoices and mark paid (Stripe-ready structure)
- **My Jobs** – see status of requests and work orders + photos

### Technician features
- **Photo capture** – take photos with phone camera or upload from gallery
- On the Way + SMS / Complete + SMS (Quo)
- Job notes

### Office / Admin
- Dashboard with pending requests, open jobs, unpaid balances
- Convert requests → work orders + assign tech
- Create and track invoices

## Deploy to Railway

1. Upload **all files** in this folder to your GitHub repo
2. Connect repo to Railway
3. Set environment variables:
   - `QUO_API_KEY`
   - `QUO_FROM_NUMBER` (e.g. +18043223358)
   - `PORT` = 3001
4. Generate public domain

## Demo logins

| Role       | Email                  | Password |
|------------|------------------------|----------|
| Admin      | admin@callison.com     | admin123 |
| Technician | tech@callison.com      | tech123  |
| Customer   | customer@example.com   | cust123  |
| Customer 2 | bob@example.com        | cust123  |

Bob has an unpaid invoice ($285) so you can test Pay Bills.

## Next: real card payments

The pay flow is ready for Stripe. Add Stripe Checkout or Payment Links and point the Pay button at the real payment URL.
