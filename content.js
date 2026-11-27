function normalizeTitle(raw) {
  return (raw || "")
    .toLowerCase()
    .replace(/\[.*?\]|\(.*?\)/g, " ")
    .replace(/\b(4k ultra hd|4k\s*\+\s*blu-?ray|4k\s+blu-?ray|ultra hd|uhd|4k|blu-ray|bluray|blu ray|dvd|3d|steelbook|mediabook|slipcover|o-ring|rigid case|collector'?s edition|limited edition|special edition|ltd|lionsgate limited|arrow video|vinegar syndrome|kino lorber|criterion collection|shout factory|scream factory|second sight|imprint|exclusive|remastered|region [a-c0-9]|region free|australia|australian|aus stock|import|uk import|us import|us|uk|fsk|bbfc|brand new|new|sealed|free post|free postage|complete series|season \d+)\b/g, " ")
    .replace(/\bii\b/g, "2")
    .replace(/\biii\b/g, "3")
    .replace(/\biv\b/g, "4")
    .replace(/\bv\b/g, "5")
    .replace(/\bvi\b/g, "6")
    .replace(/\bvii\b/g, "7")
    .replace(/\bviii\b/g, "8")
    .replace(/\bix\b/g, "9")
    .replace(/\bx\b/g, "10")
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

function extractBarcodesFromText(rawText, maxMatches = 20) {
  const found = [];
  if (!rawText || typeof rawText !== "string") return found;
  const cleanedText = rawText.replace(/[\u200e\u200f\u202a-\u202e]/g, "");
  if (!cleanedText || cleanedText.length > 250000) return found;

  const regex = /\b(?:EAN|UPC|GTIN|Barcode|JAN|Strichcode|Code-barres|Codice a barre|C[oó]digo de barras)\b[^\S\r\n]*[:;\-]?[\s\r\n]*([0-9][0-9\s\-]{10,15}[0-9])/gi;
  let match;
  let count = 0;
  while ((match = regex.exec(cleanedText)) !== null && count < maxMatches) {
    const clean = match[1].replace(/[^0-9]/g, "");
    if ((clean.length === 12 || clean.length === 13) && !found.includes(clean)) {
      found.push(clean);
      count++;
    }
  }
  return found;
}

function extractJsonLdBarcodes(doc = document) {
  const found = [];
  const addIfBarcode = (val) => {
    if (typeof val !== "string" && typeof val !== "number") return;
    const str = String(val).trim();
    if (!/^[0-9\s\-]{12,17}$/.test(str)) return;
    const clean = str.replace(/[^0-9]/g, "");
    if ((clean.length === 12 || clean.length === 13) && !found.includes(clean)) {
      found.push(clean);
    }
  };

  doc.querySelectorAll('script[type="application/ld+json"]').forEach(script => {
    try {
      const json = JSON.parse(script.textContent);
      const items = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        for (const key of ["gtin13", "gtin12", "gtin", "gtin14", "productID", "isbn", "sku"]) {
          addIfBarcode(item[key]);
        }
        const offers = Array.isArray(item.offers) ? item.offers : item.offers ? [item.offers] : [];
        for (const offer of offers) {
          if (!offer || typeof offer !== "object") continue;
          for (const key of ["gtin13", "gtin12", "gtin", "gtin14", "sku"]) {
            addIfBarcode(offer[key]);
          }
        }
      }
    } catch (_) {}
  });
  return found;
}

function extractRetailStoreProduct(siteSuffixRegex, scopeSelector = null) {
  const scopeEl = scopeSelector ? document.querySelector(scopeSelector) : null;
  const h1 = (scopeEl || document).querySelector("h1") || document.querySelector("h1");
  const rawTitle = h1?.textContent?.trim() || document.title.replace(siteSuffixRegex, "").trim();
  const title = rawTitle || "";

  const barcodes = new Set(extractJsonLdBarcodes(document));
  try {
    const rawBody = scopeEl ? scopeEl.innerText : document.body?.innerText;
    for (const code of extractBarcodesFromText(rawBody)) {
      barcodes.add(code);
    }
  } catch (_) {}

  return { barcodes: Array.from(barcodes), title };
}

function extractJbhifiProduct() {
  return extractRetailStoreProduct(/\s*\|\s*JB Hi-Fi.*$/i);
}

function extractSanityProduct() {
  return extractRetailStoreProduct(/\s*[\|\-]\s*Sanity.*$/i);
}

function extractEzydvdProduct() {
  return extractRetailStoreProduct(/\s*[\|\-]\s*EzyDVD.*$/i);
}

function extractOutrunDvdProduct() {
  return extractRetailStoreProduct(/\s*[\|\-\u2013]\s*Outrun\s*DVD.*$/i);
}

function extractOrbitDvdProduct() {
  return extractRetailStoreProduct(/\s*[\|\-\u2013]\s*Orbit\s*DVD.*$/i);
}

function extractDeadEndDvdProduct() {
  return extractRetailStoreProduct(/\s*[\|\-\u2013]\s*DeadEndDVD.*$/i);
}

function extractUmbrellaProduct() {
  const domTitle =
    document.querySelector("product-info .product-title, .product-title")?.textContent?.trim() ||
    document.querySelector('meta[property="og:title"]')?.getAttribute("content")?.trim() ||
    "";
  const fallback = extractRetailStoreProduct(/\s*[\|\-\u2013\u2014]\s*Umbrella\s*Entertainment.*$/i);

  return {
    barcodes: fallback.barcodes,
    title: domTitle || fallback.title
  };
}

function extractPlayMusicDvdProduct() {
  return extractRetailStoreProduct(
    /\s*[\|\-\u2013\u2014]\s*(?:PLAY\s*Music\s*&?\s*DVDs?|Play\s*Music\s*DVDs?).*$/i,
    "div.product.type-product"
  );
}

function extractCexProduct() {
  const h1 = document.querySelector("h1");
  const h1Text = h1?.textContent?.trim() || "";
  const docTitleClean = document.title
    .replace(/\s*[\|\-\u2013\u2014]\s*CeX(?:\s*\([^)]*\))?.*$/i, "")
    .trim();
  const title = h1Text || (/^cex\b/i.test(docTitleClean) ? "" : docTitleClean);

  const barcodes = new Set(extractJsonLdBarcodes(document));

  try {
    const paramId = (new URLSearchParams(window.location.search).get("id") || "").replace(/[^0-9]/g, "");
    if (paramId.length === 12 || paramId.length === 13) {
      barcodes.add(paramId);
    }
  } catch (_) {}

  try {
    const rawBody = document.body?.innerText;
    for (const code of extractBarcodesFromText(rawBody)) {
      barcodes.add(code);
    }
  } catch (_) {}

  return { barcodes: Array.from(barcodes), title };
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

  const barcodes = new Set(extractJsonLdBarcodes(document));
  try {
    const rawText = detailContainers
      .map(sel => document.querySelector(sel)?.innerText || "")
      .join("\n");
    for (const code of extractBarcodesFromText(rawText)) {
      barcodes.add(code);
    }
  } catch (_) {}

  return { asin, barcodes: Array.from(barcodes), title };
}

function collectShadowRoots(root, out = []) {
  root.querySelectorAll("*").forEach(el => {
    if (el.shadowRoot) {
      out.push(el.shadowRoot);
      collectShadowRoots(el.shadowRoot, out);
    }
  });
  return out;
}

function scanLabelValuesInRoot(root, barcodes, altTitles, addCode) {
  root.querySelectorAll(".ux-labels-values__labels, dt").forEach(labelEl => {
    const label = (labelEl.textContent || "").trim().toUpperCase();
    if (!label) return;

    if (/\b(UPC|EAN|GTIN|JAN|STRICHCODE|CODE-BARRES)\b/.test(label)) {
      const container = labelEl.closest(".ux-layout-section-evo__col, .ux-labels-values, dl");
      const valueEl = container?.querySelector(".ux-labels-values__values, dd") || labelEl.nextElementSibling;
      addCode(valueEl?.textContent);
    }

    if (/\b(MOVIE\/TV TITLE|MOVIE TITLE|TV TITLE|FILM-\/FERNSEHTITEL|TITRE DU FILM|TITOLO DEL FILM|T[IÍ]TULO DE LA PEL[IÍ]CULA|TITLE)\b/.test(label)) {
      const container = labelEl.closest(".ux-layout-section-evo__col, .ux-labels-values, dl");
      const valueEl = container?.querySelector(".ux-labels-values__values, dd") || labelEl.nextElementSibling;
      const val = (valueEl?.textContent || "").trim();
      if (val && val.toLowerCase() !== "does not apply") altTitles.add(val);
    }
  });
}

function extractEbayProduct() {
  if (!window.location.pathname.startsWith("/itm/")) return null;

  const titleEl = document.querySelector("h1.x-item-title__mainTitle, h1#itemTitle, [data-testid='x-item-title']");
  const title = titleEl ? titleEl.textContent.replace(/^Details about\s*/i, "").trim() : "";
  if (!title) return null;

  const barcodes = new Set();
  const altTitles = new Set();
  const addCode = (raw) => {
    const clean = String(raw || "").replace(/[^0-9]/g, "");
    if (clean.length === 12 || clean.length === 13) barcodes.add(clean);
  };

  // 1. Page <title> (eBay appends catalog UPC/EAN here, e.g. "... : NEW 9317731098314 | eBay Australia")
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
    for (const code of extractJsonLdBarcodes(doc)) {
      barcodes.add(code);
    }

    // 3. Direct DOM scan first, then Shadow DOMs only if needed
    scanLabelValuesInRoot(doc, barcodes, altTitles, addCode);
    if (barcodes.size === 0 || altTitles.size === 0) {
      for (const shadowRoot of collectShadowRoots(doc)) {
        scanLabelValuesInRoot(shadowRoot, barcodes, altTitles, addCode);
      }
    }

    // 4. Fallback regex across visible body text only if no barcode found yet
    if (barcodes.size === 0) {
      try {
        for (const code of extractBarcodesFromText(doc.body?.innerText)) {
          barcodes.add(code);
        }
      } catch (_) {}
    }
  }

  return { barcodes: Array.from(barcodes), title, altTitles: Array.from(altTitles) };
}

