# SwiftShip — Logistics Website + Backend

A shipping/logistics website with a **real Node.js API** and **SQLite database**.

## What works for real

| Feature | What happens |
|--------|----------------|
| **Quote requests** | Saved to database; you see them in Admin |
| **Contact messages** | Saved to database |
| **Newsletter** | Emails stored in database |
| **Track shipment** | Looks up real tracking IDs from database |
| **Admin panel** | View quotes/messages, create shipments, add tracking updates |

## Quick start

1. Install [Node.js](https://nodejs.org/) (version 18 or newer).

2. Open a terminal in this folder and run:

```bash
npm install
npm start
```

3. Open in your browser:

- **Website:** http://localhost:3000  
- **Track demo:** http://localhost:3000/track.html?id=SS-DEMO001  
- **Admin:** http://localhost:3000/admin.html  

**Default admin password:** `swiftship2025`

Change it by copying `.env.example` to `.env`:

```
ADMIN_PASSWORD=your-secure-password
PORT=3000
```

## Important

Do **not** open `index.html` by double-clicking the file. Forms and tracking need the server running at `http://localhost:3000`.

## Admin workflow

1. Customer submits a quote on **Get a quote** page → appears in Admin → **Quote requests**.
2. You create a shipment in **+ New shipment** → you get a tracking ID (e.g. `SS-ABC123-CM`).
3. Add tracking updates in **+ New shipment** → **Add tracking update** (use shipment ID from list).
4. Customer tracks at **Track** page with that ID.

## Data storage

All data is in `data/swiftship.db` (SQLite). Back up this file to keep your records.

## Next steps (optional)

- Email notifications (SendGrid, Nodemailer)
- Deploy to Render, Railway, or VPS
- Connect real carrier APIs (DHL, FedEx)
