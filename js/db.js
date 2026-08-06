// ============================================================================
// db.js — marketplace data layer. Async, localStorage-backed for now.
// This exact same file (byte-for-byte) also lives in the admin folder so the
// two apps never import each other's code — they only share the same
// browser storage key on the same origin.
// ============================================================================

const NS = "marketplace:v1";
const LATENCY = 150;
const delay = (v) => new Promise((res) => setTimeout(() => res(v), LATENCY));

function read() {
  const raw = localStorage.getItem(NS);
  if (raw) return JSON.parse(raw);
  const seeded = seed();
  localStorage.setItem(NS, JSON.stringify(seeded));
  return seeded;
}
function write(data) {
  localStorage.setItem(NS, JSON.stringify(data));
}
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
function nowISO() {
  return new Date().toISOString();
}

function seed() {
  const mk = (name, price, sellerName, contact, orderMethod, description, ageMinutes) => ({
    id: uid("item"),
    name, price, sellerName, contact, orderMethod, description,
    status: "approved",
    createdAt: new Date(Date.now() - ageMinutes * 60000).toISOString(),
    resolvedAt: new Date(Date.now() - (ageMinutes - 5) * 60000).toISOString(),
  });

  return {
    settings: {
      siteName: "Marketplace",
      currencySymbol: "₹",
      minPrice: 1,
      requireContact: true,
      updatedAt: nowISO(),
    },
    blockedContacts: [],
    auditLog: [],
    listings: [
      mk("Old bicycle in good condition", 150, "Ravi Kumar", "9876543210", "Meet nearby / cash on pickup", "Used but well maintained. Both tyres are new.", 60 * 24 * 2),
      mk("Wooden study chair", 50, "Anita Verma", "9123456780", "Pickup only", "Sturdy wooden chair, minor scratches on the leg.", 60 * 24 * 5),
      mk("Used novel collection (5 books)", 10, "Sana Iyer", "9988776655", "Courier available", "Assorted fiction novels, good condition.", 60 * 8),
      mk("Small buddha statue", 20, "Owen Park", "9012345678", "Meet nearby", "Decorative brass statue, about 6 inches tall.", 60 * 30),
    ],
  };
}

// ---------------------------------------------------------------------------
// Listings
// ---------------------------------------------------------------------------
export const listings = {
  async approvedList(query = "") {
    const d = read();
    const q = query.trim().toLowerCase();
    const items = d.listings.filter((l) => l.status === "approved");
    const filtered = q ? items.filter((l) => l.name.toLowerCase().includes(q)) : items;
    return delay(filtered.sort((a, b) => new Date(b.resolvedAt || b.createdAt) - new Date(a.resolvedAt || a.createdAt)));
  },
  async get(id) {
    const d = read();
    return delay(d.listings.find((l) => l.id === id) || null);
  },
  async submit({ name, price, sellerName, contact, orderMethod, description }) {
    const d = read();

    if (d.blockedContacts.includes((contact || "").trim().toLowerCase())) {
      return delay({ ok: false, error: "This contact method is not able to list items right now." });
    }
    if (!name || !name.trim()) return delay({ ok: false, error: "Item name is required." });
    if (!price || Number(price) < (d.settings.minPrice || 1)) return delay({ ok: false, error: `Price must be at least ${d.settings.currencySymbol}${d.settings.minPrice}.` });
    if (d.settings.requireContact && (!contact || !contact.trim())) return delay({ ok: false, error: "A contact method is required." });

    const item = {
      id: uid("item"),
      name: name.trim(),
      price: Number(price),
      sellerName: (sellerName || "").trim() || "Anonymous Seller",
      contact: (contact || "").trim(),
      orderMethod: (orderMethod || "").trim() || "Contact seller directly",
      description: (description || "").trim(),
      status: "pending",
      createdAt: nowISO(),
      resolvedAt: null,
    };
    d.listings.unshift(item);
    write(d);
    return delay({ ok: true, item });
  },
};

export const settings = {
  async get() {
    const d = read();
    return delay({ ...d.settings });
  },
};
