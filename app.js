const express = require("express");
const bodyParser = require("body-parser");
const { DNS } = require("@google-cloud/dns");
const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3344;

// pastikan env tersedia
if (!process.env.PROJECT_ID || !process.env.ZONE_NAME) {
  console.error("❌ PROJECT_ID atau ZONE_NAME belum di set di .env");
  process.exit(1);
}

// init DNS
const dns = new DNS({ projectId: process.env.PROJECT_ID });
const zone = dns.zone(process.env.ZONE_NAME);

app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// API GET records
app.get("/api/records", async (req, res) => {
  try {
    const [records] = await zone.getRecords();
    res.json(records);
  } catch (err) {
    console.error("Records error:", err);
    res.status(500).json({ error: err.message });
  }
});

// API ADD record
app.post("/api/add", async (req, res) => {
  try {
    const { name, ip } = req.body;
    if (!name || !ip) {
      return res.status(400).json({ error: "Name dan IP wajib diisi" });
    }

    const record = zone.record("a", {
      name: `${name}.${process.env.ZONE_NAME}.`,
      ttl: 300,
      data: ip,
    });

    await zone.addRecords(record);
    res.json({ success: true });
  } catch (err) {
    console.error("Add error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`);
});
