/**
 * Callison Electric Heating & Cooling – Service Portal
 * Work orders · Leads · Photos · Quo SMS
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
app.use(express.json({ limit: '15mb' }));

function getDefaultData() {
  return {
    users: [
      { id: 'u1', email: 'admin@callison.com', password: 'admin123', name: 'Office Admin', role: 'admin', phone: '555-0100' },
      { id: 'u2', email: 'tech@callison.com', password: 'tech123', name: 'Callison', role: 'technician', phone: '555-0101', van: 'Van #1' },
      { id: 'u3', email: 'tech2@callison.com', password: 'tech123', name: 'Employee Van #2', role: 'technician', phone: '555-0102', van: 'Van #2' },
      { id: 'u4', email: 'customer@example.com', password: 'cust123', name: 'Jane Thompson', role: 'customer', phone: '555-0200', address: '142 Maple Ave, Staunton, VA 24401' },
      { id: 'u5', email: 'bob@example.com', password: 'cust123', name: 'Bob Martinez', role: 'customer', phone: '555-0201', address: '88 Oak Street, Waynesboro, VA 22980' }
    ],
    equipment: [
      { id: 'eq1', customerId: 'u4', type: 'Heat Pump', brand: 'Goodman', model: 'GSZ160361BD', serial: '1901185633', location: 'Outdoor unit', installed: '2019', notes: '3-ton 16 SEER' },
      { id: 'eq2', customerId: 'u5', type: 'Electrical Panel', brand: 'Square D', model: 'QO120M100', serial: '', location: 'Basement', installed: '2015', notes: '100A main' }
    ],
    leads: [
      {
        id: 'LD-1001', name: 'Carol Whitman', phone: '540-555-0199', email: 'carol@email.com',
        address: '210 Main St, Staunton, VA', source: 'Google', serviceInterest: 'HVAC - Install',
        notes: 'Asked about heat pump quote for 2-story home', status: 'new',
        createdAt: '2026-08-20T14:00:00Z', updatedAt: '2026-08-20T14:00:00Z'
      },
      {
        id: 'LD-1002', name: 'Tom Bradley', phone: '540-555-0144', email: '',
        address: 'Augusta County', source: 'Referral', serviceInterest: 'Electrical - Panel Upgrade',
        notes: 'Neighbor recommended us. Wants estimate next week.', status: 'contacted',
        createdAt: '2026-08-19T10:30:00Z', updatedAt: '2026-08-21T09:00:00Z'
      }
    ],
    requests: [
      {
        id: 'SR-1001', customerId: 'u4', customerName: 'Jane Thompson', customerPhone: '555-0200',
        customerAddress: '142 Maple Ave, Staunton, VA 24401', serviceType: 'HVAC - Repair', urgency: 'high',
        description: 'AC not cooling, making loud noise on startup.', preferredDate: '2026-08-22',
        preferredTime: 'Morning (8am-12pm)', status: 'pending', createdAt: '2026-08-19T14:30:00Z', notes: '', equipmentId: 'eq1', photos: []
      }
    ],
    workOrders: [
      {
        id: 'WO-2001', requestId: null, customerId: 'u5', customerName: 'Bob Martinez', customerPhone: '555-0201',
        customerAddress: '88 Oak Street, Waynesboro, VA 22980', serviceType: 'Electrical - Repair',
        description: 'Kitchen outlet not working, breaker keeps tripping.', urgency: 'normal',
        assignedTo: 'u2', assignedName: 'Callison', scheduledDate: '2026-08-21', scheduledTime: 'Afternoon (12pm-5pm)',
        status: 'scheduled', priority: 'normal', notes: 'Customer said it started after installing new fridge.',
        equipmentId: 'eq2', createdAt: '2026-08-18T10:00:00Z', updatedAt: '2026-08-18T10:00:00Z', photos: []
      },
      {
        id: 'WO-2002', requestId: null, customerId: 'u4', customerName: 'Jane Thompson', customerPhone: '555-0200',
        customerAddress: '142 Maple Ave, Staunton, VA 24401', serviceType: 'HVAC - Maintenance',
        description: 'Annual AC tune-up and filter change.', urgency: 'low',
        assignedTo: 'u3', assignedName: 'Employee Van #2', scheduledDate: '2026-08-20', scheduledTime: 'Morning (8am-12pm)',
        status: 'in_progress', priority: 'low', notes: '', equipmentId: 'eq1',
        createdAt: '2026-08-17T09:00:00Z', updatedAt: '2026-08-20T08:15:00Z', photos: []
      }
    ],
    nextId: 2003,
    nextLeadId: 1003,
    smsLog: []
  };
}

function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const d = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
      if (!d.leads) d.leads = getDefaultData().leads;
      if (!d.nextLeadId) d.nextLeadId = 1003;
      // Drop invoices if present from older versions
      delete d.invoices;
      delete d.nextInvoiceId;
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

/** Look up email/name from Quo contacts by matching phone digits */
async function lookupQuoContactByPhone(phone) {
  if (!QUO_API_KEY || !phone) return null;
  const target = String(phone).replace(/\D/g, '').slice(-10);
  if (target.length < 10) return null;
  try {
    let pageToken = null;
    for (let page = 0; page < 5; page++) {
      const url = new URL('https://api.quo.com/v1/contacts');
      url.searchParams.set('maxResults', '50');
      if (pageToken) url.searchParams.set('pageToken', pageToken);
      const res = await fetch(url.toString(), {
        headers: { Authorization: QUO_API_KEY }
      });
      if (!res.ok) break;
      const json = await res.json().catch(() => ({}));
      const list = json.data || json.contacts || [];
      for (const c of list) {
        const fields = c.defaultFields || c;
        const phones = fields.phoneNumbers || fields.phones || [];
        const match = phones.some(p => String(p.value || p).replace(/\D/g, '').slice(-10) === target);
        if (match) {
          const emails = fields.emails || [];
          const email = (emails[0] && (emails[0].value || emails[0])) || fields.email || '';
          const name = [fields.firstName, fields.lastName].filter(Boolean).join(' ') || fields.name || '';
          return { email: String(email || ''), name, company: fields.company || '', contactId: c.id };
        }
      }
      pageToken = json.nextPageToken || null;
      if (!pageToken) break;
    }
  } catch (e) {
    console.error('[Quo contact lookup]', e.message);
  }
  return null;
}

