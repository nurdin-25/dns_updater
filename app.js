const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const dotenv = require("dotenv");
const { DNS } = require("@google-cloud/dns");

dotenv.config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

const PROJECT_ID = process.env.PROJECT_ID;
const ZONE_NAME = process.env.ZONE_NAME;
const DOMAIN = process.env.DOMAIN;
const KEY_FILE_PATH = process.env.KEY_FILE_PATH;
const PORT = process.env.PORT || 3000;

if (!PROJECT_ID || !ZONE_NAME) {
  console.error("❌ PROJECT_ID atau ZONE_NAME belum di set di .env");
  process.exit(1);
}

const dns = new DNS({
  projectId: PROJECT_ID,
  keyFilename: KEY_FILE_PATH,
});

const zone = dns.zone(ZONE_NAME);

// API get records
app.get("/api/records", async (req, res) => {
  try {
    const [records] = await zone.getRecords({ type: "A" });
    res.json(records);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// API add record
app.post("/api/add", async (req, res) => {
  try {
    const { name, ip } = req.body;
    if (!name || !ip) return res.status(400).json({ error: "Name dan IP wajib diisi" });

    const recordName = `${name}.${DOMAIN}`;
    const newRecord = zone.record("A", {
      name: recordName,
      ttl: 300,
      data: ip,
    });

    await zone.addRecords(newRecord);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// jalankan server
app.listen(PORT, () => {
  console.log(`✅ DNS Updater jalan di http://localhost:${PORT}`);
});