function isAmazonHost(host) {
  return (
    host === "amazon.com" ||
    host.endsWith(".amazon.com") ||
    /\.amazon\.(com\.au|co\.uk|ca|de|fr|it|es|co\.jp)$/.test(host)
  );
}

function isEbayHost(host) {
  return (
    host === "ebay.com" ||
    host.endsWith(".ebay.com") ||
    /\.ebay\.(com\.au|co\.uk|ca|de|fr|it|es)$/.test(host)
  );
}

async function handleSimpleRetailPage({ host, path, currentKey, daysOld, barcodeSet, asinSet, titlesMap, isProductPath, extractor, supportsJsEndpoint }) {
  lastCheckedKey = currentKey;
  if (!isProductPath(path)) {
    renderBanner(null, 0);
    return;
  }

  const domProduct = extractor();
  let apiBarcode = "";
  let apiTitle = "";

  if (supportsJsEndpoint && path.includes("/products/")) {
    const jsPath = path.replace(/^\/collections\/[^/]+/, "");
    try {
      const res = await fetch(`${jsPath}.js`);
      if (res.ok) {
        const product = await res.json();
        apiBarcode = product?.variants?.[0]?.barcode || "";
        apiTitle = product?.title || "";
      }
    } catch (_) {}
  }

  const combined = {
    barcode: apiBarcode,
    barcodes: domProduct.barcodes,
    title: apiTitle || domProduct.title
  };

  if (!combined.title && !combined.barcode && combined.barcodes.length === 0) return;

  const match = evaluateOwnership(combined, barcodeSet, asinSet, titlesMap);
  renderBanner(match, daysOld);
}

