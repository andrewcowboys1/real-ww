const API = '';
let useBackend = false;
let currentUser = null;
let cache = null;

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];
function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${type==='error'?'bg-red-600 text-white':'bg-slate-900 text-white'}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}
function statusColor(s) {
  const m = {
    pending:'bg-amber-100 text-amber-800', scheduled:'bg-blue-100 text-blue-800',
    on_the_way:'bg-violet-100 text-violet-800', in_progress:'bg-indigo-100 text-indigo-800',
    completed:'bg-emerald-100 text-emerald-800', converted:'bg-slate-100 text-slate-600',
    unpaid:'bg-red-100 text-red-800', paid:'bg-emerald-100 text-emerald-800',
    high:'bg-red-100 text-red-700', normal:'bg-slate-100 text-slate-600', low:'bg-slate-100 text-slate-500'
  };
  return m[s] || 'bg-slate-100 text-slate-600';
}
function fmtMoney(n) { return '$' + (Number(n)||0).toFixed(2); }
function fmtDate(d) {
  if (!d) return '—';
  try { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}); }
  catch { return d; }
}

async function checkBackend() {
  try {
    const r = await fetch(API + '/api/health', { signal: AbortSignal.timeout(2000) });
    if (r.ok) { useBackend = true; return await r.json(); }
  } catch {}
  useBackend = false;
  return null;
}

function localLoad() {
  try { return JSON.parse(localStorage.getItem('callison_data') || 'null'); } catch { return null; }
}
function localSave(d) { localStorage.setItem('callison_data', JSON.stringify(d)); }

