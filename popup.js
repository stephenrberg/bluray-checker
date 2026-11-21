function normalizeTitle(raw) {
  return (raw || "")
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, " ")
    .replace(/\b(4k ultra hd|ultra hd|uhd|4k|blu-ray|bluray|dvd|3d|steelbook|collector'?s edition|limited edition|special edition|remastered|region [a-c0-9]|australia|import|complete series|season \d+)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseCSVLine(line) {
  const result = [];
  let cur = "", inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (ch === "," && !inQuotes) {
      result.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  result.push(cur.trim());
  return result;
}

function parseBlurayExport(text) {
  const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { barcodes: [], asins: [], titles: {} };

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase());
  const upcIdx = headers.indexOf("upc");
  const eanIdx = headers.indexOf("ean");
  const titleIdx = headers.indexOf("title");
  const studioIdx = headers.indexOf("studio");

  const barcodes = new Set();
  const asins = new Set();
  const titles = {};

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCSVLine(lines[i]);
    
    // Extract UPC & EAN barcodes in both 12-digit and 13-digit forms
    for (const idx of [upcIdx, eanIdx]) {
      if (idx !== -1 && cols[idx]) {
        const clean = cols[idx].replace(/[^0-9]/g, "");
        if (clean.length === 12) {
          barcodes.add(clean);
          barcodes.add("0" + clean);
        } else if (clean.length === 13) {
          barcodes.add(clean);
          if (clean.startsWith("0")) barcodes.add(clean.slice(1));
        } else if (clean.length >= 8) {
          barcodes.add(clean);
        }
      }
    }

    // Extract Amazon ASINs (Blu-ray.com puts ASIN right after EAN without a header)
    for (const col of cols) {
      const trimmed = (col || "").trim().toUpperCase();
      if (/^B0[A-Z0-9]{8}$/.test(trimmed)) {
        asins.add(trimmed);
      }
    }

    const rawTitle = titleIdx !== -1 ? cols[titleIdx] : "";
    const norm = normalizeTitle(rawTitle);
    if (norm.length >= 2) {
      if (!titles[norm]) titles[norm] = [];
      titles[norm].push({
        title: rawTitle,
        studio: studioIdx !== -1 ? cols[studioIdx] : ""
      });
    }
  }

  return {
    barcodes: Array.from(barcodes),
    asins: Array.from(asins),
    titles
  };
}

async function renderStats() {
  const { collectionData } = await chrome.storage.local.get("collectionData");
  const statsEl = document.getElementById("stats");
  if (!collectionData) {
    statsEl.textContent = "No CSV uploaded yet.";
    return;
  }
  const daysAgo = Math.floor((Date.now() - collectionData.updatedAt) / 86400000);
  const ageLabel = daysAgo === 0 ? "Today" : `${daysAgo} day${daysAgo === 1 ? "" : "s"} ago`;
  const ageClass = daysAgo > 21 ? "stale" : "fresh";

  statsEl.innerHTML = `
    <div><strong>${collectionData.barcodeCount}</strong> barcodes • <strong>${collectionData.asinCount || 0}</strong> ASINs • <strong>${collectionData.titleCount}</strong> titles</div>
    <div class="age ${ageClass}">Updated: ${ageLabel}</div>
  `;
}

document.getElementById("csvFile").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const text = await file.text();
  const parsed = parseBlurayExport(text);

  const collectionData = {
    updatedAt: Date.now(),
    barcodeCount: parsed.barcodes.length,
    asinCount: parsed.asins.length,
    titleCount: Object.keys(parsed.titles).length,
    barcodes: parsed.barcodes,
    asins: parsed.asins,
    titles: parsed.titles
  };

  await chrome.storage.local.set({ collectionData });
  document.getElementById("status").textContent = "Saved! Re-upload your CSV anytime.";
  renderStats();
});

renderStats();