let lastCheckedKey = "";
let ebayPollTicks = 0;
let cexPollTicks = 0;
const MAX_EBAY_POLL_TICKS = 6; // ~9s at 1500ms interval
const MAX_CEX_POLL_TICKS = 8; // ~12s at 1500ms interval

async function checkCurrentPage() {
  if (document.hidden) return;
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
  const daysOld = typeof collectionData.updatedAt === "number" ? Math.max(0, Math.floor((Date.now() - collectionData.updatedAt) / 86400000)) : 0;

  // 1. JB Hi-Fi
  if (host.includes("jbhifi.com.au")) {
    await handleSimpleRetailPage({
      host,
      path,
      currentKey,
      daysOld,
      barcodeSet,
      asinSet,
      titlesMap,
      isProductPath: p => p.startsWith("/products/"),
      extractor: extractJbhifiProduct,
      supportsJsEndpoint: true
    });
    return;
  }

  // 2. Sanity
  if (host.includes("sanity.com.au")) {
    await handleSimpleRetailPage({
      host,
      path,
      currentKey,
      daysOld,
      barcodeSet,
      asinSet,
      titlesMap,
      isProductPath: p => p.startsWith("/products/") || p.includes("/product/"),
      extractor: extractSanityProduct,
      supportsJsEndpoint: true
    });
    return;
  }

  // 3. EzyDVD
  if (host.includes("ezydvd.com.au")) {
    await handleSimpleRetailPage({
      host,
      path,
      currentKey,
      daysOld,
      barcodeSet,
      asinSet,
      titlesMap,
      isProductPath: p => /\/dp\/\d+/i.test(p) || /^\/(?:blu-ray|4k-uhd|dvd|product|products)\//i.test(p),
      extractor: extractEzydvdProduct,
      supportsJsEndpoint: false
    });
    return;
  }

  // 4. Outrun DVD
  if (host.includes("outrundvd.com.au")) {
    await handleSimpleRetailPage({
      host,
      path,
      currentKey,
      daysOld,
      barcodeSet,
      asinSet,
      titlesMap,
      isProductPath: p => p.includes("/products/"),
      extractor: extractOutrunDvdProduct,
      supportsJsEndpoint: true
    });
    return;
  }

  // 5. Orbit DVD
  if (host.includes("orbitdvd.com")) {
    await handleSimpleRetailPage({
      host,
      path,
      currentKey,
      daysOld,
      barcodeSet,
      asinSet,
      titlesMap,
      isProductPath: p => p.includes("/products/"),
      extractor: extractOrbitDvdProduct,
      supportsJsEndpoint: true
    });
    return;
  }

  // 6. DeadEndDVD
  if (host.includes("deadenddvd.com")) {
    await handleSimpleRetailPage({
      host,
      path,
      currentKey,
      daysOld,
      barcodeSet,
      asinSet,
      titlesMap,
      isProductPath: p => p.includes("/products/"),
      extractor: extractDeadEndDvdProduct,
      supportsJsEndpoint: true
    });
    return;
  }

  // 7. Umbrella Entertainment
  if (host.includes("umbrellaent.com.au")) {
    await handleSimpleRetailPage({
      host,
      path,
      currentKey,
      daysOld,
      barcodeSet,
      asinSet,
      titlesMap,
      isProductPath: p => p.includes("/products/"),
      extractor: extractUmbrellaProduct,
      supportsJsEndpoint: true
    });
    return;
  }

  // 8. PLAY Music & DVDs
  if (host.includes("playmusicdvds.com.au")) {
    await handleSimpleRetailPage({
      host,
      path,
      currentKey,
      daysOld,
      barcodeSet,
      asinSet,
      titlesMap,
      isProductPath: p => p.includes("/product/") || p.includes("/products/"),
      extractor: extractPlayMusicDvdProduct,
      supportsJsEndpoint: false
    });
    return;
  }

  // 9. CeX Australia
  if (host.includes("webuy.com")) {
    if (!path.includes("/product")) {
      lastCheckedKey = currentKey;
      cexPollTicks = 0;
      renderBanner(null, 0);
      return;
    }

    cexPollTicks++;
    const cexProduct = extractCexProduct();
    if (!cexProduct.title && cexProduct.barcodes.length === 0) {
      if (cexPollTicks >= MAX_CEX_POLL_TICKS) {
        lastCheckedKey = currentKey;
        cexPollTicks = 0;
      }
      return;
    }

    const match = evaluateOwnership(cexProduct, barcodeSet, asinSet, titlesMap);
    renderBanner(match, daysOld);

    if (cexProduct.title || cexPollTicks >= MAX_CEX_POLL_TICKS) {
      lastCheckedKey = currentKey;
      cexPollTicks = 0;
    }
    return;
  }

  // 10. Global Amazon storefronts
  if (isAmazonHost(host)) {
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

  // 11. Global eBay storefronts
  if (isEbayHost(host)) {
    if (!path.startsWith("/itm/")) {
      lastCheckedKey = currentKey;
      ebayPollTicks = 0;
      renderBanner(null, 0);
      return;
    }

    ebayPollTicks++;
    const ebayProduct = extractEbayProduct();
    if (!ebayProduct || !ebayProduct.title) {
      if (ebayPollTicks >= MAX_EBAY_POLL_TICKS) {
        lastCheckedKey = currentKey;
        ebayPollTicks = 0;
      }
      return;
    }

    const match = evaluateOwnership(ebayProduct, barcodeSet, asinSet, titlesMap);
    renderBanner(match, daysOld);

    // Lock once a barcode is found, Item Specifics table renders, or max poll budget is reached
    if (
      ebayProduct.barcodes.length > 0 ||
      document.querySelector(".ux-layout-section-evo__item--table-view") ||
      ebayPollTicks >= MAX_EBAY_POLL_TICKS
    ) {
      lastCheckedKey = currentKey;
      ebayPollTicks = 0;
    }
  }
}

checkCurrentPage();
setInterval(checkCurrentPage, 1500);
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) checkCurrentPage();
});