async function getData() {
  if (useBackend) {
    try {
      const r = await fetch(API + '/api/data');
      if (r.ok) { cache = await r.json(); return cache; }
    } catch {}
  }
  let d = localLoad();
  if (!d) {
    d = {
      users: [
        {id:'u1',email:'admin@callison.com',password:'admin123',name:'Office Admin',role:'admin',phone:'555-0100'},
        {id:'u2',email:'tech@callison.com',password:'tech123',name:'Mike Rivera',role:'technician',phone:'555-0101'},
        {id:'u3',email:'tech2@callison.com',password:'tech123',name:'Sarah Chen',role:'technician',phone:'555-0102'},
        {id:'u4',email:'customer@example.com',password:'cust123',name:'Jane Thompson',role:'customer',phone:'555-0200',address:'142 Maple Ave, Brooklyn, NY 11201'},
        {id:'u5',email:'bob@example.com',password:'cust123',name:'Bob Martinez',role:'customer',phone:'555-0201',address:'88 Oak Street, Queens, NY 11375'}
      ],
      equipment: [
        {id:'eq1',customerId:'u4',type:'Heat Pump',brand:'Goodman',model:'GSZ160361BD',serial:'1901185633',location:'Outdoor unit',installed:'2019',notes:'3-ton 16 SEER'},
        {id:'eq2',customerId:'u5',type:'Electrical Panel',brand:'Square D',model:'QO120M100',serial:'',location:'Basement',installed:'2015',notes:'100A main'}
      ],
      requests: [],
      workOrders: [
        {id:'WO-2001',customerId:'u5',customerName:'Bob Martinez',customerPhone:'555-0201',customerAddress:'88 Oak Street, Queens, NY 11375',serviceType:'Electrical - Repair',description:'Kitchen outlet not working',urgency:'normal',assignedTo:'u2',assignedName:'Mike Rivera',scheduledDate:'2026-08-21',scheduledTime:'Afternoon',status:'scheduled',notes:'',photos:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
      ],
      invoices: [
        {id:'INV-3001',customerId:'u5',customerName:'Bob Martinez',workOrderId:'WO-2001',description:'Electrical repair – kitchen outlet',amount:285,status:'unpaid',dueDate:'2026-08-28',createdAt:new Date().toISOString(),paidAt:null},
        {id:'INV-3002',customerId:'u4',customerName:'Jane Thompson',workOrderId:'WO-2002',description:'HVAC annual tune-up',amount:149,status:'paid',dueDate:'2026-08-15',createdAt:new Date().toISOString(),paidAt:new Date().toISOString()}
      ],
      nextId: 2002, nextInvoiceId: 3003
    };
    localSave(d);
  }
  cache = d;
  return d;
}

async function api(path, opts={}) {
  if (!useBackend) throw new Error('offline');
  const r = await fetch(API + path, {
    headers: { 'Content-Type': 'application/json', ...(opts.headers||{}) },
    ...opts
  });
  const j = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(j.error || 'Request failed');
  return j;
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type.startsWith('image/')) return reject(new Error('Not an image'));
    if (file.size > 4_000_000) return reject(new Error('Image too large (max 4MB)'));
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const max = 1280;
        let w = img.width, h = img.height;
        if (w > max || h > max) {
          if (w > h) { h = Math.round(h * max / w); w = max; }
          else { w = Math.round(w * max / h); h = max; }
        }
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject;
      img.src = reader.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function renderLogin() {
  const app = $('#app');
  app.innerHTML = `
    <div class="min-h-screen flex flex-col">
      <div class="bg-brand-800 text-white px-6 pt-12 pb-10">
        <div class="text-xs text-gold-400 font-semibold tracking-wider uppercase mb-3">Service Portal</div>
        <div class="logo-callison text-3xl leading-none">CALLISON</div>
        <div class="logo-sub mt-0.5">Electric · Heating · Cooling</div>
        <p class="text-slate-300 text-sm mt-4">Schedule service · Track jobs · Pay bills</p>
      </div>
      <div class="flex-1 px-6 py-8 -mt-4">
        <div class="bg-white rounded-2xl shadow-lg border border-slate-100 p-6">
          <h2 class="font-semibold text-lg mb-4 text-brand-800">Sign in</h2>
          <form id="loginForm" class="space-y-4">
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">Email</label>
              <input name="email" type="email" required class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-gold-500 outline-none" placeholder="you@email.com" />
            </div>
            <div>
              <label class="block text-xs font-medium text-slate-500 mb-1">Password</label>
              <input name="password" type="password" required class="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-gold-500 outline-none" />
            </div>
            <button type="submit" class="w-full btn-gold py-3 rounded-xl">Sign In</button>
          </form>
          <div class="mt-5 pt-5 border-t border-slate-100 text-center">
            <p class="text-sm text-slate-500 mb-2">New customer?</p>
            <button id="showRegister" class="text-brand-800 font-semibold text-sm">Create an account</button>
          </div>
          <div class="mt-6 p-3 bg-slate-50 rounded-xl text-xs text-slate-500 space-y-1">
            <div><strong>Demo:</strong></div>
            <div>Admin → admin@callison.com / admin123</div>
            <div>Tech → tech@callison.com / tech123</div>
            <div>Customer → customer@example.com / cust123</div>
          </div>
        </div>
      </div>
    </div>`;

  $('#loginForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const email = fd.get('email'), password = fd.get('password');
    try {
      if (useBackend) {
        const { user } = await api('/api/login', { method:'POST', body: JSON.stringify({ email, password }) });
        currentUser = user;
      } else {
        const data = await getData();
        const u = data.users.find(x => x.email.toLowerCase()===email.toLowerCase() && x.password===password);
        if (!u) throw new Error('Invalid email or password');
        const { password:_, ...safe } = u;
        currentUser = safe;
      }
      sessionStorage.setItem('callison_user', JSON.stringify(currentUser));
      render();
    } catch (err) { toast(err.message || 'Login failed', 'error'); }
  };
  $('#showRegister').onclick = renderRegister;
}

function renderRegister() {
  $('#app').innerHTML = `
    <div class="min-h-screen flex flex-col">
      <div class="bg-brand-800 text-white px-6 pt-10 pb-8">
        <button id="backLogin" class="text-gold-400 text-sm mb-3 font-medium">← Back</button>
        <h1 class="text-xl font-bold">Create Customer Account</h1>
        <p class="text-slate-300 text-sm mt-1">Schedule service and pay bills online</p>
      </div>
      <div class="px-6 py-6">
        <form id="regForm" class="space-y-3">
          <div><label class="text-xs font-medium text-slate-500">Full name</label>
            <input name="name" required class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1" /></div>
          <div><label class="text-xs font-medium text-slate-500">Email</label>
            <input name="email" type="email" required class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1" /></div>
          <div><label class="text-xs font-medium text-slate-500">Phone</label>
            <input name="phone" type="tel" class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1" placeholder="540-294-3189" /></div>
          <div><label class="text-xs font-medium text-slate-500">Service address</label>
            <input name="address" class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1" /></div>
          <div><label class="text-xs font-medium text-slate-500">Password</label>
            <input name="password" type="password" required minlength="6" class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1" /></div>
          <button class="w-full btn-gold py-3 rounded-xl mt-2">Create Account</button>
        </form>
      </div>
    </div>`;
  $('#backLogin').onclick = renderLogin;
  $('#regForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = Object.fromEntries(fd.entries());
    try {
      if (useBackend) {
        const { user } = await api('/api/register', { method:'POST', body: JSON.stringify(body) });
        currentUser = user;
      } else {
        const data = await getData();
        if (data.users.some(u => u.email.toLowerCase()===body.email.toLowerCase())) throw new Error('Email already registered');
        const nu = { id:'u'+Date.now(), ...body, role:'customer' };
        data.users.push(nu);
        localSave(data);
        const { password:_, ...safe } = nu;
        currentUser = safe;
      }
      sessionStorage.setItem('callison_user', JSON.stringify(currentUser));
      toast('Account created!');
      render();
    } catch (err) { toast(err.message, 'error'); }
  };
}

function shell(title, content, tabs) {
  const role = currentUser.role;
  const nav = {
    customer: [
      { id:'home', label:'Home' },
      { id:'schedule', label:'Schedule' },
      { id:'bills', label:'Bills' },
      { id:'jobs', label:'My Jobs' }
    ],
    technician: [
      { id:'jobs', label:'My Jobs' },
      { id:'history', label:'History' }
    ],
    admin: [
      { id:'dashboard', label:'Dashboard' },
      { id:'requests', label:'Requests' },
      { id:'orders', label:'Work Orders' },
      { id:'invoices', label:'Invoices' }
    ]
  }[role] || [];

  return `
    <div class="min-h-screen flex flex-col pb-20">
      <header class="bg-brand-800 text-white px-4 py-3 sticky top-0 z-20">
        <div class="flex items-center justify-between">
          <div>
            <div class="text-[10px] text-gold-400 font-bold tracking-wider uppercase">Callison</div>
            <div class="font-semibold text-sm">${title}</div>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-xs bg-white/10 px-2 py-1 rounded-lg">${currentUser.name.split(' ')[0]}</span>
            <button id="logoutBtn" class="text-xs text-gold-400 underline">Log out</button>
          </div>
        </div>
      </header>
      <main class="flex-1 px-4 py-4">${content}</main>
      <nav class="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-slate-200 flex z-20">
        ${nav.map(t => `
          <button data-tab="${t.id}" class="tab-btn flex-1 py-3 text-xs font-medium ${tabs===t.id ? 'text-brand-800 font-bold' : 'text-slate-400'}">
            ${t.label}
          </button>`).join('')}
      </nav>
    </div>`;
}

async function customerHome() {
  const data = await getData();
  const myJobs = (data.workOrders||[]).filter(w => w.customerId === currentUser.id);
  const open = myJobs.filter(w => !['completed'].includes(w.status));
  const unpaid = (data.invoices||[]).filter(i => i.customerId === currentUser.id && i.status === 'unpaid');
  const content = `
    <div class="space-y-4">
      <div class="bg-brand-800 text-white rounded-2xl p-5">
        <div class="text-xs text-gold-400 font-semibold tracking-wide uppercase">Welcome back</div>
        <div class="text-xl font-bold mt-1">${currentUser.name.split(' ')[0]}</div>
        <p class="text-slate-300 text-sm mt-2">Need service? Schedule in under a minute.</p>
        <button data-go="schedule" class="mt-4 btn-gold text-sm px-4 py-2.5 rounded-xl">Schedule Service</button>
      </div>
      ${unpaid.length ? `
      <div class="bg-red-50 border border-red-100 rounded-2xl p-4">
        <div class="font-semibold text-red-800 text-sm">Balance due</div>
        <div class="text-2xl font-bold text-red-700 mt-1">${fmtMoney(unpaid.reduce((s,i)=>s+Number(i.amount),0))}</div>
        <button data-go="bills" class="mt-3 text-sm font-medium text-red-700 underline">Pay now →</button>
      </div>` : ''}
      <div>
        <h3 class="font-semibold text-sm text-slate-700 mb-2">Active jobs</h3>
        ${open.length === 0 ? '<p class="text-sm text-slate-400">No active jobs</p>' :
          open.map(w => `
            <div class="border border-slate-100 rounded-xl p-3 mb-2">
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-medium text-sm">${w.serviceType}</div>
                  <div class="text-xs text-slate-500 mt-0.5">${w.scheduledDate || 'Pending schedule'} · ${w.id}</div>
                </div>
                <span class="status-pill ${statusColor(w.status)}">${w.status.replace(/_/g,' ')}</span>
              </div>
            </div>`).join('')}
      </div>
      <div class="grid grid-cols-2 gap-3">
        <button data-go="schedule" class="border border-slate-200 rounded-xl p-4 text-left hover:bg-slate-50">
          <div class="text-lg">📅</div>
          <div class="font-medium text-sm mt-1">Schedule</div>
        </button>
        <button data-go="bills" class="border border-slate-200 rounded-xl p-4 text-left hover:bg-slate-50">
          <div class="text-lg">💳</div>
          <div class="font-medium text-sm mt-1">Pay Bills</div>
        </button>
      </div>
    </div>`;
  $('#app').innerHTML = shell('Home', content, 'home');
  bindNav();
}

async function customerSchedule() {
  const content = `
    <div class="space-y-4">
      <div class="bg-slate-50 rounded-2xl p-4 text-sm text-slate-600">
        Request service below. Our office will confirm your appointment and you’ll get a text.
      </div>
      <form id="schedForm" class="space-y-3">
        <div>
          <label class="text-xs font-medium text-slate-500">Service type</label>
          <select name="serviceType" required class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1">
            <option value="">Select…</option>
            <option>HVAC - Repair</option>
            <option>HVAC - Maintenance</option>
            <option>HVAC - Install</option>
            <option>Electrical - Repair</option>
            <option>Electrical - Panel Upgrade</option>
            <option>Electrical - Install</option>
            <option>Emergency</option>
            <option>Other</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500">Urgency</label>
          <select name="urgency" class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1">
            <option value="normal">Normal</option>
            <option value="high">Urgent</option>
            <option value="low">Flexible</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500">Preferred date</label>
          <input name="preferredDate" type="date" required class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1" />
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500">Preferred time</label>
          <select name="preferredTime" class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1">
            <option>Morning (8am–12pm)</option>
            <option>Afternoon (12pm–5pm)</option>
            <option>Anytime</option>
          </select>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500">Describe the issue</label>
          <textarea name="description" rows="3" required class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1" placeholder="What’s going on?"></textarea>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500">Photos (optional) — use camera or gallery</label>
          <input type="file" id="reqPhotos" accept="image/*" capture="environment" multiple class="w-full text-sm mt-1" />
          <div id="reqPhotoPreview" class="photo-grid grid grid-cols-3 gap-2 mt-2"></div>
        </div>
        <div>
          <label class="text-xs font-medium text-slate-500">Service address</label>
          <input name="customerAddress" value="${currentUser.address||''}" required class="w-full border rounded-xl px-3 py-2.5 text-sm mt-1" />
        </div>
        <button type="submit" class="w-full btn-gold py-3 rounded-xl">Submit Request</button>
      </form>
    </div>`;
  $('#app').innerHTML = shell('Schedule Service', content, 'schedule');
  bindNav();

  const pendingPhotos = [];
  $('#reqPhotos').onchange = async (e) => {
    const preview = $('#reqPhotoPreview');
    for (const file of e.target.files) {
      try {
        const dataUrl = await readFileAsDataURL(file);
        pendingPhotos.push(dataUrl);
        const img = document.createElement('img');
        img.src = dataUrl;
        preview.appendChild(img);
      } catch (err) { toast(err.message, 'error'); }
    }
  };

  $('#schedForm').onsubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const body = {
      customerId: currentUser.id,
      customerName: currentUser.name,
      customerPhone: currentUser.phone,
      customerAddress: fd.get('customerAddress'),
      serviceType: fd.get('serviceType'),
      urgency: fd.get('urgency'),
      preferredDate: fd.get('preferredDate'),
      preferredTime: fd.get('preferredTime'),
      description: fd.get('description'),
      photos: pendingPhotos.map((dataUrl, i) => ({ id:'ph'+Date.now()+i, dataUrl, createdAt: new Date().toISOString() }))
    };
    try {
      if (useBackend) await api('/api/requests', { method:'POST', body: JSON.stringify(body) });
      else {
        const data = await getData();
        body.id = 'SR-' + Date.now();
        body.status = 'pending';
        body.createdAt = new Date().toISOString();
        data.requests.unshift(body);
        localSave(data);
      }
      toast('Request submitted! We’ll confirm soon.');
      setTimeout(() => customerHome(), 800);
    } catch (err) { toast(err.message, 'error'); }
  };
}

