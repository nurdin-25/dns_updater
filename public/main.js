// fungsi helper untuk menampilkan pesan
function showMessage(msg, color = '#d9534f') {
  const el = document.getElementById('message');
  if (el) {
    el.textContent = msg;
    el.style.color = color;
  }
}

// tambah / update record
async function addRecord() {
  const name = document.getElementById("dnsName").value.trim();
  const ip = document.getElementById("dnsIp").value.trim();

  if (!name || !ip) {
    showMessage('Isi Subdomain dan IP Address!');
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
      showMessage('✅ Berhasil update record!', '#28a745');
      await refreshRecords();
    } else {
      showMessage(data.error || '❌ Error update record!');
    }
  } catch (err) {
    console.error("Add Record Error:", err);
    showMessage('Request failed: ' + err.message);
  }
}

// ambil records
async function refreshRecords() {
  try {
    const res = await fetch("/api/records");
    const data = await res.json();
    const tbody = document.querySelector("#recordsTable tbody");
    tbody.innerHTML = "";

    if (!Array.isArray(data) || data.length === 0) {
      const row = document.createElement("tr");
      row.innerHTML = '<td colspan="3" style="text-align:center;">Belum ada record</td>';
      tbody.appendChild(row);
      return;
    }

    data.forEach(record => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${record.name}</td>
        <td>${record.ttl}</td>
        <td>${(record.rrdatas || []).join(", ")}</td>
      `;
      tbody.appendChild(row);
    });
  } catch (err) {
    console.error("Refresh Records Error:", err);
    showMessage('Gagal memuat records: ' + err.message);
  }
}

// jalankan setelah halaman siap
document.addEventListener("DOMContentLoaded", () => {
  const btnAdd = document.getElementById("btnAdd");
  const btnRefresh = document.getElementById("btnRefresh");

  if (btnAdd) btnAdd.addEventListener("click", addRecord);
  if (btnRefresh) btnRefresh.addEventListener("click", refreshRecords);

  // auto load pertama kali
  refreshRecords();
});
