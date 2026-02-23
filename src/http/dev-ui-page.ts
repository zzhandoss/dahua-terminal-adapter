export function buildDevUiHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Dahua Adapter Dev UI</title>
  <style>
    body { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; margin: 24px; background: #0f1115; color: #e7e9ee; }
    h1,h2 { margin: 0 0 12px; }
    .card { border: 1px solid #2b2f3a; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #161a22; }
    label { display:block; margin: 10px 0 4px; }
    input, select, button, textarea { width: 100%; box-sizing: border-box; padding: 8px; border-radius: 6px; border: 1px solid #394055; background: #11151d; color: #e7e9ee; }
    button { cursor: pointer; background: #2a7fff; border-color: #2a7fff; font-weight: 600; }
    pre { background: #0b0e14; padding: 12px; border-radius: 8px; overflow: auto; border: 1px solid #2b2f3a; }
    .row { display:grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  </style>
</head>
<body>
  <h1>Dahua Adapter Dev UI</h1>
  <div class="card">
    <h2>Snapshot</h2>
    <button id="refresh">Refresh Snapshot</button>
    <pre id="snapshot"></pre>
  </div>
  <div class="card">
    <h2>Dahua Client Tools (Real Device)</h2>
    <div class="row">
      <div><label>deviceId</label><input id="clientDeviceId" value="dev-1" /></div>
      <div><label>lookbackMinutes</label><input id="lookbackMinutes" type="number" value="60" /></div>
    </div>
    <div class="row">
      <div><button id="loginBtn">Login / HealthCheck</button></div>
      <div><button id="recordsBtn">Get Access Records</button></div>
    </div>
    <pre id="clientResult"></pre>
  </div>
  <div class="card">
    <h2>Emit AccessControl Event</h2>
    <div class="row">
      <div><label>deviceId</label><input id="deviceId" value="dev-1" /></div>
      <div><label>recNo (optional)</label><input id="recNo" type="number" /></div>
    </div>
    <div class="row">
      <div><label>userId (optional)</label><input id="userId" /></div>
      <div><label>cardNo (optional)</label><input id="cardNo" /></div>
    </div>
    <div class="row">
      <div><label>type</label><select id="type"><option>Entry</option><option>Exit</option></select></div>
      <div><label>method</label><input id="method" type="number" value="1" /></div>
    </div>
    <label>status</label><input id="status" type="number" value="1" />
    <button id="emit">Emit</button>
    <pre id="emitResult"></pre>
  </div>
  <script>
    const snapshotEl = document.getElementById("snapshot");
    const emitResultEl = document.getElementById("emitResult");
    const clientResultEl = document.getElementById("clientResult");
    async function refreshSnapshot() {
      const res = await fetch("/monitor/snapshot");
      snapshotEl.textContent = JSON.stringify(await res.json(), null, 2);
    }
    async function emitEvent() {
      const payload = {
        deviceId: document.getElementById("deviceId").value.trim(),
        recNo: document.getElementById("recNo").value ? Number(document.getElementById("recNo").value) : undefined,
        userId: document.getElementById("userId").value.trim() || undefined,
        cardNo: document.getElementById("cardNo").value.trim() || undefined,
        type: document.getElementById("type").value,
        method: Number(document.getElementById("method").value || 1),
        status: Number(document.getElementById("status").value || 1)
      };
      const res = await fetch("/dev/ui/emit-access-event", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      emitResultEl.textContent = JSON.stringify(await res.json(), null, 2);
      await refreshSnapshot();
    }
    async function loginDevice() {
      const payload = { deviceId: document.getElementById("clientDeviceId").value.trim() };
      const res = await fetch("/dev/ui/client/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      clientResultEl.textContent = JSON.stringify(await res.json(), null, 2);
    }
    async function getAccessRecords() {
      const payload = {
        deviceId: document.getElementById("clientDeviceId").value.trim(),
        lookbackMinutes: Number(document.getElementById("lookbackMinutes").value || 60),
        count: 100
      };
      const res = await fetch("/dev/ui/client/access-records", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload)
      });
      clientResultEl.textContent = JSON.stringify(await res.json(), null, 2);
    }
    document.getElementById("refresh").addEventListener("click", refreshSnapshot);
    document.getElementById("emit").addEventListener("click", emitEvent);
    document.getElementById("loginBtn").addEventListener("click", loginDevice);
    document.getElementById("recordsBtn").addEventListener("click", getAccessRecords);
    refreshSnapshot().catch((err) => { snapshotEl.textContent = String(err); });
  </script>
</body>
</html>`;
}

