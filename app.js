const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const basicAuth = require("express-basic-auth");
const { DNS } = require("@google-cloud/dns");
const helmet = require("helmet");
const path = require("path");

dotenv.config();
const app = express();
app.use(helmet());
app.use(bodyParser.json());
app.use(express.static(path.join(process.cwd(), "public"))); // serve index.html

// Ambil env
const {
  PROJECT_ID,
  MANAGED_ZONE,
  KEY_FILE_PATH,
  ADMIN_USER,
  ADMIN_PASS,
  PORT,
  DOMAIN,
} = process.env;

if (!PROJECT_ID || !MANAGED_ZONE || !KEY_FILE_PATH || !DOMAIN) {
  console.error(
    "❌ PROJECT_ID, MANAGED_ZONE, KEY_FILE_PATH, atau DOMAIN belum di set di .env"
  );
  process.exit(1);
}

// Auth Basic
app.use(
  basicAuth({
    users: { [ADMIN_USER]: ADMIN_PASS },
    challenge: true,
  })
);

// Init Google DNS client
const dns = new DNS({ projectId: PROJECT_ID, keyFilename: KEY_FILE_PATH });
const zone = dns.zone(MANAGED_ZONE);

// Helper: generate FQDN dari subdomain
function toFqdnFromSub(sub) {
  const cleanDomain = DOMAIN.replace(/\.$/, "");
  return `${sub}.${cleanDomain}.`;
}

// ==================== API ====================

// GET semua records
app.get("/api/records", async (req, res) => {
  try {
    const [records] = await zone.getRecords();
    const result = records.map((r) => ({
      name: r.name,
      type: r.type,
      ttl: r.ttl,
      rrdatas: r.rrdatas || r.data || [],
    }));
    res.json(result);
  } catch (err) {
    console.error("❌ Records error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Tambah A record (no duplicate allowed)
app.post("/api/add", async (req, res) => {
  try {
    const { name, ip } = req.body;
    if (!name || !ip) {
      return res.status(400).json({ error: "Name dan IP wajib diisi" });
    }

    if (!/^[a-zA-Z0-9-]+$/.test(name)) {
      return res.status(400).json({ error: "Name hanya huruf/angka/dash (-)" });
    }

    const fqdn = toFqdnFromSub(name); // misal: admine.goldstore.id.
    const [existing] = await zone.getRecords({ name: fqdn, type: "A" });

    // Buat record baru
    const newRecord = zone.record("a", {
      name: fqdn,
      ttl: 300,
      rrdatas: [ip],
    });

    // Jika record sudah ada, tolak saja
    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `❌ Record ${fqdn} sudah ada. Gunakan nama subdomain lain.`,
      });
    }

    // Log detail untuk debug
    console.log("[ADD] fqdn:", fqdn);
    console.log("[ADD] newRecord:", newRecord);
    // Buat perubahan: tambah baru
    const changes = zone.change({
      add: [newRecord],
    });
    await changes.create();

    res.json({ success: true, message: `Record ${fqdn} berhasil ditambahkan.` });
  } catch (err) {
    console.error("❌ Add error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE record
app.delete("/api/delete", async (req, res) => {
  try {
    const { fqdn } = req.body;
    if (!fqdn) return res.status(400).json({ error: "fqdn wajib diisi" });

    const [records] = await zone.getRecords({ name: fqdn, type: "A" });
    if (!records || records.length === 0) {
      return res.status(404).json({ error: "Record tidak ditemukan" });
    }

    await zone.createChange({ deletions: records });
    res.json({ success: true, message: "Record berhasil dihapus" });
  } catch (err) {
    console.error("❌ Delete error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Jalankan server
app.listen(PORT || 3344, () => {
  console.log(`🚀 DNS Updater running on port ${PORT || 3344}`);
});