function buildMessage(type, wo, techName) {
  const first = (wo.customerName || 'Customer').split(' ')[0];
  const tech = techName || wo.assignedName || 'your technician';
  const map = {
    on_the_way: `Hi ${first}, this is ${tech} from Callison Electric Heating & Cooling. I'm on my way for job ${wo.id} (${wo.serviceType}). See you soon!`,
    arrived: `Hi ${first}, ${tech} from Callison has arrived for job ${wo.id}.`,
    completed: `Hi ${first}, your Callison job ${wo.id} (${wo.serviceType}) is complete. Thank you!`,
    scheduled: `Hi ${first}, Callison: your ${wo.serviceType} is scheduled for ${wo.scheduledDate || 'soon'} ${wo.scheduledTime || ''}. Job #${wo.id}.`,
    reminder: `Reminder from Callison: ${wo.serviceType} on ${wo.scheduledDate || 'tomorrow'} ${wo.scheduledTime || ''}. Job #${wo.id}.`
  };
  return map[type] || map.on_the_way;
}

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

/** Send follow-up SMS for quoted leads whose followUpAt is due */
async function processLeadFollowUps() {
  const data = loadData();
  const now = Date.now();
  let changed = false;
  for (const lead of (data.leads || [])) {
    if (lead.status !== 'quoted') continue;
    if (!lead.followUpAt) continue;
    if (lead.followUpSent) continue;
    if (new Date(lead.followUpAt).getTime() > now) continue;
    if (!lead.phone) {
      lead.followUpSent = true;
      lead.notes = (lead.notes || '') + `\n[${new Date().toLocaleString()}] Follow-up due (no phone — skipped SMS)`;
      changed = true;
      continue;
    }
    const first = (lead.name || 'there').split(' ')[0];
    const content = `Hi ${first}, this is Callison Electric Heating & Cooling following up on your quote for ${lead.serviceInterest || 'service'}. Reply or call us when you're ready — we're happy to help!`;
    const smsResult = await sendQuoSMS({ to: lead.phone, content });
    lead.followUpSent = true;
    lead.followUpSentAt = new Date().toISOString();
    lead.notes = (lead.notes || '') + `\n[${new Date().toLocaleString()}] Auto follow-up SMS ${smsResult.ok || smsResult.simulated ? 'sent' : 'failed'}`;
    data.smsLog = data.smsLog || [];
    data.smsLog.unshift({
      id: uuidv4(), type: 'lead_followup', leadId: lead.id, to: lead.phone,
      content, result: smsResult, sentAt: new Date().toISOString()
    });
    changed = true;
    console.log(`[Follow-up] Lead ${lead.id} → ${lead.phone}`);
  }
  if (changed) saveData(data);
  return changed;
}

