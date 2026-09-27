import { getStore } from "@netlify/blobs";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "dinkanddirt2024admin";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

async function getOccupiedRanges(store, date, excludeKey = null) {
  const allKeys = await store.list();
  const keys = allKeys.blobs
    .map(b => b.key)
    .filter(k => k !== excludeKey && (k.startsWith("booking_") || k.startsWith("block_")));
  const items = await Promise.all(keys.map(k => store.get(k, { type: "json" })));
  return items
    .filter(d => d && d.date === date && d.status !== "cancelled" && d.status !== "on_hold")
    .map(d => ({ start: d.startHour, end: d.endHour }));
}

function hasConflict(ranges, startHour, endHour) {
  return ranges.some(r => startHour < r.end && endHour > r.start);
}

export default async function handler(req, context) {
  if (req.method === "OPTIONS") {
    return new Response("", { status: 204, headers: corsHeaders() });
  }

  const store = getStore({ name: "bookings", consistency: "strong" });
  const url = new URL(req.url);
  const path = url.pathname
    .replace(/^\/api\/bookings/, "")
    .replace(/^\/.netlify\/functions\/bookings/, "");
  const segments = path.split("/").filter(Boolean);
  const action = segments[0];

  try {

    // GET list
    if (req.method === "GET" && !action) {
      const month = url.searchParams.get("month");
      const allKeys = await store.list();
      const keys = allKeys.blobs
        .map(b => b.key)
        .filter(k => k.startsWith("booking_") || k.startsWith("block_"));
      const items = await Promise.all(keys.map(k => store.get(k, { type: "json" })));
      const bookings = items
        .filter(data => data && (!month || data.date.startsWith(month)))
        .map(data => {
          const { paymentData, ...safeData } = data;
          safeData.hasPayment = !!paymentData;
          return safeData;
        });
      bookings.sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.startHour - b.startHour;
      });
      return new Response(JSON.stringify({ bookings }), { headers: corsHeaders() });
    }

    // POST /verify - check admin password
    if (req.method === "POST" && action === "verify") {
      const body = await req.json();
      if (body.adminPassword !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Invalid password" }), { status: 401, headers: corsHeaders() });
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
    }

    // POST /cleanup-storage - admin only - strips stored receipt images to free storage
    // Body options: { olderThanDays: 14 } to age-filter, { ids: ["id1","id2"] } for selective delete,
    // or neither to strip all base64 images (legacy cleanup).
    if (req.method === "POST" && action === "cleanup-storage") {
      const body = await req.json();
      if (body.adminPassword !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
      }
      const { olderThanDays, ids } = body;
      const cutoffMs = olderThanDays ? olderThanDays * 24 * 60 * 60 * 1000 : null;
      const now = Date.now();
      const allKeys = await store.list();
      const keys = allKeys.blobs.map(b => b.key).filter(k => k.startsWith("booking_") || k.startsWith("block_"));
      let cleaned = 0;
      for (const key of keys) {
        const item = await store.get(key, { type: "json" });
        if (!item || !item.paymentData) continue;
        if (ids && ids.length > 0 && !ids.includes(item.id)) continue;
        if (cutoffMs && (now - new Date(item.createdAt).getTime()) < cutoffMs) continue;
        if (!ids && !cutoffMs && !item.paymentData.startsWith("data:")) continue;
        await store.setJSON(key, { ...item, paymentData: null, paymentDataCleaned: true });
        cleaned++;
      }
      return new Response(JSON.stringify({ success: true, cleaned }), { headers: corsHeaders() });
    }

    // POST /block  - admin creates a block
    if (req.method === "POST" && action === "block") {
      const body = await req.json();
      const { adminPassword, date, startHour, endHour, reason } = body;
      if (adminPassword !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
      }
      if (!date || startHour === undefined || endHour === undefined) {
        return new Response(JSON.stringify({ error: "Missing fields" }), { status: 400, headers: corsHeaders() });
      }
      const occupied = await getOccupiedRanges(store, date);
      if (hasConflict(occupied, startHour, endHour)) {
        return new Response(JSON.stringify({ error: "Time slot conflict with an existing booking or block." }), { status: 409, headers: corsHeaders() });
      }
      const id = generateId();
      const block = {
        id,
        type: "block",
        name: reason ? `[Blocked] ${reason}` : "[Internal Block]",
        phone: "—",
        date,
        startHour,
        endHour,
        status: "confirmed",
        reason: reason || "",
        createdAt: new Date().toISOString(),
        notes: reason || "",
      };
      await store.setJSON(`block_${id}`, block);
      return new Response(JSON.stringify({ block }), { status: 201, headers: corsHeaders() });
    }

    // DELETE /block/:id  - admin removes a block permanently
    if (req.method === "DELETE" && action === "block") {
      const blockId = segments[1];
      const body = await req.json();
      if (body.adminPassword !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
      }
      const existing = await store.get(`block_${blockId}`, { type: "json" });
      if (!existing) {
        return new Response(JSON.stringify({ error: "Block not found" }), { status: 404, headers: corsHeaders() });
      }
      await store.delete(`block_${blockId}`);
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
    }

    // POST / - customer creates booking
    if (req.method === "POST" && !action) {
      const body = await req.json();
      const { name, phone, date, startHour, endHour, paymentData, paymentType, type: bookingType, adminPassword, addedByName } = body;
      if (!name || !phone || !date || startHour === undefined || endHour === undefined) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400, headers: corsHeaders() });
      }
      const occupied = await getOccupiedRanges(store, date);
      if (hasConflict(occupied, startHour, endHour)) {
        return new Response(JSON.stringify({ error: "Time slot conflict. Please choose different hours." }), { status: 409, headers: corsHeaders() });
      }
      const isAdmin = adminPassword === ADMIN_PASSWORD;
      const id = generateId();
      const booking = {
        id,
        type: bookingType === "internal" ? "internal" : "customer",
        name: name.trim(),
        phone: phone.trim(),
        date,
        startHour,
        endHour,
        paymentData: paymentData || null,
        paymentType: paymentType || null,
        status: "confirmed",
        createdAt: new Date().toISOString(),
        notes: body.notes || "",
        bookedByAdmin: isAdmin,
        addedByName: isAdmin && addedByName ? String(addedByName).trim().slice(0, 80) : null,
      };
      await store.setJSON(`booking_${id}`, booking);
      const { paymentData: _, ...safeBooking } = booking;
      safeBooking.hasPayment = !!paymentData;
      return new Response(JSON.stringify({ booking: safeBooking }), { status: 201, headers: corsHeaders() });
    }

    // GET /settings - public
    if (req.method === "GET" && action === "settings") {
      let settings = await store.get("settings_main", { type: "json" });
      if (!settings) settings = { customerOpenHour: 13, customerCloseHour: 23 };
      return new Response(JSON.stringify({ settings }), { headers: corsHeaders() });
    }

    // POST /settings - admin only
    if (req.method === "POST" && action === "settings") {
      const body = await req.json();
      if (body.adminPassword !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
      }
      const { customerOpenHour, customerCloseHour } = body;
      const settings = { customerOpenHour: Number(customerOpenHour), customerCloseHour: Number(customerCloseHour) };
      await store.setJSON("settings_main", settings);
      return new Response(JSON.stringify({ settings }), { headers: corsHeaders() });
    }

    // GET /banner - public
    if (req.method === "GET" && action === "banner") {
      let banner = await store.get("settings_banner", { type: "json" });
      if (!banner) banner = { active: false, imageData: null, link: "" };
      return new Response(JSON.stringify({ banner }), { headers: corsHeaders() });
    }

    // POST /banner - admin only
    if (req.method === "POST" && action === "banner") {
      const body = await req.json();
      if (body.adminPassword !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
      }
      const { active, imageData, link } = body;
      const banner = { active: !!active, imageData: imageData || null, link: link || "" };
      await store.setJSON("settings_banner", banner);
      return new Response(JSON.stringify({ banner }), { headers: corsHeaders() });
    }

    // GET /hero-settings - public
    if (req.method === "GET" && action === "hero-settings") {
      let settings = await store.get("settings_hero", { type: "json" });
      if (!settings) settings = { mode: "carousel", useCustomImages: false, images: [] };
      return new Response(JSON.stringify({ settings }), { headers: corsHeaders() });
    }

    // POST /hero-settings - admin only
    if (req.method === "POST" && action === "hero-settings") {
      const body = await req.json();
      if (body.adminPassword !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
      }
      const { mode, images, useCustomImages } = body;
      const settings = { mode: mode || "carousel", images: images || [], useCustomImages: !!useCustomImages };
      await store.setJSON("settings_hero", settings);
      return new Response(JSON.stringify({ settings }), { headers: corsHeaders() });
    }

    // GET /:id
    if (req.method === "GET" && action) {
      const isAdmin = url.searchParams.get("admin") === ADMIN_PASSWORD;
      let booking = await store.get(`booking_${action}`, { type: "json" });
      if (!booking) booking = await store.get(`block_${action}`, { type: "json" });
      if (!booking) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders() });
      }
      if (!isAdmin) {
        const { paymentData, ...safeBooking } = booking;
        safeBooking.hasPayment = !!paymentData;
        return new Response(JSON.stringify({ booking: safeBooking }), { headers: corsHeaders() });
      }
      return new Response(JSON.stringify({ booking }), { headers: corsHeaders() });
    }

    // PUT /:id - admin edits
    if (req.method === "PUT" && action) {
      const body = await req.json();
      const { adminPassword, ...updates } = body;
      if (adminPassword !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
      }
      let storeKey = `booking_${action}`;
      let existing = await store.get(storeKey, { type: "json" });
      if (!existing) { storeKey = `block_${action}`; existing = await store.get(storeKey, { type: "json" }); }
      if (!existing) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders() });
      }
      // On-hold bookings don't occupy their slot (see getOccupiedRanges), so re-validate
      // for conflicts when the time changes, or when un-holding back to confirmed —
      // someone else may have booked that slot in the meantime.
      const becomingConfirmed = updates.status === "confirmed" && existing.status !== "confirmed";
      if (updates.date || updates.startHour !== undefined || updates.endHour !== undefined || becomingConfirmed) {
        const newDate = updates.date || existing.date;
        const newStart = updates.startHour !== undefined ? updates.startHour : existing.startHour;
        const newEnd = updates.endHour !== undefined ? updates.endHour : existing.endHour;
        const occupied = await getOccupiedRanges(store, newDate, storeKey);
        if (hasConflict(occupied, newStart, newEnd)) {
          return new Response(JSON.stringify({ error: "Time slot conflict. Someone else may have booked this slot while it was on hold." }), { status: 409, headers: corsHeaders() });
        }
      }
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      await store.setJSON(storeKey, updated);
      const { paymentData, ...safeBooking } = updated;
      safeBooking.hasPayment = !!paymentData;
      return new Response(JSON.stringify({ booking: safeBooking }), { headers: corsHeaders() });
    }

    // DELETE /:id - cancel (soft) or permanently delete booking/block
    if (req.method === "DELETE" && action) {
      const body = await req.json();
      if (body.adminPassword !== ADMIN_PASSWORD) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders() });
      }
      let storeKey = `booking_${action}`;
      let existing = await store.get(storeKey, { type: "json" });
      if (!existing) { storeKey = `block_${action}`; existing = await store.get(storeKey, { type: "json" }); }
      if (!existing) {
        return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders() });
      }
      if (body.hardDelete) {
        await store.delete(storeKey);
      } else {
        const cancelled = { ...existing, status: "cancelled", cancelledAt: new Date().toISOString() };
        await store.setJSON(storeKey, cancelled);
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders() });
    }

    return new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: corsHeaders() });

  } catch (err) {
    console.error("Booking API error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), { status: 500, headers: corsHeaders() });
  }
}

export const config = {
  path: ["/api/bookings", "/api/bookings/*"],
};