async function customerBills() {
  const data = await getData();
  const invoices = (data.invoices || []).filter(i => i.customerId === currentUser.id);
  const unpaid = invoices.filter(i => i.status === 'unpaid');
  const paid = invoices.filter(i => i.status === 'paid');

  const content = `
    <div class="space-y-5">
      <div class="bg-slate-50 rounded-2xl p-4">
        <div class="text-xs text-slate-500">Total balance</div>
        <div class="text-2xl font-bold ${unpaid.length?'text-red-600':'text-emerald-600'}">
          ${fmtMoney(unpaid.reduce((s,i)=>s+Number(i.amount),0))}
        </div>
      </div>
      ${unpaid.length === 0 && paid.length === 0 ? '<p class="text-sm text-slate-400 text-center py-8">No invoices yet</p>' : ''}
      ${unpaid.map(inv => `
        <div class="border border-red-100 bg-red-50/50 rounded-2xl p-4">
          <div class="flex justify-between items-start">
            <div>
              <div class="font-semibold text-sm">${inv.id}</div>
              <div class="text-xs text-slate-500 mt-0.5">${inv.description}</div>
              <div class="text-xs text-slate-400 mt-1">Due ${fmtDate(inv.dueDate)}</div>
            </div>
            <div class="text-right">
              <div class="font-bold text-red-700">${fmtMoney(inv.amount)}</div>
              <span class="status-pill ${statusColor('unpaid')}">Unpaid</span>
            </div>
          </div>
          <button data-pay="${inv.id}" class="pay-btn mt-3 w-full btn-gold py-2.5 rounded-xl text-sm">
            Pay ${fmtMoney(inv.amount)}
          </button>
        </div>`).join('')}
      ${paid.length ? `<h3 class="font-semibold text-sm text-slate-600 pt-2">Paid</h3>` : ''}
      ${paid.map(inv => `
        <div class="border border-slate-100 rounded-xl p-3 flex justify-between items-center opacity-80">
          <div>
            <div class="font-medium text-sm">${inv.id}</div>
            <div class="text-xs text-slate-400">${inv.description}</div>
          </div>
          <div class="text-right">
            <div class="text-sm font-medium">${fmtMoney(inv.amount)}</div>
            <span class="status-pill ${statusColor('paid')}">Paid</span>
          </div>
        </div>`).join('')}
      <p class="text-xs text-slate-400 text-center">Demo payments mark invoices paid. Connect Stripe for real card processing.</p>
    </div>`;
  $('#app').innerHTML = shell('Bills & Payments', content, 'bills');
  bindNav();

  $$('.pay-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.pay;
      if (!confirm('Mark this invoice as paid? (Demo mode – connect Stripe for real cards)')) return;
      btn.disabled = true;
      btn.textContent = 'Processing…';
      try {
        if (useBackend) {
          await api('/api/invoices/' + id + '/pay', { method:'POST', body: JSON.stringify({ method:'card' }) });
        } else {
          const data = await getData();
          const inv = data.invoices.find(i => i.id === id);
          if (inv) { inv.status = 'paid'; inv.paidAt = new Date().toISOString(); inv.paymentMethod = 'card'; localSave(data); }
        }
        toast('Payment recorded. Thank you!');
        customerBills();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Pay';
      }
    };
  });
}

