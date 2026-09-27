// Editable website text. Shared by the booking page (which shows it) and the
// admin "Site Text" page (which edits it). Defaults here must match the HTML.
// In any text, {phone} and {price} are replaced with the current values.
window.SITE_CONTENT = {
  groups: [
    { title: "General", fields: [
      { key: "siteTitle", label: "Browser tab title", def: "Dink & Dirt Pickleball – Book a Court" },
      { key: "phone", label: "Contact phone number", def: "", hint: "Shown in the top bar, footer and confirmation screen. Leave blank to hide." },
      { key: "pricePerHour", label: "Court price per hour (₱)", def: "250", type: "number", hint: "Used for slot prices and totals. Existing bookings keep the price they were booked at." },
    ]},
    { title: "Home Screen", fields: [
      { key: "heroTitle", label: "Big title", def: "DINK & DIRT" },
      { key: "heroSub1", label: "Subtitle", def: "Pickleball & RC Crawler Park" },
      { key: "heroSub2", label: "Tagline", def: "Play · Crawl · Repeat" },
      { key: "heroCta", label: "Book button text", def: "TAP TO BOOK" },
      { key: "heroCtaSub", label: "Text under book button", def: "Select a date and reserve your slot" },
      { key: "heroLocation", label: "Bottom line (e.g. location)", def: "Dink & Dirt  ·  Pickleball & RC Crawler Park" },
    ]},
    { title: "Top Bar", fields: [
      { key: "topbarName", label: "Name", def: "DINK & DIRT" },
      { key: "topbarSub", label: "Small text under name", def: "Pickleball & RC Crawler Park" },
      { key: "topbarTagline", label: "Center tagline", def: "Play · Crawl · Repeat" },
    ]},
    { title: "Booking Rules Popup", fields: [
      { key: "rulesTitle", label: "Title", def: "BEFORE YOU BOOK" },
      { key: "rulesSubtitle", label: "Subtitle", def: "Booking & Court Rules" },
      { key: "rulesIntro", label: "Intro", def: "Please take a moment to read these rules. They help every booking start safely and on time.", long: true },
      { key: "rule1Title", label: "Rule 1 title", def: "⏰ Arrive on time" },
      { key: "rule1Body", label: "Rule 1 text", def: "Please arrive 10 minutes early to warm up. Your slot begins and ends at the exact times you booked.", long: true },
      { key: "rule2Title", label: "Rule 2 title", def: "🚫 No cancellations after booking" },
      { key: "rule2Body", label: "Rule 2 text", def: "Cancellations must be made at least 6 hours before your scheduled time. No-shows and late cancellations are non-refundable.", long: true },
      { key: "rule3Title", label: "Rule 3 title", def: "🔄 Rebooking policy" },
      { key: "rule3Body", label: "Rule 3 text", def: "Rebooking requests must be made at least 6 hours in advance and are subject to court availability. Contact us at {phone} to rebook.", long: true },
      { key: "rule4Title", label: "Rule 4 title", def: "🌧️ Weather cancellations" },
      { key: "rule4Body", label: "Rule 4 text", def: "This is an outdoor court. In case of rain or a natural calamity, we will contact you to reschedule at no extra charge.", long: true },
      { key: "rule5Title", label: "Rule 5 title", def: "💰 Payment required to confirm" },
      { key: "rule5Body", label: "Rule 5 text", def: "Upload your GCash or cash payment screenshot to secure your slot. Your booking is only confirmed upon receipt of payment.", long: true },
      { key: "rule6Title", label: "Rule 6 title", def: "🤝 Respect the court & players" },
      { key: "rule6Body", label: "Rule 6 text", def: "Be kind to all players. Vacate the court promptly when your time is up so the next booking can start on time.", long: true },
    ]},
    { title: "Booking Page", fields: [
      { key: "bookingHeading", label: "Heading", def: "SELECT YOUR DATE & TIME" },
      { key: "bookingSubheading", label: "Text under heading", def: "Choose a date on the calendar, then pick your available time slots below.", long: true },
      { key: "noticeTitle", label: "Notice title", def: "⛅ Outdoor Court Notice" },
      { key: "noticeBody", label: "Notice text", def: "This is an outdoor pickleball court. Please check the weather before heading out. Games may be affected by rain or extreme heat.", long: true },
    ]},
    { title: "Payment", fields: [
      { key: "payTitle", label: "Payment title", def: "💰 Pay via GCash · ₱{price}/Hour" },
      { key: "gcashNumber", label: "GCash number", def: "", hint: "Leave blank to hide." },
      { key: "gcashName", label: "GCash account name", def: "", hint: "Leave blank to hide." },
      { key: "payHint", label: "Instructions after paying", def: "After paying, upload your receipt screenshot below to secure your slot.", long: true },
    ]},
    { title: "Confirmation Screen", fields: [
      { key: "successTitle", label: "Title", def: "BOOKING CONFIRMED!" },
      { key: "successMessage", label: "Message", def: "See you on the court! Your spot is secured." },
    ]},
    { title: "Footer", fields: [
      { key: "footerHours", label: "Opening hours", def: "Court Opens 1PM–12MN" },
      { key: "footerCopyright", label: "Copyright line", def: "© 2026 Dink & Dirt Pickleball & RC Crawler Park" },
    ]},
  ],
  social: [
    { key: "facebook", label: "Facebook" },
    { key: "instagram", label: "Instagram" },
    { key: "tiktok", label: "TikTok" },
    { key: "messenger", label: "Messenger" },
    { key: "youtube", label: "YouTube" },
    { key: "website", label: "Website" },
    { key: "maps", label: "Google Maps" },
  ],
};

window.SITE_CONTENT.defaults = Object.fromEntries(
  window.SITE_CONTENT.groups.flatMap(g => g.fields.map(f => [f.key, f.def]))
);

// Fill {phone}/{price}. Without a phone number, " at {phone}" disappears.
window.SITE_CONTENT.render = function (value, vals) {
  let s = String(value == null ? "" : value);
  if (!vals.phone) s = s.replace(/ at \{phone\}/g, "");
  return s.replace(/\{phone\}/g, vals.phone || "").replace(/\{price\}/g, vals.pricePerHour || "");
};

window.SITE_CONTENT.isSafeUrl = u => typeof u === "string" && /^https?:\/\/[^\s"'<>]+$/i.test(u.trim());
