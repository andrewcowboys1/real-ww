/**
 * Callison Electric & HVAC Backend
 * Handles work orders + Quo SMS notifications
 *
 * Setup:
 * 1. Copy .env.example to .env
 * 2. Add your Quo API key and phone number
 * 3. npm install
 * 4. npm start
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// ========== CONFIG ==========
const QUO_API_KEY = process.env.QUO_API_KEY || '';
const QUO_FROM_NUMBER = process.env.QUO_FROM_NUMBER || ''; // e.g. +15551234567
const DATA_FILE = path.join(__dirname, 'data.json');

// ========== MIDDLEWARE ==========
app.use(cors());
app.use(express.json());

// ========== SIMPLE DATA STORE ==========
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error loading data:', e.message);
  }
  return getDefaultData();
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function getDefaultData() {
  return {
    users: [
      { id: 'u1', email: 'admin@callison.com', password: 'admin123', name: 'Office Admin', role: 'admin', phone: '555-0100' },
      { id: 'u2', email: 'tech@callison.com', password: 'tech123', name: 'Mike Rivera', role: 'technician', phone: '555-0101' },
      { id: 'u3', email: 'tech2@callison.com', password: 'tech123', name: 'Sarah Chen', role: 'technician', phone: '555-0102' },
      { id: 'u4', email: 'customer@example.com', password: 'cust123', name: 'Jane Thompson', role: 'customer', phone: '555-0200', address: '142 Maple Ave, Brooklyn, NY 11201' },
      { id: 'u5', email: 'bob@example.com', password: 'cust123', name: 'Bob Martinez', role: 'customer', phone: '555-0201', address: '88 Oak Street, Queens, NY 11375' }
    ],
    requests: [
      {
        id: 'SR-1001',
        customerId: 'u4',
        customerName: 'Jane Thompson',
        customerPhone: '555-0200',
        customerAddress: '142 Maple Ave, Brooklyn, NY 11201',
        serviceType: 'HVAC - Repair',
        urgency: 'high',
        description: 'AC not cooling, making loud noise on startup.',
        preferredDate: '2026-08-22',
        preferredTime: 'Morning (8am-12pm)',
        status: 'pending',
        createdAt: '2026-08-19T14:30:00Z',
        notes: ''
      }
    ],
    workOrders: [
      {
        id: 'WO-2001',
        requestId: null,
        customerId: 'u5',
        customerName: 'Bob Martinez',
        customerPhone: '555-0201',
        customerAddress: '88 Oak Street, Queens, NY 11375',
        serviceType: 'Electrical - Repair',
        description: 'Kitchen outlet not working, breaker keeps tripping.',
        urgency: 'normal',
        assignedTo: 'u2',
        assignedName: 'Mike Rivera',
        scheduledDate: '2026-08-21',
        scheduledTime: 'Afternoon (12pm-5pm)',
        status: 'scheduled',
        priority: 'normal',
        notes: 'Customer said it started after installing new fridge.',
        createdAt: '2026-08-18T10:00:00Z',
        updatedAt: '2026-08-18T10:00:00Z'
      },
      {
        id: 'WO-2002',
        requestId: null,
        customerId: 'u4',
        customerName: 'Jane Thompson',
        customerPhone: '555-0200',
        customerAddress: '142 Maple Ave, Brooklyn, NY 11201',
        serviceType: 'HVAC - Maintenance',
        description: 'Annual AC tune-up and filter change.',
        urgency: 'low',
        assignedTo: 'u3',
        assignedName: 'Sarah Chen',
        scheduledDate: '2026-08-20',
        scheduledTime: 'Morning (8am-12pm)',
        status: 'in_progress',
        priority: 'low',
        notes: '',
        createdAt: '2026-08-17T09:00:00Z',
        updatedAt: '2026-08-20T08:15:00Z'
      }
    ],
    nextId: 2003,
    smsLog: []
  };
}

// ========== QUO SMS ==========
async function sendQuoSMS({ to, content, from = QUO_FROM_NUMBER }) {
  if (!QUO_API_KEY) {
    return {
      ok: false,
      simulated: true,
      message: 'QUO_API_KEY not set. SMS simulated only.',
      content,
      to
    };
  }

  if (!from) {
    return { ok: false, error: 'QUO_FROM_NUMBER not configured' };
  }

  // Normalize phone to E.164 if possible
  let phone = String(to).replace(/\D/g, '');
  if (phone.length === 10) phone = '1' + phone;
  if (!phone.startsWith('+')) phone = '+' + phone;

  try {
    const res = await fetch('https://api.quo.com/v1/messages', {
      method: 'POST',
      headers: {
        'Authorization': QUO_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        content: content.slice(0, 1600),
        from: from,
        to: [phone]
      })
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Quo API error:', res.status, data);
      return { ok: false, error: data.message || data.error || `HTTP ${res.status}`, status: res.status };
    }

    return { ok: true, data };
  } catch (err) {
    console.error('Quo SMS error:', err.message);
    return { ok: false, error: err.message };
  }
}

// ========== AUTH (simple) ==========
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const data = loadData();
  const user = data.users.find(
    u => u.email.toLowerCase() === (email || '').toLowerCase() && u.password === password
  );
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  const { password: _, ...safeUser } = user;
  res.json({ user: safeUser });
});

app.post('/api/register', (req, res) => {
  const { name, email, password, phone, address } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'Name, email and password required' });
  }
  const data = loadData();
  if (data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  const newUser = {
    id: 'u' + Date.now(),
    email,
    password,
    name,
    role: 'customer',
    phone: phone || '',
    address: address || ''
  };
  data.users.push(newUser);
  saveData(data);
  const { password: _, ...safeUser } = newUser;
  res.json({ user: safeUser });
});

// ========== DATA ==========
app.get('/api/data', (req, res) => {
  const data = loadData();
  // Don't send passwords
  const safe = {
    ...data,
    users: data.users.map(({ password, ...u }) => u)
  };
  res.json(safe);
});

app.post('/api/requests', (req, res) => {
  const data = loadData();
  const payload = req.body;
  const reqItem = {
    id: 'SR-' + Date.now(),
    customerId: payload.customerId,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerAddress: payload.customerAddress,
    serviceType: payload.serviceType,
    urgency: payload.urgency || 'normal',
    description: payload.description,
    preferredDate: payload.preferredDate,
    preferredTime: payload.preferredTime,
    status: 'pending',
    createdAt: new Date().toISOString(),
    notes: ''
  };
  data.requests.unshift(reqItem);
  saveData(data);
  res.json(reqItem);
});

app.post('/api/work-orders', (req, res) => {
  const data = loadData();
  const payload = req.body;
  const tech = data.users.find(u => u.id === payload.assignedTo);
  const wo = {
    id: 'WO-' + (data.nextId++),
    requestId: payload.requestId || null,
    customerId: payload.customerId || null,
    customerName: payload.customerName,
    customerPhone: payload.customerPhone,
    customerAddress: payload.customerAddress,
    serviceType: payload.serviceType,
    description: payload.description || '',
    urgency: payload.urgency || 'normal',
    assignedTo: payload.assignedTo || null,
    assignedName: tech ? tech.name : null,
    scheduledDate: payload.scheduledDate || null,
    scheduledTime: payload.scheduledTime || 'Anytime',
    status: 'scheduled',
    priority: payload.priority || 'normal',
    notes: payload.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.workOrders.unshift(wo);

  // If converting a request
  if (payload.requestId) {
    const r = data.requests.find(x => x.id === payload.requestId);
    if (r) {
      r.status = 'converted';
      r.workOrderId = wo.id;
    }
  }

  saveData(data);
  res.json(wo);
});

app.patch('/api/work-orders/:id', (req, res) => {
  const data = loadData();
  const wo = data.workOrders.find(w => w.id === req.params.id);
  if (!wo) return res.status(404).json({ error: 'Work order not found' });

  const updates = req.body;
  Object.assign(wo, updates, { updatedAt: new Date().toISOString() });

  if (updates.assignedTo) {
    const tech = data.users.find(u => u.id === updates.assignedTo);
    wo.assignedName = tech ? tech.name : null;
  }

  saveData(data);
  res.json(wo);
});

app.post('/api/work-orders/:id/note', (req, res) => {
  const data = loadData();
  const wo = data.workOrders.find(w => w.id === req.params.id);
  if (!wo) return res.status(404).json({ error: 'Work order not found' });

  const note = (req.body.note || '').trim();
  if (!note) return res.status(400).json({ error: 'Note required' });

  const stamp = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
  wo.notes = (wo.notes ? wo.notes + '\n' : '') + `[${stamp}] ${note}`;
  wo.updatedAt = new Date().toISOString();
  saveData(data);
  res.json(wo);
});

// ========== ON THE WAY + QUO SMS ==========
app.post('/api/work-orders/:id/on-the-way', async (req, res) => {
  const data = loadData();
  const wo = data.workOrders.find(w => w.id === req.params.id);
  if (!wo) return res.status(404).json({ error: 'Work order not found' });

  const techName = req.body.techName || wo.assignedName || 'Your technician';
  const customerFirst = (wo.customerName || 'Customer').split(' ')[0];

  // Update status
  wo.status = 'on_the_way';
  const stamp = new Date().toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit'
  });
  wo.notes = (wo.notes ? wo.notes + '\n' : '') +
    `[${stamp}] ${techName} marked On the Way and SMS sent to customer.`;
  wo.updatedAt = new Date().toISOString();

  // Build message
  const message =
    `Hi ${customerFirst}, this is ${techName} from Callison Electric & HVAC. ` +
    `I'm on my way to your location for job ${wo.id} (${wo.serviceType}). See you soon!`;

  // Send via Quo
  const smsResult = await sendQuoSMS({
    to: wo.customerPhone,
    content: message
  });

  // Log it
  data.smsLog = data.smsLog || [];
  data.smsLog.unshift({
    id: uuidv4(),
    workOrderId: wo.id,
    to: wo.customerPhone,
    content: message,
    result: smsResult,
    sentAt: new Date().toISOString()
  });

  saveData(data);

  res.json({
    workOrder: wo,
    sms: smsResult
  });
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    quoConfigured: Boolean(QUO_API_KEY && QUO_FROM_NUMBER),
    time: new Date().toISOString()
  });
});

// Serve the website files
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`\nCallison backend running on http://localhost:${PORT}`);
  console.log(`Quo SMS: ${QUO_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED (simulated)'}`);
  console.log(`From number: ${QUO_FROM_NUMBER || '(not set)'}\n`);
});