async function customerJobs() {
  const data = await getData();
  const jobs = (data.workOrders||[]).filter(w => w.customerId === currentUser.id);
  const reqs = (data.requests||[]).filter(r => r.customerId === currentUser.id);
  const content = `
    <div class="space-y-4">
      <h3 class="font-semibold text-sm">Work orders</h3>
      ${jobs.length===0?'<p class="text-sm text-slate-400">None yet</p>':jobs.map(w=>`
        <div class="border rounded-xl p-3">
          <div class="flex justify-between">
            <div class="font-medium text-sm">${w.serviceType}</div>
            <span class="status-pill ${statusColor(w.status)}">${w.status.replace(/_/g,' ')}</span>
          </div>
          <div class="text-xs text-slate-500 mt-1">${w.id} · ${w.scheduledDate||'TBD'}</div>
          ${w.photos?.length?`<div class="photo-grid grid grid-cols-3 gap-1 mt-2">${w.photos.map(p=>`<img src="${p.dataUrl}" />`).join('')}</div>`:''}
        </div>`).join('')}
      <h3 class="font-semibold text-sm pt-2">Service requests</h3>
      ${reqs.length===0?'<p class="text-sm text-slate-400">None</p>':reqs.map(r=>`
        <div class="border rounded-xl p-3">
          <div class="flex justify-between">
            <div class="font-medium text-sm">${r.serviceType}</div>
            <span class="status-pill ${statusColor(r.status)}">${r.status}</span>
          </div>
          <div class="text-xs text-slate-500 mt-1">${r.preferredDate} · ${r.id}</div>
          ${r.photos?.length?`<div class="photo-grid grid grid-cols-3 gap-1 mt-2">${r.photos.map(p=>`<img src="${p.dataUrl}" />`).join('')}</div>`:''}
        </div>`).join('')}
    </div>`;
  $('#app').innerHTML = shell('My Jobs', content, 'jobs');
  bindNav();
}

