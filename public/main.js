// public/main.js
function showMessage(msg, color = "#d9534f") {
  const el = document.getElementById("message");
  el.textContent = msg;
  el.style.color = color;
}

// Tambah / Update
async function addRecord() {
  const name = document.getElementById("dnsName").value.trim();
  const ip = document.getElementById("dnsIp").value.trim();

  if (!name || !ip) {
    showMessage("Isi Subdomain dan IP Address!");
    return;
  }

  try {
    const res = await fetch("/api/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ip }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showMessage("✅ " + (data.message || "Berhasil update record!"), "#28a745");
      await refreshRecords();
    } else {
      showMessage(data.error || "❌ Error update record!");
    }
  } catch (err) {
    showMessage("Request gagal: " + err.message);
  }
}

// Hapus
async function deleteRecordByFqdn(fqdn) {
  if (!confirm(`Hapus record A untuk:\n${fqdn} ?`)) return;
  try {
    const res = await fetch("/api/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fqdn }),
    });
    const data = await res.json();
    if (res.ok && data.success) {
      showMessage("🗑️ " + (data.message || "Record dihapus"), "#28a745");
      await refreshRecords();
    } else {
      showMessage(data.error || "❌ Gagal hapus record.");
    }
  } catch (err) {
    showMessage("Request gagal: " + err.message);
  }
}

// Load records (dengan filter)
async function refreshRecords(filter = "") {
  try {
    const res = await fetch("/api/records");
    const data = await res.json();
    const tbody = document.querySelector("#recordsTable tbody");
    tbody.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="5">Belum ada record</td>';
      tbody.appendChild(row);
      return;
    }

    const f = filter.toLowerCase();
    const list = f ? data.filter(r => (r.name || "").toLowerCase().includes(f)) : data;

    list.forEach(r => {
      const row = document.createElement("tr");
      const joined = (r.rrdatas || []).join(", ");

      // tombol delete hanya untuk type A
      const aksiHtml = r.type === "A"
        ? `<button class="btn-del" data-delete="${r.name}">Delete</button>`
        : "-";

      row.innerHTML = `
        <td>${r.name}</td>
        <td>${r.type}</td>
        <td>${r.ttl}</td>
        <td>${joined}</td>
        <td>${aksiHtml}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    showMessage("Gagal memuat records: " + err.message);
  }
}

// Delegasi klik tombol Delete
document.querySelector("#recordsTable tbody").addEventListener("click", (e) => {
  const btn = e.target.closest("[data-delete]");
  if (!btn) return;
  const fqdn = btn.getAttribute("data-delete"); // sudah termasuk titik di belakang
  deleteRecordByFqdn(fqdn);
});

// Event awal
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnAdd").addEventListener("click", addRecord);
  document.getElementById("btnRefresh").addEventListener("click", () => refreshRecords());
  document.getElementById("searchInput").addEventListener("input", (e) => {
    refreshRecords(e.target.value.trim());
  });

  refreshRecords();
});
