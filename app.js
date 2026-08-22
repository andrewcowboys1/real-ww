const API = '';
let useBackend = false;
let currentUser = null;
let cache = null;

const STATUSES = ['scheduled', 'on_the_way', 'in_progress', 'completed', 'cancelled'];
const LEAD_STATUSES = ['new', 'contacted', 'quoted', 'converted', 'lost'];

const $ = (sel, el=document) => el.querySelector(sel);
const $$ = (sel, el=document) => [...el.querySelectorAll(sel)];

function toast(msg, type='info') {
  const t = document.createElement('div');
  t.className = `fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-3 rounded-xl text-sm font-medium shadow-lg ${type==='error'?'bg-red-600 text-white':'bg-slate-900 text-white'}`;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

function statusColor(s) {
  const m = {
    pending:'bg-amber-100 text-amber-800', scheduled:'bg-blue-100 text-blue-800',
    on_the_way:'bg-violet-100 text-violet-800', in_progress:'bg-indigo-100 text-indigo-800',
    completed:'bg-emerald-100 text-emerald-800', cancelled:'bg-slate-200 text-slate-600',
    converted:'bg-slate-100 text-slate-600', new:'bg-amber-100 text-amber-800',
    contacted:'bg-blue-100 text-blue-800', quoted:'bg-purple-100 text-purple-800',
    lost:'bg-slate-200 text-slate-500', high:'bg-red-100 text-red-700',
    normal:'bg-slate-100 text-slate-600', low:'bg-slate-100 text-slate-500'
  };
  return m[s] || 'bg-slate-100 text-slate-600';
}

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
  try { return JSON.parse(localStorage.getItem('callison_data_v3') || 'null'); } catch { return null; }
}
function localSave(d) { localStorage.setItem('callison_data_v3', JSON.stringify(d)); }

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
        {id:'u4',email:'customer@example.com',password:'cust123',name:'Jane Thompson',role:'customer',phone:'555-0200',address:'142 Maple Ave, Staunton, VA'},
        {id:'u5',email:'bob@example.com',password:'cust123',name:'Bob Martinez',role:'customer',phone:'555-0201',address:'88 Oak St, Waynesboro, VA'}
      ],
      leads: [
        {id:'LD-1001',name:'Carol Whitman',phone:'540-555-0199',email:'carol@email.com',address:'210 Main St, Staunton',source:'Google',serviceInterest:'HVAC - Install',notes:'Heat pump quote for 2-story home',status:'new',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()},
        {id:'LD-1002',name:'Tom Bradley',phone:'540-555-0144',email:'',address:'Augusta County',source:'Referral',serviceInterest:'Electrical - Panel Upgrade',notes:'Neighbor recommended us',status:'contacted',createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
      ],
      requests: [],
      workOrders: [
        {id:'WO-2001',customerId:'u5',customerName:'Bob Martinez',customerPhone:'555-0201',customerAddress:'88 Oak St, Waynesboro, VA',serviceType:'Electrical - Repair',description:'Kitchen outlet not working',urgency:'normal',assignedTo:'u2',assignedName:'Mike Rivera',scheduledDate:'2026-08-22',scheduledTime:'Afternoon',status:'scheduled',notes:'',photos:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}
      ],
      nextId: 2002, nextLeadId: 1003
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

function statusSelect(current, id, className='status-select') {
  return `<select class="${className} border rounded-lg text-xs px-2 py-1.5 bg-white" data-id="${id}">
    ${STATUSES.map(s => `<option value="${s}" ${s===current?'selected':''}>${s.replace(/_/g,' ')}</option>`).join('')}
  </select>`;
}

// ---------- Auth ----------
function renderLogin() {
  $('#app').innerHTML = `
    <div class="min-h-screen flex flex-col">
      <div class="bg-brand-800 text-white px-6 pt-12 pb-10">
        <div class="text-xs text-gold-400 font-semibold tracking-wider uppercase mb-3">Service Portal</div>
        <div class="logo-callison text-3xl leading-none">CALLISON</div>
        <div class="logo-sub mt-0.5">Electric · Heating · Cooling</div>
        <p class="text-slate-300 text-sm mt-4">Schedule service · Track jobs · Manage leads</p>
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
        <p class="text-slate-300 text-sm mt-1">Schedule service online</p>
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
      { id:'jobs', label:'My Jobs' }
    ],
    technician: [
      { id:'jobs', label:'My Jobs' },
      { id:'history', label:'History' }
    ],
    admin: [
      { id:'dashboard', label:'Home' },
      { id:'leads', label:'Leads' },
      { id:'requests', label:'Requests' },
      { id:'orders', label:'Jobs' }
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

// ---------- Customer ----------
async function customerHome() {
  const data = await getData();
  const myJobs = (data.workOrders||[]).filter(w => w.customerId === currentUser.id);
  const open = myJobs.filter(w => w.status !== 'completed' && w.status !== 'cancelled');
  const content = `
    <div class="space-y-4">
      <div class="bg-brand-800 text-white rounded-2xl p-5">
        <div class="text-xs text-gold-400 font-semibold tracking-wide uppercase">Welcome back</div>
        <div class="text-xl font-bold mt-1">${currentUser.name.split(' ')[0]}</div>
        <p class="text-slate-300 text-sm mt-2">Need service? Schedule in under a minute.</p>
        <button data-go="schedule" class="mt-4 btn-gold text-sm px-4 py-2.5 rounded-xl">Schedule Service</button>
      </div>
      <div>
        <h3 class="font-semibold text-sm text-slate-700 mb-2">Active jobs</h3>
        ${open.length === 0 ? '<p class="text-sm text-slate-400">No active jobs</p>' :
          open.map(w => `
            <div class="border border-slate-100 rounded-xl p-3 mb-2">
              <div class="flex justify-between items-start">
                <div>
                  <div class="font-medium text-sm">${w.serviceType}</div>
                  <div class="text-xs text-slate-500 mt-0.5">${w.scheduledDate || 'Pending'} · ${w.id}</div>
                </div>
                <span class="status-pill ${statusColor(w.status)}">${w.status.replace(/_/g,' ')}</span>
              </div>
            </div>`).join('')}
      </div>
    </div>`;
  $('#app').innerHTML = shell('Home', content, 'home');
  bindNav();
}

async function customerSchedule() {
  const content = `
    <div class="space-y-4">
      <div class="bg-slate-50 rounded-2xl p-4 text-sm text-slate-600">
        Request service below. We’ll confirm and text you.
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
          <label class="text-xs font-medium text-slate-500">Photos (optional)</label>
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
      toast('Request submitted!');
      setTimeout(() => customerHome(), 700);
    } catch (err) { toast(err.message, 'error'); }
  };
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
        </div>`).join('')}
    </div>`;
  $('#app').innerHTML = shell('My Jobs', content, 'jobs');
  bindNav();
}

