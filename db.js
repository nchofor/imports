const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'swiftship.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS quotes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    company TEXT,
    pickup TEXT NOT NULL,
    delivery TEXT NOT NULL,
    service TEXT NOT NULL,
    weight REAL,
    package_desc TEXT,
    ship_date TEXT,
    status TEXT DEFAULT 'pending',
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT,
    message TEXT NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS subscribers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE,
    created_at TEXT DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS shipments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tracking_id TEXT NOT NULL UNIQUE,
    origin TEXT NOT NULL,
    destination TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    recipient_name TEXT,
    recipient_email TEXT,
    quote_id INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (quote_id) REFERENCES quotes(id)
  );

  CREATE TABLE IF NOT EXISTS tracking_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    shipment_id INTEGER NOT NULL,
    status TEXT NOT NULL,
    location TEXT NOT NULL,
    event_time TEXT NOT NULL,
    is_current INTEGER DEFAULT 0,
    sort_order INTEGER NOT NULL,
    FOREIGN KEY (shipment_id) REFERENCES shipments(id) ON DELETE CASCADE
  );
`);

function seedDemoShipment() {
  const existing = db.prepare('SELECT id FROM shipments WHERE tracking_id = ?').get('SS-DEMO001');
  if (existing) return;

  const insert = db.prepare(`
    INSERT INTO shipments (tracking_id, origin, destination, status, recipient_name)
    VALUES ('SS-DEMO001', 'Douala, Cameroon', 'Paris, France', 'in_transit', 'Demo Customer')
  `);
  const info = insert.run();
  const shipmentId = info.lastInsertRowid;

  const events = [
    ['Order placed', 'SwiftShip online portal', '2025-05-28 09:14', 0, 1],
    ['Picked up', 'Douala Hub, Cameroon', '2025-05-28 14:30', 0, 2],
    ['In transit', 'Charles de Gaulle Airport — air freight', '2025-05-29 06:00', 1, 3],
    ['Customs clearance', 'Paris CDG, France', 'Pending', 0, 4],
    ['Out for delivery', 'Local courier — Paris', 'Pending', 0, 5],
    ['Delivered', 'Recipient address', 'Pending', 0, 6],
  ];

  const evt = db.prepare(`
    INSERT INTO tracking_events (shipment_id, status, location, event_time, is_current, sort_order)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  for (const row of events) {
    evt.run(shipmentId, ...row);
  }
}

seedDemoShipment();

module.exports = { db, seedDemoShipment };
