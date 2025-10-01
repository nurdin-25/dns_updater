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

// Cek env
const { PROJECT_ID, MANAGED_ZONE, KEY_FILE_PATH, ADMIN_USER, ADMIN_PASS, PORT, DOMAIN } = process.env;
if (!PROJECT_ID || !MANAGED_ZONE || !KEY_FILE_PATH || !DOMAIN) {
  console.error("❌ PROJECT_ID, MANAGED_ZONE, KEY_FILE_PATH, atau DOMAIN belum di set di .env");
  process.exit(1);
}

// Auth
app.use(
  basicAuth({
    users: { [ADMIN_USER]: ADMIN_PASS },
    challenge: true,
  })
);

// Init Google DNS client
const dns = new DNS({ projectId: PROJECT_ID, keyFilename: KEY_FILE_PATH });
const zone = dns.zone(MANAGED_ZONE);

// ==================== API ====================

// GET semua records
app.get("/api/records", async (req, res) => {
  try {
    const [records] = await zone.getRecords();
    const result = records.map(r => ({
      name: r.name,
      type: r.type,
      ttl: r.ttl,
      data: r.data,
    }));
    res.json(result);
  } catch (err) {
    console.error("❌ Records error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ADD / UPDATE A record
// ADD / UPDATE A record
app.post("/api/add", async (req, res) => {
  try {
    const { name, ip } = req.body;
    if (!name || !ip) return res.status(400).json({ error: "Name dan IP wajib diisi" });

    if (!/^[a-zA-Z0-9-]+$/.test(name)) {
      return res.status(400).json({ error: "Name hanya huruf/angka/dash (-)" });
    }

    const fqdn = toFqdnFromSub(name); // ex: admine.goldstore.id.

    // cari record A existing
    const [existing] = await zone.getRecords({ name: fqdn, type: "A" });

    // ADDITIONS
    const additions = [
      {
        name: fqdn,
        type: "A",
        ttl: 300,
        rrdatas: [ip],
      },
    ];

    // DELETIONS (hanya jika ada)
    const deletions =
      existing && existing.length > 0
        ? existing.map(r => ({
            name: r.name,
            type: r.type,
            ttl: r.ttl,
            rrdatas: normalizeRrdatas(r),
          }))
        : [];

    console.log("=== DEBUG ADD ===");
    console.log("fqdn:", fqdn);
    console.log("additions:", additions);
    console.log("deletions:", deletions);

    // Kalau ip sama → skip
    if (
      deletions.length > 0 &&
      deletions.some(d => d.rrdatas.includes(ip))
    ) {
      return res.json({ success: true, message: "Record sudah sama, tidak ada perubahan" });
    }

    await zone.createChange({
      additions,
      deletions,
    });

    res.json({ success: true, message: "Record berhasil ditambahkan/diupdate" });
  } catch (err) {
    console.error("❌ Add error:", err);
    res.status(500).json({ error: err.message });
  }
});

// DELETE record
app.delete("/api/delete", async (req, res) => {
  const { name } = req.body;
  console.log("[DELETE REQUEST] name:", name);

  if (!name) {
    return res.status(400).json({ error: "Name wajib diisi" });
  }

  try {
    const cleanDomain = DOMAIN.replace(/\.$/, "");
    const cleanName = name.replace(/\.$/, "");
    const fqdn = `${cleanName}.${cleanDomain}.`;

    const [records] = await zone.getRecords({ name: fqdn, type: "A" });
    if (!records || records.length === 0) {
      return res.status(404).json({ error: "Record tidak ditemukan" });
    }

    const changes = zone.change({ delete: records });
    await changes.create();

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