// ---------- Technician ----------
async function techJobs(showHistory=false) {
  const data = await getData();
  let jobs = (data.workOrders||[]).filter(w => w.assignedTo === currentUser.id);
  if (!showHistory) jobs = jobs.filter(w => w.status !== 'completed' && w.status !== 'cancelled');
  else jobs = jobs.filter(w => w.status === 'completed' || w.status === 'cancelled');

  const content = `
    <div class="space-y-3">
      ${jobs.length===0?`<p class="text-center text-slate-400 py-10 text-sm">No ${showHistory?'past':'open'} jobs</p>`:
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
          ${wo.photos?.length ? `<div class="photo-grid grid grid-cols-3 gap-2 mt-3">${wo.photos.map(p => `<img src="${p.dataUrl}" />`).join('')}</div>` : ''}
          ${!showHistory ? `
          <div class="mt-3 flex items-center gap-2">
            <label class="text-xs text-slate-500">Status</label>
            ${statusSelect(wo.status, wo.id)}
          </div>
          <div class="mt-3 flex flex-wrap gap-2">
            ${wo.status==='scheduled'||wo.status==='in_progress'?`
              <button class="onway-btn flex-1 btn-navy text-sm py-2.5 rounded-xl" data-id="${wo.id}">On the Way + SMS</button>`:''}
            ${wo.status!=='completed'?`
              <button class="complete-btn flex-1 btn-gold text-sm py-2.5 rounded-xl" data-id="${wo.id}">Complete + SMS</button>`:''}
          </div>
          <div class="mt-2">
            <label class="text-xs text-slate-500">Add photo</label>
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
  bindStatusSelects();
  bindTechActions(showHistory);
}