async function techJobs(showHistory=false) {
  const data = await getData();
  let jobs = (data.workOrders||[]).filter(w => w.assignedTo === currentUser.id);
  if (!showHistory) jobs = jobs.filter(w => w.status !== 'completed');
  else jobs = jobs.filter(w => w.status === 'completed');

  const content = `
    <div class="space-y-3">
      ${jobs.length===0?`<p class="text-center text-slate-400 py-10 text-sm">No ${showHistory?'completed':'open'} jobs</p>`:
      jobs.map(wo => `
        <div class="border border-slate-200 rounded-2xl p-4 shadow-sm">
          <div class="flex justify-between items-start gap-2">
            <div>
              <div class="font-semibold">${wo.customerName}</div>
              <div class="text-xs text-slate-500">${wo.serviceType} · ${wo.id}</div>
            </div>
            <span class="status-pill ${statusColor(wo.status)}">${wo.status.replace(/_/g,' ')}</span>
          </div>
          <p class="text-sm text-slate-600 mt-2">${wo.description||''}</p>
          <div class="text-xs text-slate-400 mt-1">${wo.customerAddress||''}</div>
          <div class="text-xs text-slate-400">${wo.scheduledDate||''} ${wo.scheduledTime||''}</div>
          ${wo.photos?.length ? `
            <div class="photo-grid grid grid-cols-3 gap-2 mt-3">
              ${wo.photos.map(p => `<img src="${p.dataUrl}" />`).join('')}
            </div>` : ''}
          ${!showHistory ? `
          <div class="mt-3 flex flex-wrap gap-2">
            ${wo.status==='scheduled'||wo.status==='in_progress'?`
              <button class="onway-btn flex-1 btn-navy text-sm py-2.5 rounded-xl" data-id="${wo.id}">On the Way + SMS</button>`:''}
            ${wo.status!=='completed'?`
              <button class="complete-btn flex-1 btn-gold text-sm py-2.5 rounded-xl" data-id="${wo.id}">Complete + SMS</button>`:''}
          </div>
          <div class="mt-2">
            <label class="text-xs text-slate-500">Add photo (camera or gallery)</label>
            <input type="file" accept="image/*" capture="environment" class="photo-input w-full text-xs mt-1" data-id="${wo.id}" />
          </div>
          <div class="mt-2 flex gap-2">
            <input type="text" placeholder="Add note…" class="note-input flex-1 border rounded-xl px-3 py-2 text-sm" data-id="${wo.id}" />
            <button class="note-btn bg-slate-800 text-white px-3 rounded-xl text-sm" data-id="${wo.id}">Save</button>
          </div>` : ''}
        </div>`).join('')}
    </div>`;
  $('#app').innerHTML = shell(showHistory ? 'History' : 'My Jobs', content, showHistory?'history':'jobs');
  bindNav();

  $$('.onway-btn').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        if (useBackend) {
          const r = await api('/api/work-orders/'+btn.dataset.id+'/status', {
            method:'POST', body: JSON.stringify({ status:'on_the_way', sendSms:'on_the_way', techName: currentUser.name })
          });
          toast(r.sms?.ok ? 'SMS sent!' : (r.sms?.simulated ? 'Updated (SMS simulated)' : 'Updated'));
        } else {
          const d = await getData();
          const wo = d.workOrders.find(w=>w.id===btn.dataset.id);
          if (wo) { wo.status='on_the_way'; localSave(d); }
          toast('Marked on the way');
        }
        techJobs();
      } catch(e) { toast(e.message,'error'); btn.disabled=false; }
    };
  });
  $$('.complete-btn').forEach(btn => {
    btn.onclick = async () => {
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        if (useBackend) {
          await api('/api/work-orders/'+btn.dataset.id+'/status', {
            method:'POST', body: JSON.stringify({ status:'completed', sendSms:'completed', techName: currentUser.name })
          });
          toast('Job completed + SMS sent');
        } else {
          const d = await getData();
          const wo = d.workOrders.find(w=>w.id===btn.dataset.id);
          if (wo) { wo.status='completed'; localSave(d); }
          toast('Completed');
        }
        techJobs();
      } catch(e) { toast(e.message,'error'); }
    };
  });
  $$('.photo-input').forEach(inp => {
    inp.onchange = async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await readFileAsDataURL(file);
        if (useBackend) {
          await api('/api/work-orders/'+inp.dataset.id+'/photos', {
            method:'POST', body: JSON.stringify({ dataUrl, takenBy: currentUser.name, caption: '' })
          });
        } else {
          const d = await getData();
          const wo = d.workOrders.find(w=>w.id===inp.dataset.id);
          if (wo) {
            wo.photos = wo.photos || [];
            wo.photos.push({ id:'ph'+Date.now(), dataUrl, takenBy: currentUser.name, createdAt: new Date().toISOString() });
            localSave(d);
          }
        }
        toast('Photo added');
        techJobs(showHistory);
      } catch(err) { toast(err.message,'error'); }
    };
  });
  $$('.note-btn').forEach(btn => {
    btn.onclick = async () => {
      const input = $(`.note-input[data-id="${btn.dataset.id}"]`);
      const note = (input?.value||'').trim();
      if (!note) return;
      try {
        if (useBackend) await api('/api/work-orders/'+btn.dataset.id+'/note', { method:'POST', body: JSON.stringify({ note }) });
        else {
          const d = await getData();
          const wo = d.workOrders.find(w=>w.id===btn.dataset.id);
          if (wo) { wo.notes = (wo.notes||'') + `\n[${new Date().toLocaleString()}] ${note}`; localSave(d); }
        }
        toast('Note saved');
        input.value = '';
      } catch(e) { toast(e.message,'error'); }
    };
  });
}

