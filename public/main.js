async function addRecord() {
  const name = document.getElementById("name").value.trim();
  const ip = document.getElementById("ip").value.trim();
  const msg = document.getElementById("message");
  msg.style.color = '#d9534f';
  msg.textContent = '';
  if (!name || !ip) {
    msg.textContent = 'Subdomain dan IP wajib diisi!';
    return;
  }
  try {
    const res = await fetch("/api/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ip })
    });
    const data = await res.json();
    if (data.success) {
      msg.style.color = '#28a745';
      msg.textContent = 'Berhasil update record!';
    } else {
      msg.textContent = data.error || 'Gagal update record!';
    }
    await refreshRecords();
  } catch (err) {
    msg.textContent = 'Error: ' + err.message;
  }
}

async function refreshRecords() {
  const msg = document.getElementById("message");
  try {
    const res = await fetch("/api/records");
    const records = await res.json();
    const tbody = document.querySelector("#recordsTable tbody");
    tbody.innerHTML = "";
    if (!Array.isArray(records) || !records || records.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="3" style="text-align:center;">Belum ada record</td>';
      tbody.appendChild(row);
      return;
    }
    records.forEach(r => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${r.name}</td>
        <td>${r.ttl}</td>
        <td>${(r.rrdatas||[]).join(", ")}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    msg.textContent = 'Gagal memuat records: ' + err.message;
  }
}

document.getElementById("addBtn").addEventListener("click", addRecord);
document.getElementById("refreshBtn").addEventListener("click", refreshRecords);

window.onload = refreshRecords;

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