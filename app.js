const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const basicAuth = require("express-basic-auth");
const { DNS } = require("@google-cloud/dns");
require("dotenv").config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const {
  PROJECT_ID,
  MANAGED_ZONE,
  DOMAIN,
  KEY_FILE_PATH,
  PORT,
  ADMIN_USER,
  ADMIN_PASS,
} = process.env;

if (!PROJECT_ID || !MANAGED_ZONE || !DOMAIN || !KEY_FILE_PATH) {
  console.error("❌ Pastikan semua variabel .env sudah terisi");
  process.exit(1);
}

// Setup Google Cloud DNS client
const dns = new DNS({
  projectId: PROJECT_ID,
  keyFilename: KEY_FILE_PATH,
});

// Setup Basic Auth
app.use(
  ["/api", "/"],
  basicAuth({
    users: { [ADMIN_USER]: ADMIN_PASS },
    challenge: true,
  })
);

// Serve UI
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// API: ambil semua record A
app.get("/api/records", async (req, res) => {
  try {
  const zone = dns.zone(MANAGED_ZONE);
  // Ambil semua record A di zone
  const [records] = await zone.getRecords({ type: "A" });
  res.json(records.map((r) => r.metadata));
  } catch (err) {
    console.error("❌ Records error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: tambah/update record A
app.post("/api/add", async (req, res) => {
  try {
    const { name, ip } = req.body;
    if (!name || !ip) {
      return res.status(400).json({ error: "Missing name or ip" });
    }

    const zone = dns.zone(MANAGED_ZONE);

    // Pastikan DOMAIN selalu ada titik di akhir
    const domainName = DOMAIN.endsWith(".") ? DOMAIN : DOMAIN + ".";
    // Pastikan subdomain dan domain dipisah titik
    const recordName = name ? `${name}.${domainName}` : domainName;

    // Cari record lama
    const [records] = await zone.getRecords({ name: recordName, type: "A" });

    // Jika record sudah ada dan isinya persis sama, tidak perlu update
    if (
      records.length === 1 &&
      records[0].metadata.rrdatas.length === 1 &&
      records[0].metadata.rrdatas[0] === ip
    ) {
      return res.json({
        success: true,
        message: "No change needed (record already exists)",
        record: records[0].metadata,
      });
    }

    // Buat record baru
    const newRecord = zone.record("a", {
      name: recordName,
      ttl: 300,
      data: [ip],
    });

    // Siapkan perubahan
    let change = {};
    if (records.length === 0) {
      // Record belum ada, hanya tambahkan
      change = { additions: [newRecord] };
    } else {
      // Record sudah ada, hapus dulu lalu tambahkan
      change = { additions: [newRecord], deletions: records };
    }

    await zone.createChange(change);
    return res.json({ success: true, record: newRecord.metadata });

  } catch (err) {
    console.error("❌ Add error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`);
});