async function adminDashboard() {
  const data = await getData();
  const pending = (data.requests||[]).filter(r => r.status==='pending').length;
  const openWO = (data.workOrders||[]).filter(w => w.status!=='completed').length;
  const unpaid = (data.invoices||[]).filter(i => i.status==='unpaid');
  const content = `
    <div class="grid grid-cols-2 gap-3 mb-5">
      <div class="bg-amber-50 rounded-2xl p-4"><div class="text-2xl font-bold text-amber-700">${pending}</div><div class="text-xs text-amber-600">Pending requests</div></div>
      <div class="bg-blue-50 rounded-2xl p-4"><div class="text-2xl font-bold text-blue-700">${openWO}</div><div class="text-xs text-blue-600">Open work orders</div></div>
      <div class="bg-red-50 rounded-2xl p-4 col-span-2">
        <div class="text-2xl font-bold text-red-700">${fmtMoney(unpaid.reduce((s,i)=>s+Number(i.amount),0))}</div>
        <div class="text-xs text-red-600">${unpaid.length} unpaid invoice(s)</div>
      </div>
    </div>
    <h3 class="font-semibold text-sm mb-2">Recent requests</h3>
    ${(data.requests||[]).slice(0,5).map(r => `
      <div class="border rounded-xl p-3 mb-2 flex justify-between items-center">
        <div>
          <div class="font-medium text-sm">${r.customerName}</div>
          <div class="text-xs text-slate-500">${r.serviceType} · ${r.preferredDate}</div>
        </div>
        <span class="status-pill ${statusColor(r.status)}">${r.status}</span>
      </div>`).join('') || '<p class="text-sm text-slate-400">None</p>'}
  `;
  $('#app').innerHTML = shell('Dashboard', content, 'dashboard');
  bindNav();
}

