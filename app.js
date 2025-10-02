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
  const cleanDomain = DOMAIN.replace(/\.$/, ""); // hapus titik terakhir kalau ada
  return `${sub}.${cleanDomain}.`; // tambahkan titik di belakang
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

    const fqdn = toFqdnFromSub(name); // contoh: admine.goldstore.id.

    // cek apakah sudah ada
    const [existing] = await zone.getRecords({ name: fqdn, type: "A" });
    if (existing && existing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `❌ Record ${fqdn} sudah ada. Gunakan subdomain lain.`,
      });
    }

    // bikin additions baru
    const additions = [
      {
        name: fqdn,
        type: "A",
        ttl: 300,
        rrdatas: [String(ip)], // pastikan string
      },
    ];

    console.log("👉 Akan createChange:", JSON.stringify(additions, null, 2));

    // safety check sebelum request
    if (!additions || additions.length === 0) {
      return res.status(400).json({ error: "Tidak ada additions yang valid" });
    }

    // kirim perubahan
    await zone.createChange({ additions });

    res.json({
      success: true,
      message: `✅ Record ${fqdn} berhasil ditambahkan dengan IP ${ip}`,
    });
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

    console.log("🗑️ Record berhasil dihapus:", fqdn);
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
