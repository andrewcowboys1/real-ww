/**
 * Callison Electric & HVAC – Service Portal v2.1
 * Photos • Customer scheduling • Bill pay • Quo SMS
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const QUO_API_KEY = process.env.QUO_API_KEY || '';
const QUO_FROM_NUMBER = process.env.QUO_FROM_NUMBER || '';
const DATA_FILE = path.join(__dirname, 'data.json');

app.use(cors());
app.use(express.json({ limit: '15mb' })); // photos as base64

function getDefaultData() {
  return {
    users: [
      { id: 'u1', email: 'admin@callison.com', password: 'admin123', name: 'Office Admin', role: 'admin', phone: '555-0100' },
      { id: 'u2', email: 'tech@callison.com', password: 'tech123', name: 'Mike Rivera', role: 'technician', phone: '555-0101' },
      { id: 'u3', email: 'tech2@callison.com', password: 'tech123', name: 'Sarah Chen', role: 'technician', phone: '555-0102' },
      { id: 'u4', email: 'customer@example.com', password: 'cust123', name: 'Jane Thompson', role: 'customer', phone: '555-0200', address: '142 Maple Ave, Brooklyn, NY 11201' },
      { id: 'u5', email: 'bob@example.com', password: 'cust123', name: 'Bob Martinez', role: 'customer', phone: '555-0201', address: '88 Oak Street, Queens, NY 11375' }
    ],
    equipment: [
      { id: 'eq1', customerId: 'u4', type: 'Heat Pump', brand: 'Goodman', model: 'GSZ160361BD', serial: '1901185633', location: 'Outdoor unit', installed: '2019', notes: '3-ton 16 SEER' },
      { id: 'eq2', customerId: 'u5', type: 'Electrical Panel', brand: 'Square D', model: 'QO120M100', serial: '', location: 'Basement', installed: '2015', notes: '100A main' }
    ],
    requests: [
      {
        id: 'SR-1001', customerId: 'u4', customerName: 'Jane Thompson', customerPhone: '555-0200',
        customerAddress: '142 Maple Ave, Brooklyn, NY 11201', serviceType: 'HVAC - Repair', urgency: 'high',
        description: 'AC not cooling, making loud noise on startup.', preferredDate: '2026-08-22',
        preferredTime: 'Morning (8am-12pm)', status: 'pending', createdAt: '2026-08-19T14:30:00Z', notes: '', equipmentId: 'eq1', photos: []
      }
    ],
    workOrders: [
      {
        id: 'WO-2001', requestId: null, customerId: 'u5', customerName: 'Bob Martinez', customerPhone: '555-0201',
        customerAddress: '88 Oak Street, Queens, NY 11375', serviceType: 'Electrical - Repair',
        description: 'Kitchen outlet not working, breaker keeps tripping.', urgency: 'normal',
        assignedTo: 'u2', assignedName: 'Mike Rivera', scheduledDate: '2026-08-21', scheduledTime: 'Afternoon (12pm-5pm)',
        status: 'scheduled', priority: 'normal', notes: 'Customer said it started after installing new fridge.',
        equipmentId: 'eq2', createdAt: '2026-08-18T10:00:00Z', updatedAt: '2026-08-18T10:00:00Z', photos: []
      },
      {
        id: 'WO-2002', requestId: null, customerId: 'u4', customerName: 'Jane Thompson', customerPhone: '555-0200',
        customerAddress: '142 Maple Ave, Brooklyn, NY 11201', serviceType: 'HVAC - Maintenance',
        description: 'Annual AC tune-up and filter change.', urgency: 'low',
        assignedTo: 'u3', assignedName: 'Sarah Chen', scheduledDate: '2026-08-20', scheduledTime: 'Morning (8am-12pm)',
        status: 'in_progress', priority: 'low', notes: '', equipmentId: 'eq1',
        createdAt: '2026-08-17T09:00:00Z', updatedAt: '2026-08-20T08:15:00Z', photos: []
      }
    ],
    invoices: [
      {
        id: 'INV-3001', customerId: 'u5', customerName: 'Bob Martinez', customerEmail: 'bob@example.com',
        workOrderId: 'WO-2001', description: 'Electrical repair – kitchen outlet & breaker',
        amount: 285.00, status: 'unpaid', dueDate: '2026-08-28',
        createdAt: '2026-08-21T12:00:00Z', paidAt: null, paymentMethod: null
      },
      {
        id: 'INV-3002', customerId: 'u4', customerName: 'Jane Thompson', customerEmail: 'customer@example.com',
        workOrderId: 'WO-2002', description: 'HVAC annual tune-up + filter',
        amount: 149.00, status: 'paid', dueDate: '2026-08-15',
        createdAt: '2026-08-15T16:00:00Z', paidAt: '2026-08-16T09:22:00Z', paymentMethod: 'card'
      }
    ],
    nextId: 2003,
    nextInvoiceId: 3003,
    smsLog: []
  };
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!d.invoices) d.invoices = getDefaultData().invoices;
      if (!d.nextInvoiceId) d.nextInvoiceId = 3003;
      return d;
    }
  } catch (e) { console.error(e.message); }
  const d = getDefaultData();
  saveData(d);
  return d;
}

function saveData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

async function sendQuoSMS({ to, content }) {
  if (!QUO_API_KEY || !QUO_FROM_NUMBER) {
    return { ok: false, simulated: true, message: 'Quo not configured', content, to };
  }
  let phone = String(to || '').replace(/\D/g, '');
  if (phone.length === 10) phone = '1' + phone;
  if (!phone.startsWith('+')) phone = '+' + phone;
  try {
    const res = await fetch('https://api.quo.com/v1/messages', {
      method: 'POST',
      headers: { 'Authorization': QUO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: content.slice(0, 1600), from: QUO_FROM_NUMBER, to: [phone] })
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: data.message || data.error || `HTTP ${res.status}`, status: res.status };
    return { ok: true, data };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

function buildMessage(type, wo, techName) {
  const first = (wo.customerName || 'Customer').split(' ')[0];
  const tech = techName || wo.assignedName || 'your technician';
  const map = {
    on_the_way: `Hi ${first}, this is ${tech} from Callison Electric & HVAC. I'm on my way for job ${wo.id} (${wo.serviceType}). See you soon!`,
    arrived: `Hi ${first}, ${tech} from Callison Electric & HVAC has arrived for job ${wo.id}.`,
    completed: `Hi ${first}, your Callison Electric & HVAC job ${wo.id} (${wo.serviceType}) is complete. Thank you!`,
    scheduled: `Hi ${first}, Callison Electric & HVAC: your ${wo.serviceType} is scheduled for ${wo.scheduledDate || 'soon'} ${wo.scheduledTime || ''}. Job #${wo.id}.`,
    reminder: `Reminder from Callison Electric & HVAC: ${wo.serviceType} on ${wo.scheduledDate || 'tomorrow'} ${wo.scheduledTime || ''}. Job #${wo.id}.`,
    invoice: `Hi ${first}, your invoice from Callison Electric & HVAC is ready. Amount due: $${(wo.amount || 0).toFixed(2)}. Log in to pay online.`
  };
  return map[type] || map.on_the_way;
}

// ---------- Auth ----------
app.post('/api/login', (req, res) => {
  const { email, password } = req.body || {};
  const data = loadData();
  const u = data.users.find(x => x.email.toLowerCase() === (email || '').toLowerCase() && x.password === password);
  if (!u) return res.status(401).json({ error: 'Invalid email or password' });
  const { password: _, ...safe } = u;
  res.json({ user: safe });
});

app.post('/api/register', (req, res) => {
  const { name, email, password, phone, address } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  const data = loadData();
  if (data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  const newUser = { id: 'u' + Date.now(), email, password, name, role: 'customer', phone: phone || '', address: address || '' };
  data.users.push(newUser);
  saveData(data);
  const { password: _, ...safe } = newUser;
  res.json({ user: safe });
});

app.get('/api/data', (req, res) => {
  const data = loadData();
  res.json({ ...data, users: data.users.map(({ password, ...u }) => u) });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', quoConfigured: Boolean(QUO_API_KEY && QUO_FROM_NUMBER), time: new Date().toISOString() });
});

// ---------- Service Requests (customer scheduling) ----------
app.post('/api/requests', (req, res) => {
  const data = loadData();
  const p = req.body || {};
  const item = {
    id: 'SR-' + Date.now(),
    customerId: p.customerId,
    customerName: p.customerName,
    customerPhone: p.customerPhone,
    customerAddress: p.customerAddress,
    serviceType: p.serviceType,
    urgency: p.urgency || 'normal',
    description: p.description || '',
    preferredDate: p.preferredDate,
    preferredTime: p.preferredTime,
    status: 'pending',
    createdAt: new Date().toISOString(),
    notes: '',
    equipmentId: p.equipmentId || null,
    photos: p.photos || []
  };
  data.requests.unshift(item);
  saveData(data);
  res.json(item);
});

// ---------- Work Orders ----------
app.post('/api/work-orders', (req, res) => {
  const data = loadData();
  const p = req.body || {};
  const tech = data.users.find(u => u.id === p.assignedTo);
  const wo = {
    id: 'WO-' + (data.nextId++),
    requestId: p.requestId || null,
    customerId: p.customerId || null,
    customerName: p.customerName,
    customerPhone: p.customerPhone,
    customerAddress: p.customerAddress,
    serviceType: p.serviceType,
    description: p.description || '',
    urgency: p.urgency || 'normal',
    assignedTo: p.assignedTo || null,
    assignedName: tech ? tech.name : null,
    scheduledDate: p.scheduledDate || null,
    scheduledTime: p.scheduledTime || 'Anytime',
    status: 'scheduled',
    priority: p.priority || 'normal',
    notes: p.notes || '',
    equipmentId: p.equipmentId || null,
    photos: p.photos || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.workOrders.unshift(wo);
  if (p.requestId) {
    const r = data.requests.find(x => x.id === p.requestId);
    if (r) { r.status = 'converted'; r.workOrderId = wo.id; }
  }
  if (p.sendSms) {
    sendQuoSMS({ to: wo.customerPhone, content: buildMessage('scheduled', wo, wo.assignedName) })
      .then(result => {
        data.smsLog = data.smsLog || [];
        data.smsLog.unshift({ id: uuidv4(), workOrderId: wo.id, type: 'scheduled', to: wo.customerPhone, result, sentAt: new Date().toISOString() });
        saveData(data);
      });
  }
  saveData(data);
  res.json(wo);
});

app.patch('/api/work-orders/:id', (req, res) => {
  const data = loadData();
  const wo = data.workOrders.find(w => w.id === req.params.id);
  if (!wo) return res.status(404).json({ error: 'Not found' });
  Object.assign(wo, req.body || {}, { updatedAt: new Date().toISOString() });
  if (req.body && req.body.assignedTo) {
    const tech = data.users.find(u => u.id === req.body.assignedTo);
    wo.assignedName = tech ? tech.name : null;
  }
  saveData(data);
  res.json(wo);
});

app.post('/api/work-orders/:id/note', (req, res) => {
  const data = loadData();
  const wo = data.workOrders.find(w => w.id === req.params.id);
  if (!wo) return res.status(404).json({ error: 'Not found' });
  const note = (req.body.note || '').trim();
  if (!note) return res.status(400).json({ error: 'Note required' });
  const stamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  wo.notes = (wo.notes ? wo.notes + '\n' : '') + `[${stamp}] ${note}`;
  wo.updatedAt = new Date().toISOString();
  saveData(data);
  res.json(wo);
});

// Photo upload (base64)
app.post('/api/work-orders/:id/photos', (req, res) => {
  const data = loadData();
  const wo = data.workOrders.find(w => w.id === req.params.id);
  if (!wo) return res.status(404).json({ error: 'Not found' });
  const { dataUrl, caption, takenBy } = req.body || {};
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return res.status(400).json({ error: 'Valid image dataUrl required' });
  }
  // Keep payload reasonable
  if (dataUrl.length > 2_500_000) {
    return res.status(400).json({ error: 'Image too large (max ~1.5MB)' });
  }
  wo.photos = wo.photos || [];
  const photo = {
    id: 'ph' + Date.now(),
    dataUrl,
    caption: caption || '',
    takenBy: takenBy || 'Staff',
    createdAt: new Date().toISOString()
  };
  wo.photos.push(photo);
  wo.updatedAt = new Date().toISOString();
  saveData(data);
  res.json(photo);
});

app.post('/api/requests/:id/photos', (req, res) => {
  const data = loadData();
  const r = data.requests.find(x => x.id === req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const { dataUrl, caption } = req.body || {};
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return res.status(400).json({ error: 'Valid image dataUrl required' });
  }
  if (dataUrl.length > 2_500_000) return res.status(400).json({ error: 'Image too large' });
  r.photos = r.photos || [];
  const photo = { id: 'ph' + Date.now(), dataUrl, caption: caption || '', createdAt: new Date().toISOString() };
  r.photos.push(photo);
  saveData(data);
  res.json(photo);
});

app.post('/api/work-orders/:id/status', async (req, res) => {
  const data = loadData();
  const wo = data.workOrders.find(w => w.id === req.params.id);
  if (!wo) return res.status(404).json({ error: 'Not found' });

  const { status, techName, sendSms } = req.body || {};
  const tech = techName || wo.assignedName || 'Technician';
  const stamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

  if (status) {
    wo.status = status;
    wo.updatedAt = new Date().toISOString();
    wo.notes = (wo.notes ? wo.notes + '\n' : '') + `[${stamp}] Status → ${status.replace(/_/g, ' ')} by ${tech}`;
  }

  let smsResult = null;
  if (sendSms && ['on_the_way', 'arrived', 'completed', 'scheduled', 'reminder'].includes(sendSms)) {
    const content = buildMessage(sendSms, wo, tech);
    smsResult = await sendQuoSMS({ to: wo.customerPhone, content });
    data.smsLog = data.smsLog || [];
    data.smsLog.unshift({
      id: uuidv4(), workOrderId: wo.id, type: sendSms, to: wo.customerPhone,
      content, result: smsResult, sentAt: new Date().toISOString()
    });
    wo.notes += `\n[${stamp}] SMS (${sendSms}) sent`;
  }

  // Auto-create invoice when completed (if none exists)
  if (status === 'completed') {
    const existing = (data.invoices || []).find(inv => inv.workOrderId === wo.id);
    if (!existing) {
      const inv = {
        id: 'INV-' + (data.nextInvoiceId++),
        customerId: wo.customerId,
        customerName: wo.customerName,
        customerEmail: (data.users.find(u => u.id === wo.customerId) || {}).email || '',
        workOrderId: wo.id,
        description: wo.serviceType + (wo.description ? ' – ' + wo.description.slice(0, 80) : ''),
        amount: 0, // office can edit later
        status: 'unpaid',
        dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
        createdAt: new Date().toISOString(),
        paidAt: null,
        paymentMethod: null
      };
      data.invoices = data.invoices || [];
      data.invoices.unshift(inv);
    }
  }

  saveData(data);
  res.json({ workOrder: wo, sms: smsResult });
});

// ---------- Invoices & Pay ----------
app.get('/api/invoices', (req, res) => {
  const data = loadData();
  const customerId = req.query.customerId;
  let list = data.invoices || [];
  if (customerId) list = list.filter(i => i.customerId === customerId);
  res.json(list);
});

app.post('/api/invoices', (req, res) => {
  const data = loadData();
  const p = req.body || {};
  const inv = {
    id: 'INV-' + (data.nextInvoiceId++),
    customerId: p.customerId,
    customerName: p.customerName,
    customerEmail: p.customerEmail || '',
    workOrderId: p.workOrderId || null,
    description: p.description || 'Service',
    amount: Number(p.amount) || 0,
    status: 'unpaid',
    dueDate: p.dueDate || new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
    paidAt: null,
    paymentMethod: null
  };
  data.invoices = data.invoices || [];
  data.invoices.unshift(inv);
  saveData(data);
  res.json(inv);
});

app.patch('/api/invoices/:id', (req, res) => {
  const data = loadData();
  const inv = (data.invoices || []).find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  Object.assign(inv, req.body || {});
  saveData(data);
  res.json(inv);
});

// Mark invoice paid (demo + real structure for Stripe later)
app.post('/api/invoices/:id/pay', (req, res) => {
  const data = loadData();
  const inv = (data.invoices || []).find(i => i.id === req.params.id);
  if (!inv) return res.status(404).json({ error: 'Not found' });
  if (inv.status === 'paid') return res.json({ invoice: inv, message: 'Already paid' });

  const method = (req.body && req.body.method) || 'card';
  inv.status = 'paid';
  inv.paidAt = new Date().toISOString();
  inv.paymentMethod = method;
  saveData(data);
  res.json({ invoice: inv, message: 'Payment recorded. Thank you!' });
});

// Equipment
app.get('/api/equipment/:customerId', (req, res) => {
  const data = loadData();
  res.json((data.equipment || []).filter(e => e.customerId === req.params.customerId));
});

app.post('/api/equipment', (req, res) => {
  const data = loadData();
  const p = req.body || {};
  const eq = {
    id: 'eq' + Date.now(),
    customerId: p.customerId,
    type: p.type || 'Equipment',
    brand: p.brand || '',
    model: p.model || '',
    serial: p.serial || '',
    location: p.location || '',
    installed: p.installed || '',
    notes: p.notes || ''
  };
  data.equipment = data.equipment || [];
  data.equipment.push(eq);
  saveData(data);
  res.json(eq);
});

// Static + SPA fallback
app.use(express.static(__dirname));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nCallison Electric & HVAC v2.1 on port ${PORT}`);
  console.log(`Quo SMS: ${QUO_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED (simulated)'}`);
  console.log(`From: ${QUO_FROM_NUMBER || '(not set)'}\n`);
});
