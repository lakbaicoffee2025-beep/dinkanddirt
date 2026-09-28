# 🏓 Dink & Dirt Pickleball – Booking System

A full-featured court booking system built for Netlify.

## Features

### Customer-Facing (`/`)
- Monthly calendar view to select booking dates
- Hourly time slots (10:30 AM – 11:00 PM, Mon–Sun)
- Multi-hour selection (consecutive hours)
- Real-time availability — booked slots shown as locked
- Name, phone number, and payment screenshot upload
- Booking confirmation screen

### Admin Panel (`/admin/`)
- Password-protected login
- Dashboard with today's schedule + monthly/weekly stats
- Monthly calendar view with bookings per day
- Full bookings list with search/filter
- **Edit bookings** — change date, time, name, phone, status
- **Cancel bookings**
- **Export to CSV** — monthly or weekly reports

---

## Deployment to Netlify

### 1. Install dependencies
```bash
npm install
```

### 2. Create a Netlify site
- Go to [netlify.com](https://netlify.com) and create a free account
- Create a new site

### 3. Set environment variables
In your Netlify dashboard → Site settings → Environment variables, add:

```
ADMIN_PASSWORD = your_secure_password_here
```

> The default password (if not set) is `dinkanddirt2024admin` — **change this before going live!**

Optional — super admin (owner's commission report at `/super/`):

```
SUPER_ADMIN_PASSWORD = a_different_secure_password
COMMISSION_PER_HOUR = 10               # optional, defaults to 10 (PHP)
```

The super admin page is disabled until `SUPER_ADMIN_PASSWORD` is set. It lists every
booking transaction made in a month and the commission owed (PHP 10 per booked
hour for online bookings and admin-added walk-ins).

### 4. Deploy via Netlify CLI
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

Or connect your GitHub repo to Netlify for automatic deploys.

### 5. Enable Netlify Blobs
Netlify Blobs is automatically available on all Netlify sites (no extra setup needed). Data persists across deploys.

---

## Project Structure

```
dinkanddirt/
├── netlify.toml              # Netlify config
├── package.json
├── netlify/
│   └── functions/
│       └── bookings.mjs      # Serverless API (CRUD + auth)
└── public/
    ├── index.html            # Customer booking page
    └── admin/
        └── index.html        # Admin dashboard
```

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/bookings?month=YYYY-MM` | List bookings |
| POST | `/api/bookings` | Create booking |
| GET | `/api/bookings/:id` | Get single booking |
| PUT | `/api/bookings/:id` | Update booking (admin) |
| DELETE | `/api/bookings/:id` | Cancel booking (admin) |

## Notes
- Payment screenshots are stored as base64 in Netlify Blobs
- Booking conflicts are checked server-side
- Only the first letter of a booker's name is shown to other customers (privacy)
