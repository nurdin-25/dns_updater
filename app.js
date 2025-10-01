require("dotenv").config();
const path = require("path");
const express = require("express");
const { DNS } = require("@google-cloud/dns");

const app = express();
app.use(express.json());
app.use(express.static("public")); // UI dari folder public

// Load ENV
const PROJECT_ID = process.env.PROJECT_ID;
const MANAGED_ZONE = process.env.MANAGED_ZONE;
const DOMAIN = process.env.DOMAIN.endsWith(".") ? process.env.DOMAIN : process.env.DOMAIN + ".";
const KEY_FILE_PATH = process.env.KEY_FILE_PATH;

if (!PROJECT_ID || !MANAGED_ZONE || !DOMAIN || !KEY_FILE_PATH) {
  console.error("❌ Missing environment variables in .env");
  process.exit(1);
}

// Init Google Cloud DNS client
const dns = new DNS({
  projectId: PROJECT_ID,
  keyFilename: path.resolve(KEY_FILE_PATH),
});

// ========== ROUTES ==========

// API: ambil semua records
app.get("/api/records", async (req, res) => {
  try {
    const zone = dns.zone(MANAGED_ZONE);
    const [records] = await zone.getRecords();
    res.json(records.map(r => r.metadata));
  } catch (err) {
    console.error("❌ Records error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// API: tambah / update record A
app.post("/api/add", async (req, res) => {
  try {
    const { name, ip } = req.body;
    if (!name || !ip) {
      return res.status(400).json({ error: "Missing name or ip" });
    }

    const zone = dns.zone(MANAGED_ZONE);
    // pastikan ada titik di akhir
    const recordName = name.endsWith(".")
      ? `${name}${DOMAIN}`
      : `${name}.${DOMAIN}`;

    // ambil record A dengan nama tsb
    const [records] = await zone.getRecords({ name: recordName, type: "A" });
    const deletions = records.length ? records : [];

    // kalau record sudah sama
    if (records.length && records[0].metadata.rrdatas.includes(ip)) {
      return res.json({
        success: true,
        message: "No change needed (record already exists)",
        record: records[0].metadata,
      });
    }

    // bikin record baru
    const newRecord = zone.record("a", {
      name: recordName,
      data: [ip],
      ttl: 300,
    });

    const change = { additions: [newRecord], deletions };

    await zone.createChange(change);
    res.json({ success: true, record: newRecord.metadata });
  } catch (err) {
    console.error("❌ Add error:", err);
    res.status(500).json({ error: err.message });
  }
});

// Root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// Start server
const PORT = process.env.PORT || 3344;
app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`);
});
