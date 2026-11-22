function normalizeTitle(raw) {
  return (raw || "")
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, " ")
    .replace(/\b(4k ultra hd|ultra hd|uhd|4k|blu-ray|bluray|blu ray|dvd|3d|steelbook|slipcover|o-ring|collector'?s edition|limited edition|special edition|remastered|region [a-c0-9]|region free|australia|australian|aus stock|import|brand new|new|sealed|free post|free postage|complete series|season \d+)\b/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function expandBarcodeForms(code) {
  const clean = (code || "").replace(/[^0-9]/g, "");
  const forms = [];
  if (clean.length === 12) {
    forms.push(clean, "0" + clean);
  } else if (clean.length === 13) {
    forms.push(clean);
    if (clean.startsWith("0")) forms.push(clean.slice(1));
  }
  return forms;
}

function evaluateOwnership({ barcode, barcodes = [], asin, title, altTitles = [] }, barcodeSet, asinSet, titlesMap) {
  const allBarcodes = [...(barcode ? [barcode] : []), ...barcodes]
    .flatMap(expandBarcodeForms);

  const cleanAsin = (asin || "").trim().toUpperCase();
  const candidateTitles = [title, ...altTitles]
    .map(t => normalizeTitle(t || ""))
    .filter(Boolean);

  // 1. Exact ASIN Match -> RED
  if (cleanAsin && asinSet.has(cleanAsin)) {
    return {
      status: "YOU OWN THIS",
      bg: "#bc534c",
      detail: `Exact ASIN match (${cleanAsin})`
    };
  }

  // 2. Exact UPC / EAN Barcode Match -> RED
  for (const code of allBarcodes) {
    if (barcodeSet.has(code)) {
      return {
        status: "YOU OWN THIS",
        bg: "#bc534c",
        detail: `Exact barcode match (${code})`
      };
    }
  }

  // 3. Normalized Title Match (primary title or fallback fields like Movie/TV Title) -> ORANGE
  for (const normTitle of candidateTitles) {
    if (titlesMap[normTitle]) {
      const matches = titlesMap[normTitle]
        .map(m => (m.studio ? `${m.title} — ${m.studio}` : m.title))
        .join(" | ");
      return {
        status: "YOU MIGHT OWN THIS",
        bg: "#e99323",
        detail: `In library: ${matches}`
      };
    }
  }

  return null;
}

function renderBanner(match, daysOld) {
  let banner = document.getElementById("bluray-own-banner");
  if (!match) {
    if (banner) banner.remove();
    return;
  }

  if (!banner) {
    banner = document.createElement("div");
    banner.id = "bluray-own-banner";
    document.body.appendChild(banner);
  }

  banner.style.cssText = `
    position: fixed;
    top: 84px;
    right: 20px;
    z-index: 999999;
    max-width: 340px;
    background: ${match.bg};
    color: #fff;
    padding: 14px 18px;
    border-radius: 8px;
    font-family: system-ui, -apple-system, sans-serif;
    box-shadow: 0 6px 20px rgba(0,0,0,0.28);
    border: 2px solid rgba(255,255,255,0.25);
  `;

  banner.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;">
      <span style="font-weight:800;font-size:16px;letter-spacing:0.4px;">${match.status}</span>
      <button id="bluray-own-close" style="background:none;border:none;color:#fff;font-size:18px;cursor:pointer;line-height:1;">×</button>
    </div>
    <div style="font-size:13px;margin-top:4px;line-height:1.35;">${match.detail}</div>
    <div style="font-size:11px;margin-top:6px;opacity:0.85;">Blu-ray.com CSV updated ${daysOld === 0 ? "today" : daysOld + "d ago"}</div>
  `;

  document.getElementById("bluray-own-close").onclick = () => banner.remove();
}

function extractJbhifiProduct() {
  const h1 = document.querySelector("h1");
  const rawTitle = h1?.textContent?.trim() || document.title.replace(/\s*\|\s*JB Hi-Fi.*$/i, "").trim();
  const title = rawTitle || "";

  const barcodes = [];
  try {
    const rawText = typeof document.body?.innerText === "string"
      ? document.body.innerText.replace(/[\u200e\u200f\u202a-\u202e]/g, "")
      : "";
    if (rawText) {
      const regex = /\b(?:EAN|UPC|GTIN|Barcode)\b[^\S\r\n]*[:;\-]?[\s\r\n]*([0-9][0-9\s\-]{10,15}[0-9])/gi;
      for (const m of rawText.matchAll(regex)) {
        const clean = m[1].replace(/[^0-9]/g, "");
        if ((clean.length === 12 || clean.length === 13) && !barcodes.includes(clean)) {
          barcodes.push(clean);
        }
      }
    }
  } catch (_) {}

  return { barcodes, title };
}

function extractAmazonProduct() {
  const urlMatch = window.location.pathname.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  const inputAsin = document.querySelector("#ASIN")?.value;
  const asin = (urlMatch?.[1] || inputAsin || "").toUpperCase();

  const titleEl = document.querySelector("#productTitle");
  const title = titleEl ? titleEl.textContent.trim() : "";
  if (!asin && !title) return null;

  const detailContainers = [
    "#detailBullets_feature_div",
    "#productDetails_detailBullets_sections1",
    "#productDetails_techSpec_section_1",
    "#prodDetails",
    "#productOverview_feature_div"
  ];

  const barcodes = [];
  try {
    const rawText = detailContainers
      .map(sel => document.querySelector(sel)?.innerText || "")
      .join("\n")
      .replace(/[\u200e\u200f\u202a-\u202e]/g, "");

    if (rawText) {
      const regex = /\b(?:EAN|UPC|GTIN|Barcode)\b[^\S\r\n]*[:;\-]?[\s\r\n]*([0-9][0-9\s\-]{10,15}[0-9])/gi;
      for (const m of rawText.matchAll(regex)) {
        const clean = m[1].replace(/[^0-9]/g, "");
        if ((clean.length === 12 || clean.length === 13) && !barcodes.includes(clean)) {
          barcodes.push(clean);
        }
      }
    }
  } catch (_) {}

  return { asin, barcodes, title };
}

function collectRoots(root, out = []) {
  out.push(root);
  root.querySelectorAll("*").forEach(el => {
    if (el.shadowRoot) collectRoots(el.shadowRoot, out);
  });
  return out;
}

function extractEbayProduct() {
  if (!window.location.pathname.startsWith("/itm/")) return null;

  const titleEl = document.querySelector("h1.x-item-title__mainTitle, h1#itemTitle, [data-testid='x-item-title']");
  const title = titleEl ? titleEl.textContent.replace(/^Details about\s*/i, "").trim() : "";
  if (!title) return null;

  const barcodes = new Set();
  const addCode = (raw) => {
    const clean = String(raw || "").replace(/[^0-9]/g, "");
    if (clean.length === 12 || clean.length === 13) barcodes.add(clean);
  };

  // 1. Page <title> (eBay AU appends catalog UPC/EAN here, e.g. "... : NEW 9317731098314 | eBay Australia")
  const titleBarcode = document.title.match(/\b(\d{12,13})\b/);
  if (titleBarcode) addCode(titleBarcode[1]);

  const docs = [document];
  document.querySelectorAll("iframe").forEach(frame => {
    try {
      if (frame.contentDocument) docs.push(frame.contentDocument);
    } catch (_) {}
  });

  for (const doc of docs) {
    // 2. JSON-LD schema blocks
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
      try {
        const json = JSON.parse(script.textContent);
        const items = Array.isArray(json) ? json : [json];
        for (const item of items) {
          for (const key of ["gtin13", "gtin12", "gtin", "gtin14", "productID"]) {
            addCode(item?.[key]);
          }
        }
      } catch (_) {}
    });

    // 3. Walk DOM + Shadow DOMs for Item Specifics (<dt>/<dd>) & Product Identifiers (.ux-labels-values)
    for (const root of collectRoots(doc)) {
      root.querySelectorAll(".ux-labels-values__labels, dt").forEach(labelEl => {
        const label = (labelEl.textContent || "").trim().toUpperCase();
        if (/\b(UPC|EAN|GTIN)\b/.test(label)) {
          const container = labelEl.closest(".ux-layout-section-evo__col, .ux-labels-values, dl");
          const valueEl = container?.querySelector(".ux-labels-values__values, dd") || labelEl.nextElementSibling;
          addCode(valueEl?.textContent);
        }
      });
    }

    // 4. Fallback regex across visible body text
    try {
      const rawBody = doc.body?.innerText;
      if (typeof rawBody === "string" && rawBody.length > 0 && rawBody.length < 250000) {
        const bodyText = rawBody.replace(/[\u200e\u200f\u202a-\u202e]/g, "");
        const regex = /\b(?:EAN|UPC|GTIN)\b[^\S\r\n]*[:;\-]?[\s\r\n]*([0-9][0-9\s\-]{10,15}[0-9])/gi;
        let match;
        let count = 0;
        while ((match = regex.exec(bodyText)) !== null && count < 20) {
          addCode(match[1]);
          count++;
        }
      }
    } catch (_) {}
  }

  const altTitles = new Set();
  for (const doc of docs) {
    for (const root of collectRoots(doc)) {
      root.querySelectorAll(".ux-labels-values__labels, dt").forEach(labelEl => {
        const label = (labelEl.textContent || "").trim().toUpperCase();
        if (/\b(MOVIE\/TV TITLE|MOVIE TITLE|TV TITLE|TITLE)\b/.test(label)) {
          const container = labelEl.closest(".ux-layout-section-evo__col, .ux-labels-values, dl");
          const valueEl = container?.querySelector(".ux-labels-values__values, dd") || labelEl.nextElementSibling;
          const val = (valueEl?.textContent || "").trim();
          if (val && val.toLowerCase() !== "does not apply") altTitles.add(val);
        }
      });
    }
  }

  console.log("[Blu-ray Checker] eBay extracted:", { title, altTitles: Array.from(altTitles), barcodes: Array.from(barcodes) });
  return { barcodes: Array.from(barcodes), title, altTitles: Array.from(altTitles) };
}

let lastCheckedKey = "";

async function checkCurrentPage() {
  const host = window.location.hostname;
  const path = window.location.pathname;
  const currentKey = `${host}${path}${window.location.search}`;
  if (currentKey === lastCheckedKey) return;

  const { collectionData } = await chrome.storage.local.get("collectionData");
  if (!collectionData || typeof collectionData !== "object") {
    renderBanner(null, 0);
    return;
  }

  const hasBarcodes = Array.isArray(collectionData.barcodes) && collectionData.barcodes.length > 0;
  const hasAsins = Array.isArray(collectionData.asins) && collectionData.asins.length > 0;
  const hasTitles = collectionData.titles && typeof collectionData.titles === "object" && Object.keys(collectionData.titles).length > 0;
  if (!hasBarcodes && !hasAsins && !hasTitles) {
    renderBanner(null, 0);
    return;
  }

  const barcodeSet = new Set(collectionData.barcodes || []);
  const asinSet = new Set(collectionData.asins || []);
  const titlesMap = collectionData.titles || {};
  const daysOld = typeof collectionData.updatedAt === 'number' ? Math.max(0, Math.floor((Date.now() - collectionData.updatedAt) / 86400000)) : 0;

  // 1. JB Hi-Fi
  if (host.includes("jbhifi.com.au")) {
    lastCheckedKey = currentKey;
    if (!path.startsWith("/products/")) {
      renderBanner(null, 0);
      return;
    }

    const domProduct = extractJbhifiProduct();
    let apiBarcode = "";
    let apiTitle = "";

    try {
      const res = await fetch(`${path}.js`);
      if (res.ok) {
        const product = await res.json();
        apiBarcode = product?.variants?.[0]?.barcode || "";
        apiTitle = product?.title || "";
      }
    } catch (_) {}

    const combined = {
      barcode: apiBarcode,
      barcodes: domProduct.barcodes,
      title: apiTitle || domProduct.title
    };

    if (!combined.title && !combined.barcode && combined.barcodes.length === 0) return;

    const match = evaluateOwnership(combined, barcodeSet, asinSet, titlesMap);
    renderBanner(match, daysOld);
    return;
  }

  // 2. Amazon.com.au
  if (host.includes("amazon.com.au")) {
    const isProductPage = /\/(?:dp|gp\/product)\/[A-Z0-9]{10}/i.test(path) || document.querySelector("#productTitle");
    if (!isProductPage) {
      lastCheckedKey = currentKey;
      renderBanner(null, 0);
      return;
    }

    const amazonProduct = extractAmazonProduct();
    if (!amazonProduct || !amazonProduct.title) return;

    lastCheckedKey = currentKey;
    const match = evaluateOwnership(amazonProduct, barcodeSet, asinSet, titlesMap);
    renderBanner(match, daysOld);
    return;
  }

  // 3. eBay.com.au
  if (host.includes("ebay.com.au")) {
    if (!path.startsWith("/itm/")) {
      lastCheckedKey = currentKey;
      renderBanner(null, 0);
      return;
    }

    const ebayProduct = extractEbayProduct();
    if (!ebayProduct || !ebayProduct.title) return;

    const match = evaluateOwnership(ebayProduct, barcodeSet, asinSet, titlesMap);
    renderBanner(match, daysOld);

    // Lock once a barcode is found, or once Item Specifics section has finished rendering
    if (ebayProduct.barcodes.length > 0 || document.querySelector(".ux-layout-section-evo__item--table-view")) {
      lastCheckedKey = currentKey;
    }
  }
}

checkCurrentPage();
setInterval(checkCurrentPage, 800);