function bindStatusSelects() {
  $$('.status-select').forEach(sel => {
    sel.onchange = async () => {
      const id = sel.dataset.id;
      const status = sel.value;
      try {
        if (useBackend) {
          await api('/api/work-orders/' + id, { method:'PATCH', body: JSON.stringify({ status }) });
        } else {
          const d = await getData();
          const wo = d.workOrders.find(w => w.id === id);
          if (wo) {
            wo.status = status;
            wo.updatedAt = new Date().toISOString();
            const stamp = new Date().toLocaleString();
            wo.notes = (wo.notes||'') + `\n[${stamp}] Status → ${status.replace(/_/g,' ')}`;
            localSave(d);
          }
        }
        toast('Status updated to ' + status.replace(/_/g,' '));
        if (currentUser.role === 'technician') techJobs(false);
        else if (currentUser.role === 'admin') adminOrders();
      } catch (e) { toast(e.message, 'error'); }
    };
  });
}

function bindTechActions(showHistory) {
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
          toast('Completed + SMS sent');
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
            method:'POST', body: JSON.stringify({ dataUrl, takenBy: currentUser.name })
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

// ---------- Admin ----------
async function adminDashboard() {
  const data = await getData();
  const pending = (data.requests||[]).filter(r => r.status==='pending').length;
  const openWO = (data.workOrders||[]).filter(w => !['completed','cancelled'].includes(w.status)).length;
  const newLeads = (data.leads||[]).filter(l => l.status==='new' || l.status==='contacted').length;
  const content = `
    <div class="grid grid-cols-3 gap-2 mb-5">
      <div class="bg-amber-50 rounded-2xl p-3 text-center">
        <div class="text-xl font-bold text-amber-700">${newLeads}</div>
        <div class="text-[10px] text-amber-600">Open leads</div>
      </div>
      <div class="bg-blue-50 rounded-2xl p-3 text-center">
        <div class="text-xl font-bold text-blue-700">${pending}</div>
        <div class="text-[10px] text-blue-600">Requests</div>
      </div>
      <div class="bg-indigo-50 rounded-2xl p-3 text-center">
        <div class="text-xl font-bold text-indigo-700">${openWO}</div>
        <div class="text-[10px] text-indigo-600">Open jobs</div>
      </div>
    </div>
    <h3 class="font-semibold text-sm mb-2">Recent leads</h3>
    ${(data.leads||[]).slice(0,4).map(l => `
      <div class="border rounded-xl p-3 mb-2 flex justify-between items-center">
        <div>
          <div class="font-medium text-sm">${l.name}</div>
          <div class="text-xs text-slate-500">${l.serviceInterest||'—'} · ${l.source||''}</div>
        </div>
        <span class="status-pill ${statusColor(l.status)}">${l.status}</span>
      </div>`).join('') || '<p class="text-sm text-slate-400">No leads yet</p>'}
    <button data-go="leads" class="mt-3 w-full border border-dashed border-slate-300 rounded-xl py-2.5 text-sm text-slate-500">View all leads →</button>
  `;
  $('#app').innerHTML = shell('Dashboard', content, 'dashboard');
  bindNav();
}

function leadCardHtml(l, techs) {
  const followNote = l.status === 'quoted' && l.followUpAt
    ? (l.followUpSent
      ? `<div class="text-[10px] text-emerald-600 mt-1">✓ Follow-up SMS sent</div>`
      : `<div class="text-[10px] text-amber-600 mt-1">⏰ Follow-up ${fmtDate(l.followUpAt)}</div>`)
    : '';
  return `
    <div class="border rounded-2xl p-4 ${l.status==='lost'?'opacity-75 bg-slate-50':''}" data-lead-card="${l.id}">
      <div class="flex justify-between items-start">
        <div>
          <div class="font-semibold">${l.name}</div>
          <div class="text-xs text-slate-500 mt-0.5">${l.phone||''} ${l.email? '· '+l.email:''}</div>
          <div class="text-xs text-slate-400">${l.address||''}</div>
        </div>
        <span class="status-pill ${statusColor(l.status)}">${l.status}</span>
      </div>
      <div class="text-sm text-slate-600 mt-2">${l.serviceInterest||''}</div>
      ${followNote}
      ${l.notes?`<p class="text-xs text-slate-500 mt-1">${l.notes}</p>`:''}
      <div class="mt-3 flex flex-wrap gap-2 items-center">
        <select class="lead-status border rounded-lg text-xs px-2 py-1.5" data-id="${l.id}">
          ${LEAD_STATUSES.map(s => `<option value="${s}" ${s===l.status?'selected':''}>${s}</option>`).join('')}
        </select>
        ${l.status!=='converted' && l.status!=='lost'?`
          <button class="show-convert-btn btn-navy text-xs px-3 py-1.5 rounded-lg" data-id="${l.id}">Convert…</button>
          <button class="mark-lost-btn border border-slate-300 text-xs px-3 py-1.5 rounded-lg text-slate-500" data-id="${l.id}">Lost</button>
        `:''}
        ${l.status==='converted'?`<span class="text-xs text-emerald-600 font-medium">✓ Converted</span>`:''}
        ${l.status==='lost'?`<button class="restore-lead-btn text-xs text-brand-800 underline" data-id="${l.id}">Restore</button>`:''}
      </div>
      <div id="convert-panel-${l.id}" class="hidden mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
        <div class="text-xs font-semibold text-slate-700">Convert lead to:</div>
        <div class="flex gap-2">
          <label class="flex items-center gap-1.5 text-xs"><input type="radio" name="conv-type-${l.id}" value="work_order" checked /> Work order</label>
          <label class="flex items-center gap-1.5 text-xs"><input type="radio" name="conv-type-${l.id}" value="request" /> Request</label>
        </div>
        <div class="conv-job-fields-${l.id} space-y-2">
          <select class="conv-tech w-full border rounded-lg text-xs px-2 py-1.5" data-id="${l.id}">
            <option value="">Unassigned</option>
            ${techs.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
          <div class="grid grid-cols-2 gap-2">
            <input type="date" class="conv-date border rounded-lg text-xs px-2 py-1.5" data-id="${l.id}" />
            <select class="conv-time border rounded-lg text-xs px-2 py-1.5" data-id="${l.id}">
              <option>Morning (8am–12pm)</option><option>Afternoon (12pm–5pm)</option><option>Anytime</option>
            </select>
          </div>
          <label class="flex items-center gap-1.5 text-xs"><input type="checkbox" class="conv-sms" data-id="${l.id}" checked /> Send schedule SMS</label>
        </div>
        <div class="flex gap-2">
          <button class="do-convert-btn btn-gold flex-1 text-xs py-2 rounded-lg" data-id="${l.id}">Confirm</button>
          <button class="cancel-convert-btn border flex-1 text-xs py-2 rounded-lg" data-id="${l.id}">Cancel</button>
        </div>
      </div>
    </div>`;
}

async function adminLeads(showLost=false) {
  const data = await getData();
  const all = data.leads || [];
  const techs = (data.users || []).filter(u => u.role === 'technician');
  const active = all.filter(l => l.status !== 'lost');
  const lost = all.filter(l => l.status === 'lost');
  const leads = showLost ? lost : active;
  const dueFollowups = active.filter(l => l.status==='quoted' && l.followUpAt && !l.followUpSent && new Date(l.followUpAt) <= new Date()).length;

  const content = `
    <div class="space-y-3">
      <div class="flex gap-2">
        <button id="tabActiveLeads" class="flex-1 py-2 rounded-xl text-sm font-medium ${!showLost?'btn-navy':'border text-slate-500'}">Active (${active.length})</button>
        <button id="tabLostLeads" class="flex-1 py-2 rounded-xl text-sm font-medium ${showLost?'btn-navy':'border text-slate-500'}">Lost (${lost.length})</button>
      </div>
      ${dueFollowups?`<div class="bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl px-3 py-2">${dueFollowups} quoted lead(s) due for follow-up</div>`:''}
      ${!showLost?`<button id="newLead" class="w-full btn-gold py-2.5 rounded-xl text-sm">+ Add Lead</button>`:''}
      ${leads.length===0?`<p class="text-center text-slate-400 py-8 text-sm">${showLost?'No lost leads':'No active leads'}</p>`:
        leads.map(l => leadCardHtml(l, techs)).join('')}
    </div>`;
  $('#app').innerHTML = shell(showLost ? 'Lost Leads' : 'Leads', content, 'leads');
  bindNav();
  const ta = $('#tabActiveLeads'); if (ta) ta.onclick = () => adminLeads(false);
  const tl = $('#tabLostLeads'); if (tl) tl.onclick = () => adminLeads(true);

  leads.forEach(l => {
    $$(`input[name="conv-type-${l.id}"]`).forEach(radio => {
      radio.onchange = () => {
        const fields = $(`.conv-job-fields-${l.id}`);
        const isJob = document.querySelector(`input[name="conv-type-${l.id}"][value="work_order"]`)?.checked;
        if (fields) fields.style.display = isJob ? 'block' : 'none';
      };
    });
  });

  const nl = $('#newLead');
  if (nl) nl.onclick = async () => {
    const name = prompt('Name'); if (!name) return;
    const phone = prompt('Phone') || '';
    const email = prompt('Email (optional)') || '';
    const address = prompt('Address (optional)') || '';
    const serviceInterest = prompt('Service interest') || '';
    const source = prompt('Source') || 'Other';
    const notes = prompt('Notes') || '';
    const body = { name, phone, email, address, serviceInterest, source, notes, status: 'new' };
    try {
      if (useBackend) await api('/api/leads', { method:'POST', body: JSON.stringify(body) });
      else {
        const d = await getData();
        d.leads.unshift({ id:'LD-'+(d.nextLeadId++), ...body, createdAt:new Date().toISOString(), updatedAt:new Date().toISOString() });
        localSave(d);
      }
      toast('Lead added'); adminLeads();
    } catch(e) { toast(e.message,'error'); }
  };

  $$('.lead-status').forEach(sel => {
    sel.onchange = async () => {
      try {
        if (useBackend) await api('/api/leads/'+sel.dataset.id, { method:'PATCH', body: JSON.stringify({ status: sel.value }) });
        else {
          const d = await getData();
          const l = d.leads.find(x => x.id === sel.dataset.id);
          if (l) {
            const prev = l.status;
            l.status = sel.value;
            l.updatedAt = new Date().toISOString();
            if (sel.value === 'quoted' && prev !== 'quoted') {
              const d3 = new Date(); d3.setDate(d3.getDate()+3);
              l.followUpAt = d3.toISOString(); l.followUpSent = false;
              l.notes = (l.notes||'') + '\\n['+new Date().toLocaleString()+'] quoted · follow-up in 3 days';
            }
            localSave(d);
          }
        }
        toast(sel.value==='quoted' ? 'Quoted — follow-up in 3 days' : 'Lead status updated');
        adminLeads(sel.value==='lost' || showLost);
      } catch(e) { toast(e.message,'error'); }
    };
  });

  $$('.mark-lost-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        if (useBackend) await api('/api/leads/'+btn.dataset.id, { method:'PATCH', body: JSON.stringify({ status: 'lost' }) });
        else {
          const d = await getData();
          const l = d.leads.find(x => x.id === btn.dataset.id);
          if (l) { l.status = 'lost'; l.updatedAt = new Date().toISOString(); localSave(d); }
        }
        toast('Marked lost'); adminLeads(false);
      } catch(e) { toast(e.message,'error'); }
    };
  });

  $$('.restore-lead-btn').forEach(btn => {
    btn.onclick = async () => {
      try {
        if (useBackend) await api('/api/leads/'+btn.dataset.id, { method:'PATCH', body: JSON.stringify({ status: 'contacted' }) });
        else {
          const d = await getData();
          const l = d.leads.find(x => x.id === btn.dataset.id);
          if (l) { l.status = 'contacted'; l.updatedAt = new Date().toISOString(); localSave(d); }
        }
        toast('Restored'); adminLeads(true);
      } catch(e) { toast(e.message,'error'); }
    };
  });

  $$('.show-convert-btn').forEach(btn => {
    btn.onclick = () => { const panel = $(`#convert-panel-${btn.dataset.id}`); if (panel) panel.classList.toggle('hidden'); };
  });
  $$('.cancel-convert-btn').forEach(btn => {
    btn.onclick = () => { const panel = $(`#convert-panel-${btn.dataset.id}`); if (panel) panel.classList.add('hidden'); };
  });

  $$('.do-convert-btn').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.id;
      const to = document.querySelector(`input[name="conv-type-${id}"]:checked`)?.value || 'work_order';
      const assignedTo = $(`.conv-tech[data-id="${id}"]`)?.value || null;
      const scheduledDate = $(`.conv-date[data-id="${id}"]`)?.value || null;
      const scheduledTime = $(`.conv-time[data-id="${id}"]`)?.value || 'Anytime';
      const sendSms = $(`.conv-sms[data-id="${id}"]`)?.checked || false;
      btn.disabled = true; btn.textContent = '…';
      try {
        if (useBackend) {
          const result = await api('/api/leads/'+id+'/convert', { method:'POST', body: JSON.stringify({ to, assignedTo, scheduledDate, scheduledTime, sendSms }) });
          if (to === 'work_order' && sendSms && result.workOrder) {
            try { await api('/api/work-orders/'+result.workOrder.id+'/status', { method:'POST', body: JSON.stringify({ sendSms: 'scheduled' }) }); } catch {}
          }
          toast(to === 'work_order' ? 'Converted to work order' : 'Converted to request');
        } else {
          const d = await getData();
          const l = d.leads.find(x => x.id === id);
          if (!l) throw new Error('Lead not found');
          if (to === 'work_order') {
            const tech = d.users.find(u => u.id === assignedTo);
            d.workOrders.unshift({
              id:'WO-'+(d.nextId++), leadId:l.id, customerName:l.name, customerPhone:l.phone,
              customerAddress:l.address, serviceType:l.serviceInterest||'Service', description:l.notes||'',
              assignedTo:assignedTo||null, assignedName:tech?.name||null, status:'scheduled',
              scheduledDate, scheduledTime, notes:`From lead ${l.id}`, photos:[],
              createdAt:new Date().toISOString(), updatedAt:new Date().toISOString()
            });
          } else {
            d.requests.unshift({
              id:'SR-'+Date.now(), leadId:l.id, customerName:l.name, customerPhone:l.phone,
              customerAddress:l.address, serviceType:l.serviceInterest||'Service', description:l.notes||'',
              status:'pending', preferredDate:scheduledDate||'', preferredTime:scheduledTime,
              createdAt:new Date().toISOString(), photos:[]
            });
          }
          l.status = 'converted'; l.updatedAt = new Date().toISOString();
          localSave(d);
          toast('Converted');
        }
        adminLeads();
      } catch(e) { toast(e.message,'error'); btn.disabled=false; btn.textContent='Confirm'; }
    };
  });
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
          <div class="text-xs text-slate-500">${r.serviceType} · ${r.preferredDate||''} ${r.preferredTime||''}</div>
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
        requestId: r.id, customerId: r.customerId, customerName: r.customerName,
        customerPhone: r.customerPhone, customerAddress: r.customerAddress,
        serviceType: r.serviceType, description: r.description, urgency: r.urgency,
        assignedTo: sel.value || null, scheduledDate: r.preferredDate,
        scheduledTime: r.preferredTime, photos: r.photos || [], sendSms: true
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
  const techs = (data.users||[]).filter(u => u.role==='technician');
  const content = `
    <div class="space-y-3">
      ${wos.length===0?'<p class="text-sm text-slate-400">No work orders</p>':
      wos.map(wo => `
        <div class="border rounded-xl p-3">
          <div class="flex justify-between items-start gap-2">
            <div>
              <div class="font-medium text-sm">${wo.customerName}</div>
              <div class="text-xs text-slate-500">${wo.serviceType} · ${wo.assignedName||'Unassigned'} · ${wo.id}</div>
            </div>
            <span class="status-pill ${statusColor(wo.status)}">${wo.status.replace(/_/g,' ')}</span>
          </div>
          <div class="mt-2 flex flex-wrap gap-2 items-center">
            <label class="text-xs text-slate-500">Status</label>
            ${statusSelect(wo.status, wo.id)}
            <select class="assign-select border rounded-lg text-xs px-2 py-1.5" data-id="${wo.id}">
              <option value="">Reassign…</option>
              ${techs.map(t=>`<option value="${t.id}" ${t.id===wo.assignedTo?'selected':''}>${t.name}</option>`).join('')}
            </select>
          </div>
          ${wo.photos?.length?`<div class="photo-grid grid grid-cols-4 gap-1 mt-2">${wo.photos.slice(0,4).map(p=>`<img src="${p.dataUrl}"/>`).join('')}</div>`:''}
        </div>`).join('')}
    </div>`;
  $('#app').innerHTML = shell('Work Orders', content, 'orders');
  bindNav();
  bindStatusSelects();
  $$('.assign-select').forEach(sel => {
    sel.onchange = async () => {
      if (!sel.value) return;
      try {
        if (useBackend) {
          await api('/api/work-orders/'+sel.dataset.id, { method:'PATCH', body: JSON.stringify({ assignedTo: sel.value }) });
        } else {
          const d = await getData();
          const wo = d.workOrders.find(w => w.id === sel.dataset.id);
          const tech = d.users.find(u => u.id === sel.value);
          if (wo) { wo.assignedTo = sel.value; wo.assignedName = tech?.name||null; localSave(d); }
        }
        toast('Tech reassigned');
        adminOrders();
      } catch(e) { toast(e.message,'error'); }
    };
  });
}

// ---------- Nav ----------
function bindNav() {
  $$('.tab-btn').forEach(btn => { btn.onclick = () => go(btn.dataset.tab); });
  $$('[data-go]').forEach(btn => { btn.onclick = () => go(btn.dataset.go); });
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
    else if (tab==='jobs') customerJobs();
  } else if (role === 'technician') {
    if (tab==='jobs') techJobs(false);
    else if (tab==='history') techJobs(true);
  } else if (role === 'admin') {
    if (tab==='dashboard') adminDashboard();
    else if (tab==='leads') adminLeads();
    else if (tab==='requests') adminRequests();
    else if (tab==='orders') adminOrders();
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