// Run follow-up check every 30 minutes
setInterval(() => { processLeadFollowUps().catch(() => {}); }, 30 * 60 * 1000);
setTimeout(() => { processLeadFollowUps().catch(() => {}); }, 15000);

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
  const { name, email, password, phone, address, role, staffCode } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password required' });
  const data = loadData();
  if (data.users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'Email already registered' });
  }
  let userRole = 'customer';
  if (role === 'technician' || role === 'admin') {
    const expected = process.env.STAFF_SIGNUP_CODE || 'CALLISON2026';
    if ((staffCode || '').trim() !== expected) {
      return res.status(403).json({ error: 'Invalid staff signup code' });
    }
    userRole = role;
  }
  const newUser = {
    id: 'u' + Date.now(), email, password, name, role: userRole,
    phone: phone || '', address: address || ''
  };
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

// ---------- Leads ----------
app.get('/api/leads', (req, res) => {
  const data = loadData();
  res.json(data.leads || []);
});

app.post('/api/leads', (req, res) => {
  const data = loadData();
  const p = req.body || {};
  const lead = {
    id: 'LD-' + (data.nextLeadId++),
    name: p.name || '',
    phone: p.phone || '',
    email: p.email || '',
    address: p.address || '',
    source: p.source || 'Other',
    serviceInterest: p.serviceInterest || '',
    notes: p.notes || '',
    status: p.status || 'new',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  data.leads = data.leads || [];
  data.leads.unshift(lead);
  saveData(data);
  res.json(lead);
});

app.patch('/api/leads/:id', (req, res) => {
  const data = loadData();
  const lead = (data.leads || []).find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  const prevStatus = lead.status;
  Object.assign(lead, req.body || {}, { updatedAt: new Date().toISOString() });
  // When marked quoted → schedule auto follow-up in 3 days
  if (lead.status === 'quoted' && prevStatus !== 'quoted') {
    lead.followUpAt = addDaysISO(3);
    lead.followUpSent = false;
    lead.notes = (lead.notes || '') + `\n[${new Date().toLocaleString()}] Status → quoted · auto follow-up set for 3 days`;
  }
  if (lead.status !== 'quoted') {
    // clear pending follow-up if no longer quoted
    if (prevStatus === 'quoted' && !lead.followUpSent) {
      lead.followUpAt = null;
    }
  }
  saveData(data);
  res.json(lead);
});

app.post('/api/leads/process-followups', async (req, res) => {
  await processLeadFollowUps();
  res.json({ ok: true });
});

app.delete('/api/leads/:id', (req, res) => {
  const data = loadData();
  data.leads = (data.leads || []).filter(l => l.id !== req.params.id);
  saveData(data);
  res.json({ ok: true });
});

// Convert lead → service request or work order
app.post('/api/leads/:id/convert', async (req, res) => {
  const data = loadData();
  const lead = (data.leads || []).find(l => l.id === req.params.id);
  if (!lead) return res.status(404).json({ error: 'Not found' });
  if (lead.status === 'converted') return res.status(400).json({ error: 'Lead already converted' });

  const { to = 'request', assignedTo, scheduledDate, scheduledTime, sendSms } = req.body || {};

  if (to === 'work_order') {
    const tech = data.users.find(u => u.id === assignedTo);
    const wo = {
      id: 'WO-' + (data.nextId++),
      requestId: null,
      leadId: lead.id,
      customerId: null,
      customerName: lead.name,
      customerPhone: lead.phone,
      customerAddress: lead.address,
      serviceType: lead.serviceInterest || 'Service',
      description: lead.notes || '',
      urgency: 'normal',
      assignedTo: assignedTo || null,
      assignedName: tech ? tech.name : null,
      scheduledDate: scheduledDate || null,
      scheduledTime: scheduledTime || 'Anytime',
      status: 'scheduled',
      priority: 'normal',
      notes: `Converted from lead ${lead.id}`,
      photos: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    wo.googleCalendarLink = buildGoogleCalendarLink(wo);
    data.workOrders.unshift(wo);
    lead.status = 'converted';
    lead.convertedTo = 'work_order';
    lead.convertedId = wo.id;
    lead.updatedAt = new Date().toISOString();

    let smsResult = null;
    if (sendSms && wo.customerPhone) {
      smsResult = await sendQuoSMS({ to: wo.customerPhone, content: buildMessage('scheduled', wo, wo.assignedName) });
      data.smsLog = data.smsLog || [];
      data.smsLog.unshift({
        id: uuidv4(), workOrderId: wo.id, type: 'scheduled', to: wo.customerPhone,
        result: smsResult, sentAt: new Date().toISOString()
      });
      const stamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      wo.notes += `\n[${stamp}] Schedule SMS sent on convert`;
    }

    saveData(data);
    return res.json({ workOrder: wo, lead, sms: smsResult });
  }

  // Convert to service request
  const reqItem = {
    id: 'SR-' + Date.now(),
    leadId: lead.id,
    customerId: null,
    customerName: lead.name,
    customerPhone: lead.phone,
    customerAddress: lead.address,
    serviceType: lead.serviceInterest || 'Service',
    urgency: 'normal',
    description: lead.notes || '',
    preferredDate: scheduledDate || '',
    preferredTime: scheduledTime || 'Anytime',
    status: 'pending',
    createdAt: new Date().toISOString(),
    notes: `From lead ${lead.id}`,
    photos: []
  };
  data.requests.unshift(reqItem);
  lead.status = 'converted';
  lead.convertedTo = 'request';
  lead.convertedId = reqItem.id;
  lead.updatedAt = new Date().toISOString();
  saveData(data);
  res.json({ request: reqItem, lead });
});

// ---------- Service Requests ----------
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
/** Google Calendar "create event" link (opens pre-filled event in user's Google Calendar) */
function buildGoogleCalendarLink(wo) {
  const title = encodeURIComponent(`${wo.serviceType || 'Service'} – ${wo.customerName || 'Customer'} (${wo.id})`);
  const details = encodeURIComponent(
    [
      wo.description || '',
      wo.customerPhone ? `Phone: ${wo.customerPhone}` : '',
      wo.assignedName ? `Tech: ${wo.assignedName}` : '',
      wo.notes ? `Notes: ${wo.notes}` : ''
    ].filter(Boolean).join('\n')
  );
  const location = encodeURIComponent(wo.customerAddress || '');
  let dates = '';
  if (wo.scheduledDate) {
    // All-day style YYYYMMDD / next day
    const d = String(wo.scheduledDate).replace(/-/g, '');
    if (/^\d{8}$/.test(d)) {
      const next = new Date(wo.scheduledDate + 'T12:00:00');
      next.setDate(next.getDate() + 1);
      const d2 = next.toISOString().slice(0, 10).replace(/-/g, '');
      dates = `${d}/${d2}`;
    }
  }
  if (!dates) {
    // Fallback: tomorrow all-day so link still works
    const t = new Date();
    t.setDate(t.getDate() + 1);
    const d = t.toISOString().slice(0, 10).replace(/-/g, '');
    const t2 = new Date(t); t2.setDate(t2.getDate() + 1);
    const d2 = t2.toISOString().slice(0, 10).replace(/-/g, '');
    dates = `${d}/${d2}`;
  }
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${dates}`;
}

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
    status: p.status || 'scheduled',
    priority: p.priority || 'normal',
    notes: p.notes || '',
    equipmentId: p.equipmentId || null,
    photos: p.photos || [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  wo.googleCalendarLink = buildGoogleCalendarLink(wo);
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
  const prevStatus = wo.status;
  Object.assign(wo, req.body || {}, { updatedAt: new Date().toISOString() });
  if (req.body && req.body.assignedTo) {
    const tech = data.users.find(u => u.id === req.body.assignedTo);
    wo.assignedName = tech ? tech.name : null;
  }
  if (req.body && req.body.status && req.body.status !== prevStatus) {
    const stamp = new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
    wo.notes = (wo.notes ? wo.notes + '\n' : '') + `[${stamp}] Status → ${req.body.status.replace(/_/g, ' ')}`;
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

app.post('/api/work-orders/:id/photos', (req, res) => {
  const data = loadData();
  const wo = data.workOrders.find(w => w.id === req.params.id);
  if (!wo) return res.status(404).json({ error: 'Not found' });
  const { dataUrl, caption, takenBy } = req.body || {};
  if (!dataUrl || !dataUrl.startsWith('data:image')) {
    return res.status(400).json({ error: 'Valid image dataUrl required' });
  }
  if (dataUrl.length > 2_500_000) return res.status(400).json({ error: 'Image too large' });
  wo.photos = wo.photos || [];
  const photo = { id: 'ph' + Date.now(), dataUrl, caption: caption || '', takenBy: takenBy || 'Staff', createdAt: new Date().toISOString() };
  wo.photos.push(photo);
  wo.updatedAt = new Date().toISOString();
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

  saveData(data);
  res.json({ workOrder: wo, sms: smsResult });
});

app.get('/api/equipment/:customerId', (req, res) => {
  const data = loadData();
  res.json((data.equipment || []).filter(e => e.customerId === req.params.customerId));
});

// ---------- Quo call / message webhooks ----------
// Point Quo → Webhooks to: https://YOUR-RAILWAY-URL/api/webhooks/quo
// Events: call.completed, call.ringing, call.missed, message.received,
//         call.transcript.completed, call.summary.completed
function normalizePhone(p) {
  if (!p) return '';
  let s = String(p).replace(/\D/g, '');
  if (s.length === 11 && s.startsWith('1')) s = s.slice(1);
  if (s.length === 10) return `(${s.slice(0,3)}) ${s.slice(3,6)}-${s.slice(6)}`;
  return p;
}

function extractCallInfo(body) {
  const type = body.type || body.event || '';
  const obj = body.data?.object || body.data?.resource || body.object || body.data || {};
  const ctx = body.data?.context || {};
  const direction = obj.direction || ctx.direction || '';
  const participants = ctx.participants || {};
  const external = (participants.external && participants.external[0]) || '';
  const from = obj.from || ctx.senderIdentifier || ctx.from || external || body.from || '';
  const to = obj.to || (ctx.recipientIdentifiers && ctx.recipientIdentifiers[0]) || body.to || '';
  const status = obj.status || obj.processingStatus || '';
  const callId = obj.callId || obj.id || body.id || '';
  const voicemail = obj.voicemail || null;
  const dialogue = obj.dialogue || null;
  const summary = obj.summary || obj.text || obj.content || null;
  return { type, direction, from, to, status, callId, voicemail, dialogue, summary, raw: body };
}

/** Pull problem description + address hints from transcript text */
function parseTranscriptHints(fullText) {
  const text = (fullText || '').replace(/\s+/g, ' ').trim();
  if (!text) return {};
  const hints = { problem: '', address: '', serviceInterest: '' };

  // Address-ish patterns
  const addrMatch = text.match(
    /\b(\d{1,5}\s+[A-Za-z0-9.\s]{3,40}(?:street|st|avenue|ave|road|rd|drive|dr|lane|ln|court|ct|boulevard|blvd|way|circle|cir)\b[^.,]{0,40})/i
  );
  if (addrMatch) hints.address = addrMatch[1].trim();

  // Service type keywords
  const lower = text.toLowerCase();
  if (/heat\s*pump|no\s*cool|not\s*cooling|ac\b|air\s*condition|furnace|hvac|thermostat/.test(lower)) {
    hints.serviceInterest = /install|replace|new unit/.test(lower) ? 'HVAC - Install' :
      /maintain|tune|filter/.test(lower) ? 'HVAC - Maintenance' : 'HVAC - Repair';
  } else if (/outlet|breaker|panel|wiring|electric|no\s*power|gfci/.test(lower)) {
    hints.serviceInterest = /panel|upgrade/.test(lower) ? 'Electrical - Panel Upgrade' : 'Electrical - Repair';
  }

  // Prefer customer-side lines as problem summary (shorten)
  const problemCue = text.match(
    /(?:problem|issue|wrong|broken|not working|stopped|leaking|noise|tripping)[^.!?]{0,120}[.!?]?/i
  );
  if (problemCue) hints.problem = problemCue[0].trim();
  else if (text.length > 40) hints.problem = text.slice(0, 280) + (text.length > 280 ? '…' : '');

  return hints;
}

function dialogueToText(dialogue) {
  if (!Array.isArray(dialogue)) return '';
  return dialogue.map(d => {
    const who = d.userId ? 'Staff' : (d.identifier || 'Caller');
    return `${who}: ${d.content || ''}`;
  }).join('\n');
}

app.post('/api/webhooks/quo', (req, res) => {
  // Always 200 quickly so Quo doesn't retry forever
  res.status(200).json({ received: true });

  (async () => {
    try {
      const info = extractCallInfo(req.body || {});
      const type = String(info.type || '');
      const isTranscript = /transcript\.completed/i.test(type);
      const isSummary = /summary\.completed/i.test(type);
      const isSmsIn = /message\.received/i.test(type);
      const isIncoming = String(info.direction).toLowerCase() === 'incoming' || isTranscript || isSummary;

      // --- Transcript / summary: enrich existing lead + work order ---
      if (isTranscript || isSummary) {
        const data = loadData();
        const transcriptText = isTranscript
          ? dialogueToText(info.dialogue)
          : String(info.summary || '');
        const hints = parseTranscriptHints(transcriptText);
        const callId = info.callId;
        const externalPhone = (info.from || (info.raw?.data?.context?.participants?.external || [])[0] || '');
        const digits = String(externalPhone).replace(/\D/g, '').slice(-10);

        let lead = (data.leads || []).find(l => callId && l.quoCallId === callId);
        if (!lead && digits) {
          lead = (data.leads || []).find(l =>
            String(l.phone || '').replace(/\D/g, '').slice(-10) === digits &&
            l.status !== 'converted' && l.status !== 'lost'
          );
        }
        if (!lead) {
          // Create lead from transcript if call was missed by earlier webhook
          if (digits || externalPhone) {
            lead = {
              id: 'LD-' + (data.nextLeadId++),
              name: normalizePhone(externalPhone) || externalPhone || 'Caller',
              phone: normalizePhone(externalPhone) || externalPhone,
              email: '', address: hints.address || '',
              source: 'Phone call',
              serviceInterest: hints.serviceInterest || 'Callback / Service',
              notes: '',
              status: 'contacted',
              quoCallId: callId || null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            };
            data.leads = data.leads || [];
            data.leads.unshift(lead);
          } else return;
        }

        const stamp = new Date().toLocaleString();
        if (transcriptText) {
          lead.transcript = transcriptText.slice(0, 8000);
          lead.notes = (lead.notes ? lead.notes + '\n' : '') +
            `[${stamp}] ${isTranscript ? 'Transcript' : 'Summary'} attached`;
        }
        if (hints.problem) {
          lead.problem = hints.problem;
          lead.notes += `\n[${stamp}] Problem: ${hints.problem}`;
        }
        if (hints.address && !lead.address) lead.address = hints.address;
        if (hints.serviceInterest && (!lead.serviceInterest || lead.serviceInterest === 'Callback / Service')) {
          lead.serviceInterest = hints.serviceInterest;
        }
        if (lead.status === 'new') lead.status = 'contacted';
        lead.updatedAt = new Date().toISOString();

        // Update linked work order description
        const wo = (data.workOrders || []).find(w =>
          (lead.convertedId && w.id === lead.convertedId) ||
          (w.leadId && w.leadId === lead.id) ||
          (callId && w.notes && w.notes.includes(callId))
        );
        if (wo) {
          if (hints.problem) wo.description = hints.problem;
          if (hints.serviceInterest) wo.serviceType = hints.serviceInterest;
          if (hints.address && !wo.customerAddress) wo.customerAddress = hints.address;
          if (transcriptText) {
            wo.notes = (wo.notes || '') + `\n[${stamp}] Call transcript:\n` + transcriptText.slice(0, 2000);
          }
          wo.updatedAt = new Date().toISOString();
        }
        saveData(data);
        console.log(`[Quo webhook] ${type} enriched lead ${lead.id}`);
        return;
      }

      if (!isIncoming && !isSmsIn) return;

      const phone = normalizePhone(info.from);
      if (!phone && !info.from) return;

      const data = loadData();
      data.leads = data.leads || [];
      data.workOrders = data.workOrders || [];
      data.callLog = data.callLog || [];

      // Dedupe only pure call start events (allow transcript later)
      if (!isTranscript && !isSummary) {
        const recent = data.callLog.find(c => c.callId && info.callId && c.callId === info.callId && c.type === info.type);
        if (recent) return;
      }

      data.callLog.unshift({
        id: uuidv4(), callId: info.callId, type: info.type, from: info.from, to: info.to,
        direction: info.direction, receivedAt: new Date().toISOString()
      });
      if (data.callLog.length > 200) data.callLog = data.callLog.slice(0, 200);

      const digits = String(info.from || '').replace(/\D/g, '').slice(-10);
      const existingUser = data.users.find(u => {
        const ud = String(u.phone || '').replace(/\D/g, '').slice(-10);
        return ud && ud === digits;
      });
      const existingLead = data.leads.find(l => {
        const ld = String(l.phone || '').replace(/\D/g, '').slice(-10);
        return ld && ld === digits && l.status !== 'converted' && l.status !== 'lost';
      });

      const quoContact = await lookupQuoContactByPhone(info.from);
      const sourceLabel = isSmsIn ? 'Inbound SMS' : 'Phone call';
      const noteBits = [
        `${sourceLabel} via Quo`,
        info.type ? `event: ${info.type}` : '',
        info.voicemail ? 'voicemail left' : '',
        quoContact?.email ? `email from Quo: ${quoContact.email}` : '',
        info.callId ? `callId: ${info.callId}` : ''
      ].filter(Boolean).join(' · ');

      if (existingLead) {
        existingLead.notes = (existingLead.notes ? existingLead.notes + '\n' : '') +
          `[${new Date().toLocaleString()}] ${noteBits}`;
        if (!existingLead.email && (quoContact?.email || existingUser?.email)) {
          existingLead.email = quoContact?.email || existingUser.email;
        }
        if ((!existingLead.name || existingLead.name === 'Unknown caller') && quoContact?.name) {
          existingLead.name = quoContact.name;
        }
        existingLead.updatedAt = new Date().toISOString();
        if (existingLead.status === 'new') existingLead.status = 'contacted';
        if (info.callId) existingLead.quoCallId = info.callId;
        saveData(data);
        return;
      }

      const lead = {
        id: 'LD-' + (data.nextLeadId++),
        name: existingUser?.name || quoContact?.name || (phone || info.from || 'Unknown caller'),
        phone: phone || info.from,
        email: existingUser?.email || quoContact?.email || '',
        address: existingUser?.address || '',
        source: sourceLabel,
        serviceInterest: 'Callback / Service',
        notes: noteBits,
        status: 'new',
        customerId: existingUser ? existingUser.id : null,
        quoCallId: info.callId || null,
        quoContactId: quoContact?.contactId || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.leads.unshift(lead);

      const wo = {
        id: 'WO-' + (data.nextId++),
        requestId: null, leadId: lead.id,
        customerId: existingUser ? existingUser.id : null,
        customerName: lead.name, customerPhone: lead.phone, customerAddress: lead.address || '',
        serviceType: 'Callback from phone',
        description: `Auto-created from ${sourceLabel}. ${noteBits}`,
        urgency: 'normal', assignedTo: null, assignedName: null,
        scheduledDate: null, scheduledTime: 'Anytime', status: 'scheduled', priority: 'normal',
        notes: `From Quo ${sourceLabel}`, photos: [],
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()
      };
      wo.googleCalendarLink = buildGoogleCalendarLink(wo);
      data.workOrders.unshift(wo);
      lead.notes += `\nWork order ${wo.id} created automatically`;
      saveData(data);
      console.log(`[Quo webhook] ${sourceLabel} from ${lead.phone} → ${lead.id} + ${wo.id}`);
    } catch (err) {
      console.error('[Quo webhook] error:', err.message);
    }
  })();
});

app.use(express.static(__dirname));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\nCallison Electric Heating & Cooling on port ${PORT}`);
  console.log(`Quo SMS: ${QUO_API_KEY ? 'CONFIGURED' : 'NOT CONFIGURED (simulated)'}`);
  console.log(`From: ${QUO_FROM_NUMBER || '(not set)'}`);
  console.log(`Webhook: POST /api/webhooks/quo\n`);
});
