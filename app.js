require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');
const basicAuth = require('basic-auth');
const { google } = require('googleapis');

const app = express();
app.use(helmet());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Config
const PROJECT_ID = process.env.PROJECT_ID;
const MANAGED_ZONE = process.env.MANAGED_ZONE;
let DOMAIN = process.env.DOMAIN || '';
if (!DOMAIN.endsWith('.')) DOMAIN += '.';
const KEY_FILE = process.env.KEY_FILE_PATH || './gcloud-dns-key.json';
const ADMIN_USER = process.env.ADMIN_USER;
const ADMIN_PASS = process.env.ADMIN_PASS;
const PORT = process.env.PORT || 3000;

// Auth
function requireBasicAuth(req, res, next) {
  if (!ADMIN_USER || !ADMIN_PASS) return next();
  const user = basicAuth(req);
  if (!user || user.name !== ADMIN_USER || user.pass !== ADMIN_PASS) {
    res.set('WWW-Authenticate', 'Basic realm="DNS Updater"');
    return res.status(401).send('Authentication required.');
  }
  next();
}

// Rate limit
const limiter = rateLimit({ windowMs: 60 * 1000, max: 30 });
app.use(limiter);

// Service Account Key
if (!fs.existsSync(KEY_FILE)) {
  console.error('Key file not found:', KEY_FILE);
  process.exit(1);
}
const keyJson = require(path.resolve(KEY_FILE));
const auth = new google.auth.GoogleAuth({
  credentials: keyJson,
  scopes: ['https://www.googleapis.com/auth/ndev.clouddns.readwrite'],
});
const dns = google.dns('v1');

// Helper: add/update record
async function addOrUpdateARecord(subdomain, ip) {
  const authClient = await auth.getClient();
  google.options({ auth: authClient });

  const name = `${subdomain}.${DOMAIN}`;
  const nameDot = name.endsWith('.') ? name : name + '.';

  const res = await dns.resourceRecordSets.list({
    project: PROJECT_ID,
    managedZone: MANAGED_ZONE,
  });
  const rrsets = res.data.rrsets || [];
  const exist = rrsets.find(r => r.name === nameDot && r.type === 'A');

  const changeBody = {
    additions: [{
      name: nameDot,
      type: 'A',
      ttl: 300,
      rrdatas: [ip],
    }],
  };
  if (exist) changeBody.deletions = [exist];

  return dns.changes.create({
    project: PROJECT_ID,
    managedZone: MANAGED_ZONE,
    requestBody: changeBody,
  });
}

// Routes
app.use(express.static(path.join(__dirname, 'public')));

app.post('/api/dns', requireBasicAuth, async (req, res) => {
  try {
    const { subdomain, ip } = req.body;
    if (!subdomain || !ip) {
      return res.status(400).json({ ok: false, message: 'Missing subdomain or ip' });
    }
    const result = await addOrUpdateARecord(subdomain, ip);
    res.json({ ok: true, data: result.data });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.get('/api/list', requireBasicAuth, async (req, res) => {
  try {
    const authClient = await auth.getClient();
    google.options({ auth: authClient });
    const r = await dns.resourceRecordSets.list({ project: PROJECT_ID, managedZone: MANAGED_ZONE });
    res.json({ ok: true, data: r.data.rrsets });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

app.listen(PORT, () => console.log(`DNS Updater running on port ${PORT}`));
