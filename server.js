require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const crypto = require('crypto');
const { db } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'swiftship2025';

app.use(cors());
app.use(express.json());

function adminAuth(req, res, next) {
  const token = req.headers['x-admin-token'];
  if (!token || !verifyToken(token)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in to admin.' });
  }
  next();
}

function signToken() {
  const payload = `admin:${Date.now()}`;
  const sig = crypto.createHmac('sha256', ADMIN_PASSWORD).update(payload).digest('hex');
  return Buffer.from(`${payload}:${sig}`).toString('base64url');
}

function verifyToken(token) {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [payload, sig] = decoded.split(':');
    const expected = crypto.createHmac('sha256', ADMIN_PASSWORD).update(payload).digest('hex');
    if (sig !== expected) return false;
    const ts = parseInt(payload.split(':')[1], 10);
    return Date.now() - ts < 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function generateTrackingId() {
  const n = Date.now().toString(36).toUpperCase().slice(-6);
  return `SS-${n}-CM`;
}

/* ---------- Public API ---------- */

app.get('/api/health', (req, res) => {
  res.json({ ok: true, service: 'SwiftShip API' });
});

app.post('/api/quotes', (req, res) => {
  const { name, email, phone, company, pickup, delivery, service, weight, package: packageDesc, date } = req.body;
  if (!name || !email || !pickup || !delivery || !service) {
    return res.status(400).json({ error: 'Missing required fields.' });
  }

  const result = db.prepare(`
    INSERT INTO quotes (name, email, phone, company, pickup, delivery, service, weight, package_desc, ship_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(name, email, phone || null, company || null, pickup, delivery, service, weight || null, packageDesc || null, date || null);

  res.status(201).json({
    success: true,
    quoteId: result.lastInsertRowid,
    message: 'Quote request saved. Our team will contact you within one business day.',
  });
});

app.post('/api/contact', (req, res) => {
  const { name, email, subject, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Name, email, and message are required.' });
  }

  db.prepare('INSERT INTO contacts (name, email, subject, message) VALUES (?, ?, ?, ?)').run(
    name, email, subject || 'General inquiry', message
  );

  res.status(201).json({ success: true, message: 'Message received. We will reply soon.' });
});

app.post('/api/subscribe', (req, res) => {
  const { email } = req.body;
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: 'Valid email required.' });
  }

  try {
    db.prepare('INSERT INTO subscribers (email) VALUES (?)').run(email.toLowerCase().trim());
    res.status(201).json({ success: true, message: 'Subscribed successfully.' });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.json({ success: true, message: 'You are already subscribed.' });
    }
    throw err;
  }
});

app.get('/api/track/:trackingId', (req, res) => {
  const trackingId = req.params.trackingId.trim().toUpperCase();
  const shipment = db.prepare('SELECT * FROM shipments WHERE UPPER(tracking_id) = ?').get(trackingId);

  if (!shipment) {
    return res.status(404).json({ error: 'Tracking ID not found. Check the number or contact support.' });
  }

  const events = db.prepare(`
    SELECT status, location, event_time, is_current
    FROM tracking_events WHERE shipment_id = ?
    ORDER BY sort_order ASC
  `).all(shipment.id);

  res.json({
    trackingId: shipment.tracking_id,
    origin: shipment.origin,
    destination: shipment.destination,
    status: shipment.status,
    statusLabel: formatStatus(shipment.status),
    events: events.map((e) => ({
      status: e.status,
      location: e.location,
      eventTime: e.event_time,
      isCurrent: !!e.is_current,
      done: e.event_time !== 'Pending',
    })),
  });
});

app.post('/api/estimate', (req, res) => {
  const { origin, destination, weight, service } = req.body;
  const w = parseFloat(weight) || 1;
  const base = { standard: 45, express: 85, freight: 120 }[service] || 45;
  const perKg = { standard: 2.5, express: 5.2, freight: 3.8 }[service] || 2.5;
  const amount = Math.round(base + w * perKg);
  res.json({ origin, destination, weight: w, service, amount, currency: 'USD' });
});

/* ---------- Admin API ---------- */

app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  if (password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password.' });
  }
  res.json({ success: true, token: signToken() });
});

app.get('/api/admin/quotes', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM quotes ORDER BY created_at DESC').all();
  res.json(rows);
});

app.get('/api/admin/contacts', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM contacts ORDER BY created_at DESC').all();
  res.json(rows);
});

app.get('/api/admin/subscribers', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM subscribers ORDER BY created_at DESC').all();
  res.json(rows);
});

app.get('/api/admin/shipments', adminAuth, (req, res) => {
  const rows = db.prepare('SELECT * FROM shipments ORDER BY created_at DESC').all();
  res.json(rows);
});

app.patch('/api/admin/quotes/:id', adminAuth, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE quotes SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/shipments', adminAuth, (req, res) => {
  const { trackingId, origin, destination, recipientName, recipientEmail, quoteId, status } = req.body;
  if (!origin || !destination) {
    return res.status(400).json({ error: 'Origin and destination required.' });
  }

  const tid = (trackingId || generateTrackingId()).toUpperCase();

  try {
    const result = db.prepare(`
      INSERT INTO shipments (tracking_id, origin, destination, status, recipient_name, recipient_email, quote_id)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(tid, origin, destination, status || 'pending', recipientName || null, recipientEmail || null, quoteId || null);

    res.status(201).json({ success: true, trackingId: tid, shipmentId: result.lastInsertRowid });
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Tracking ID already exists.' });
    }
    throw err;
  }
});

app.post('/api/admin/shipments/:id/events', adminAuth, (req, res) => {
  const shipmentId = req.params.id;
  const { status, location, eventTime, isCurrent } = req.body;
  if (!status || !location) {
    return res.status(400).json({ error: 'Status and location required.' });
  }

  const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM tracking_events WHERE shipment_id = ?').get(shipmentId);
  const sortOrder = (maxOrder?.m || 0) + 1;

  if (isCurrent) {
    db.prepare('UPDATE tracking_events SET is_current = 0 WHERE shipment_id = ?').run(shipmentId);
    db.prepare('UPDATE shipments SET status = ? WHERE id = ?').run(status.toLowerCase().replace(/\s+/g, '_'), shipmentId);
  }

  db.prepare(`
    INSERT INTO tracking_events (shipment_id, status, location, event_time, is_current, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(shipmentId, status, location, eventTime || new Date().toISOString().slice(0, 16).replace('T', ' '), isCurrent ? 1 : 0, sortOrder);

  res.status(201).json({ success: true });
});

app.delete('/api/admin/shipments/:id', adminAuth, (req, res) => {
  db.prepare('DELETE FROM shipments WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

function formatStatus(status) {
  const map = {
    pending: 'Pending',
    picked_up: 'Picked up',
    in_transit: 'In transit',
    customs: 'Customs',
    out_for_delivery: 'Out for delivery',
    delivered: 'Delivered',
  };
  return map[status] || status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Server error. Please try again.' });
});

/* Static website files (after API routes) */
app.use(express.static(__dirname));

app.listen(PORT, () => {
  console.log(`SwiftShip running at http://localhost:${PORT}`);
  console.log(`Admin panel: http://localhost:${PORT}/admin.html`);
  console.log(`Demo tracking ID: SS-DEMO001`);
  console.log(`Default admin password: ${ADMIN_PASSWORD} (change in .env)`);
});
