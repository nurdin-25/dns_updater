const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const dotenv = require("dotenv");
const { DNS } = require("@google-cloud/dns");

// Load .env
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3344;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public")));

// Google Cloud DNS client
const dns = new DNS({
  projectId: process.env.GCLOUD_PROJECT_ID,
  keyFilename: path.join(__dirname, "gcloud-dns-key.json"),
});

const zoneName = process.env.DNS_ZONE;
const dnsDomain = process.env.DNS_DOMAIN;

// ✅ API GET records
app.get("/api/records", async (req, res) => {
  try {
    const zone = dns.zone(zoneName);
    const [records] = await zone.getRecords({ type: "A" });
    res.json(records.map(r => r.metadata));
  } catch (err) {
    console.error("❌ Records error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ API ADD / UPDATE record
app.post("/api/add", async (req, res) => {
  const { name, ip } = req.body;
  if (!name || !ip) {
    return res.status(400).json({ error: "Missing name/ip" });
  }

  try {
    const zone = dns.zone(zoneName);
    const fqdn = `${name}.${dnsDomain}.`;

    const record = zone.record("a", {
      name: fqdn,
      ttl: 300,
      data: ip,
    });

    // hapus record lama kalau ada
    const [existing] = await zone.getRecords({ name: fqdn, type: "A" });
    const change = existing.length
      ? { add: record, delete: existing }
      : { add: record };

    await zone.createChange(change);

    res.json({ success: true, fqdn, ip });
  } catch (err) {
    console.error("❌ Add error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Run server
app.listen(PORT, () => {
  console.log(`🚀 DNS Updater running at http://localhost:${PORT}`);
});