async function adminRequests() {
  const data = await getData();
  const reqs = (data.requests||[]).filter(r => r.status === 'pending');
  const techs = (data.users||[]).filter(u => u.role==='technician');
  const content = `
    <div class="space-y-3">
      ${reqs.length===0?'<p class="text-center text-slate-400 py-8 text-sm">No pending requests</p>':
      reqs.map(r => `
        <div class="border rounded-2xl p-4">
          <div class="font-semibold">${r.customerName}</div>
          <div class="text-xs text-slate-500">${r.serviceType} · ${r.preferredDate} ${r.preferredTime||''}</div>
          <p class="text-sm mt-2">${r.description||''}</p>
          ${r.photos?.length?`<div class="photo-grid grid grid-cols-3 gap-1 mt-2">${r.photos.map(p=>`<img src="${p.dataUrl}"/>`).join('')}</div>`:''}
          <div class="mt-3 flex gap-2 items-center">
            <select class="tech-select border rounded-lg text-sm px-2 py-1.5 flex-1" data-id="${r.id}">
              <option value="">Assign tech…</option>
              ${techs.map(t=>`<option value="${t.id}">${t.name}</option>`).join('')}
            </select>
            <button class="convert-btn btn-gold text-sm px-3 py-1.5 rounded-lg" data-id="${r.id}">Convert</button>
          </div>
        </div>`).join('')}
    </div>`;
  $('#app').innerHTML = shell('Service Requests', content, 'requests');
  bindNav();

  $$('.convert-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const sel = $(`.tech-select[data-id="${id}"]`);
      const data = await getData();
      const r = data.requests.find(x => x.id === id);
      if (!r) return;
      const body = {
        requestId: r.id,
        customerId: r.customerId,
        customerName: r.customerName,
        customerPhone: r.customerPhone,
        customerAddress: r.customerAddress,
        serviceType: r.serviceType,
        description: r.description,
        urgency: r.urgency,
        assignedTo: sel.value || null,
        scheduledDate: r.preferredDate,
        scheduledTime: r.preferredTime,
        photos: r.photos || [],
        sendSms: true
      };
      try {
        if (useBackend) await api('/api/work-orders', { method:'POST', body: JSON.stringify(body) });
        else {
          body.id = 'WO-' + (data.nextId++);
          body.status = 'scheduled';
          body.assignedName = (data.users.find(u=>u.id===sel.value)||{}).name || null;
          body.createdAt = new Date().toISOString();
          body.updatedAt = body.createdAt;
          data.workOrders.unshift(body);
          r.status = 'converted';
          localSave(data);
        }
        toast('Converted to work order');
        adminRequests();
      } catch(e) { toast(e.message,'error'); }
    };
  });
}

