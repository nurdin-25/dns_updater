require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const { DNS } = require("@google-cloud/dns");

const app = express();
const PORT = process.env.PORT || 3344;

// Middleware
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, "public"))); // Serve index.html, main.js dll

// Google Cloud DNS Client
const dns = new DNS({
  projectId: process.env.GCP_PROJECT_ID,
  keyFilename: path.join(__dirname, "gcloud-dns-key.json"),
});

const zone = dns.zone(process.env.DNS_ZONE);

// ---- API ENDPOINTS ---- //

// ✅ Get all records
app.get("/api/records", async (req, res) => {
  try {
    const [records] = await zone.getRecords({ type: "A" });
    res.json(
      records.map(r => ({
        name: r.name,
        ttl: r.ttl,
        rrdatas: r.data,
      }))
    );
  } catch (err) {
    console.error("❌ Records error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ✅ Add / Update record
app.post("/api/add", async (req, res) => {
  const { name, ip } = req.body;
  if (!name || !ip) {
    return res.status(400).json({ error: "Name and IP required" });
  }

  try {
    const fqdn = `${name}.${process.env.DNS_DOMAIN}.`; // ex: test.goldstore.id.
    const record = zone.record("a", {
      name: fqdn,
      data: ip,
      ttl: 300,
    });

    // Cari record lama
    const [records] = await zone.getRecords({ name: fqdn, type: "A" });

    const change = records.length
      ? { add: record, delete: records[0] }
      : { add: record };

    await zone.createChange(change);

    res.json({ success: true, fqdn, ip });
  } catch (err) {
    console.error("❌ Add error:", err);
    res.status(500).json({ error: err.message });
  }
});

// ---- Start Server ---- //
app.listen(PORT, () => {
  console.log(`🚀 Server jalan di http://localhost:${PORT}`);
});
