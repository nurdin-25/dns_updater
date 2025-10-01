async function addRecord() {
  const name = document.getElementById("dnsName").value.trim();
  const ip = document.getElementById("dnsIp").value.trim();

  if (!name || !ip) {
    alert("Isi Subdomain dan IP Address!");
    return;
  }

  try {
    const res = await fetch("/api/add", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, ip }),
    });
    const data = await res.json();
    if (res.ok) {
      alert("✅ Success: " + JSON.stringify(data));
      refreshRecords();
    } else {
      alert("❌ Error: " + JSON.stringify(data));
    }
  } catch (err) {
    console.error("Add Record Error:", err);
    alert("Request failed");
  }
}

async function refreshRecords() {
  try {
    const res = await fetch("/api/records");
    const data = await res.json();

    const table = document.createElement("table");
    table.innerHTML = `
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>TTL</th>
        <th>RRDatas</th>
      </tr>
    `;

    data.forEach(record => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${record.name}</td>
        <td>${record.type}</td>
        <td>${record.ttl}</td>
        <td>${record.rrdatas.join(", ")}</td>
      `;
      table.appendChild(row);
    });

    document.getElementById("records").innerHTML = "";
    document.getElementById("records").appendChild(table);

  } catch (err) {
    console.error("Refresh Records Error:", err);
    alert("Failed to load records");
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const btnAdd = document.getElementById("btnAdd");
  const btnRefresh = document.getElementById("btnRefresh");

  if (btnAdd) btnAdd.addEventListener("click", addRecord);
  if (btnRefresh) btnRefresh.addEventListener("click", refreshRecords);
});

// Auto load records on page load
refreshRecords();