async function adminOrders() {
  const data = await getData();
  const wos = data.workOrders || [];
  const content = `
    <div class="space-y-3">
      ${wos.map(wo => `
        <div class="border rounded-xl p-3">
          <div class="flex justify-between">
            <div>
              <div class="font-medium text-sm">${wo.customerName}</div>
              <div class="text-xs text-slate-500">${wo.serviceType} · ${wo.assignedName||'Unassigned'} · ${wo.id}</div>
            </div>
            <span class="status-pill ${statusColor(wo.status)}">${wo.status.replace(/_/g,' ')}</span>
          </div>
          ${wo.photos?.length?`<div class="photo-grid grid grid-cols-4 gap-1 mt-2">${wo.photos.slice(0,4).map(p=>`<img src="${p.dataUrl}"/>`).join('')}</div>`:''}
        </div>`).join('') || '<p class="text-sm text-slate-400">No work orders</p>'}
    </div>`;
  $('#app').innerHTML = shell('Work Orders', content, 'orders');
  bindNav();
}

async function adminInvoices() {
  const data = await getData();
  const invs = data.invoices || [];
  const content = `
    <div class="space-y-3">
      <button id="newInv" class="w-full border-2 border-dashed border-slate-200 rounded-xl py-3 text-sm text-slate-500">+ Create invoice</button>
      ${invs.map(inv => `
        <div class="border rounded-xl p-3 flex justify-between items-center">
          <div>
            <div class="font-medium text-sm">${inv.customerName}</div>
            <div class="text-xs text-slate-500">${inv.id} · ${inv.description}</div>
          </div>
          <div class="text-right">
            <div class="font-semibold text-sm">${fmtMoney(inv.amount)}</div>
            <span class="status-pill ${statusColor(inv.status)}">${inv.status}</span>
          </div>
        </div>`).join('') || '<p class="text-sm text-slate-400">No invoices</p>'}
    </div>`;
  $('#app').innerHTML = shell('Invoices', content, 'invoices');
  bindNav();
  $('#newInv').onclick = async () => {
    const amount = prompt('Amount (e.g. 185.00)');
    if (!amount) return;
    const customerName = prompt('Customer name');
    if (!customerName) return;
    const description = prompt('Description') || 'Service';
    try {
      if (useBackend) {
        await api('/api/invoices', { method:'POST', body: JSON.stringify({
          customerId: 'manual', customerName, description, amount: parseFloat(amount)
        })});
      } else {
        const d = await getData();
        d.invoices.unshift({
          id: 'INV-'+(d.nextInvoiceId++), customerId:'manual', customerName, description,
          amount: parseFloat(amount), status:'unpaid', dueDate: new Date(Date.now()+7*864e5).toISOString().slice(0,10),
          createdAt: new Date().toISOString(), paidAt:null
        });
        localSave(d);
      }
      toast('Invoice created');
      adminInvoices();
    } catch(e) { toast(e.message,'error'); }
  };
}

function bindNav() {
  $$('.tab-btn').forEach(btn => {
    btn.onclick = () => go(btn.dataset.tab);
  });
  $$('[data-go]').forEach(btn => {
    btn.onclick = () => go(btn.dataset.go);
  });
  const lo = $('#logoutBtn');
  if (lo) lo.onclick = () => {
    currentUser = null;
    sessionStorage.removeItem('callison_user');
    renderLogin();
  };
}

function go(tab) {
  const role = currentUser.role;
  if (role === 'customer') {
    if (tab==='home') customerHome();
    else if (tab==='schedule') customerSchedule();
    else if (tab==='bills') customerBills();
    else if (tab==='jobs') customerJobs();
  } else if (role === 'technician') {
    if (tab==='jobs') techJobs(false);
    else if (tab==='history') techJobs(true);
  } else if (role === 'admin') {
    if (tab==='dashboard') adminDashboard();
    else if (tab==='requests') adminRequests();
    else if (tab==='orders') adminOrders();
    else if (tab==='invoices') adminInvoices();
  }
}

async function render() {
  if (!currentUser) {
    try { currentUser = JSON.parse(sessionStorage.getItem('callison_user')); } catch {}
  }
  if (!currentUser) return renderLogin();
  if (currentUser.role === 'customer') return customerHome();
  if (currentUser.role === 'technician') return techJobs(false);
  return adminDashboard();
}

(async () => {
  await checkBackend();
  await getData();
  render();
})();
