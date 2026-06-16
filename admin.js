(function () {
  'use strict';

  const TOKEN_KEY = 'swiftship_admin_token';
  const API = '/api';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  function setToken(token) {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  }

  async function api(method, path, body) {
    const res = await fetch(API + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Token': getToken() || '',
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  }

  const loginSection = document.getElementById('loginSection');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginMessage = document.getElementById('loginMessage');

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginMessage.textContent = '';
    try {
      const data = await api('POST', '/admin/login', {
        password: document.getElementById('adminPassword').value,
      });
      setToken(data.token);
      showDashboard();
    } catch (err) {
      loginMessage.className = 'form-error';
      loginMessage.textContent =
        err.message === 'Failed to fetch'
          ? 'Cannot reach server. Run: npm install && npm start'
          : err.message;
    }
  });

  document.getElementById('logoutBtn').addEventListener('click', () => {
    setToken(null);
    loginSection.hidden = false;
    dashboard.hidden = true;
  });

  document.querySelectorAll('.admin-tab').forEach((tab) => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach((t) => t.classList.remove('is-active'));
      document.querySelectorAll('.admin-panel').forEach((p) => {
        p.classList.remove('is-active');
        p.hidden = true;
      });
      tab.classList.add('is-active');
      const panel = document.getElementById('panel-' + tab.dataset.panel);
      panel.hidden = false;
      panel.classList.add('is-active');
    });
  });

  document.getElementById('newShipmentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const result = document.getElementById('newShipmentResult');
    const fd = new FormData(e.target);
    try {
      const data = await api('POST', '/admin/shipments', {
        trackingId: fd.get('trackingId') || undefined,
        origin: fd.get('origin'),
        destination: fd.get('destination'),
        recipientName: fd.get('recipientName'),
        recipientEmail: fd.get('recipientEmail'),
      });
      result.className = 'form-success';
      result.textContent = `Shipment created! Tracking ID: ${data.trackingId}`;
      e.target.reset();
      loadShipments();
    } catch (err) {
      result.className = 'form-error';
      result.textContent = err.message;
    }
  });

  document.getElementById('addEventForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const result = document.getElementById('addEventResult');
    const fd = new FormData(e.target);
    try {
      await api('POST', `/admin/shipments/${fd.get('shipmentId')}/events`, {
        status: fd.get('status'),
        location: fd.get('location'),
        eventTime: fd.get('eventTime') || undefined,
        isCurrent: fd.get('isCurrent') === 'on',
      });
      result.className = 'form-success';
      result.textContent = 'Tracking update added.';
      loadShipments();
    } catch (err) {
      result.className = 'form-error';
      result.textContent = err.message;
    }
  });

  if (getToken()) {
    showDashboard().catch(() => {
      setToken(null);
      loginSection.hidden = false;
    });
  }

  async function showDashboard() {
    await api('GET', '/admin/quotes');
    loginSection.hidden = true;
    dashboard.hidden = false;
    await Promise.all([loadQuotes(), loadContacts(), loadShipments()]);
  }

  async function loadQuotes() {
    const quotes = await api('GET', '/admin/quotes');
    const el = document.getElementById('quotesList');
    if (!quotes.length) {
      el.innerHTML = '<p class="form-hint">No quote requests yet.</p>';
      return;
    }
    el.innerHTML = quotes
      .map(
        (q) => `
      <article class="admin-card">
        <header>
          <strong>#${q.id} · ${esc(q.name)}</strong>
          <span class="admin-badge">${esc(q.status)}</span>
        </header>
        <p><a href="mailto:${esc(q.email)}">${esc(q.email)}</a> · ${esc(q.phone || '—')}</p>
        <p>${esc(q.pickup)} → ${esc(q.delivery)}</p>
        <p>Service: <strong>${esc(q.service)}</strong> · ${q.weight || '?'} kg</p>
        <p class="admin-meta">${esc(q.package_desc || '')} · Ship: ${esc(q.ship_date || 'TBD')} · ${esc(q.created_at)}</p>
        <button type="button" class="btn primary-btn btn-sm" data-mark-quote="${q.id}">Mark reviewed</button>
      </article>`
      )
      .join('');

    el.querySelectorAll('[data-mark-quote]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        await api('PATCH', `/admin/quotes/${btn.dataset.markQuote}`, { status: 'reviewed' });
        loadQuotes();
      });
    });
  }

  async function loadContacts() {
    const rows = await api('GET', '/admin/contacts');
    const el = document.getElementById('contactsList');
    if (!rows.length) {
      el.innerHTML = '<p class="form-hint">No messages yet.</p>';
      return;
    }
    el.innerHTML = rows
      .map(
        (c) => `
      <article class="admin-card">
        <header><strong>${esc(c.name)}</strong> · ${esc(c.subject)}</header>
        <p><a href="mailto:${esc(c.email)}">${esc(c.email)}</a></p>
        <p>${esc(c.message)}</p>
        <p class="admin-meta">${esc(c.created_at)}</p>
      </article>`
      )
      .join('');
  }

  async function loadShipments() {
    const rows = await api('GET', '/admin/shipments');
    const el = document.getElementById('shipmentsList');
    if (!rows.length) {
      el.innerHTML = '<p class="form-hint">No shipments. Create one in the New shipment tab.</p>';
      return;
    }
    el.innerHTML = rows
      .map(
        (s) => `
      <article class="admin-card">
        <header>
          <strong>${esc(s.tracking_id)}</strong>
          <span class="admin-badge">ID ${s.id} · ${esc(s.status)}</span>
        </header>
        <p>${esc(s.origin)} → ${esc(s.destination)}</p>
        <p>${esc(s.recipient_name || '—')}</p>
        <p class="admin-meta">Created ${esc(s.created_at)}</p>
        <a href="track.html?id=${encodeURIComponent(s.tracking_id)}" class="freight-link" target="_blank">View tracking page →</a>
      </article>`
      )
      .join('');
  }

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  }
})();
