# Blu-ray Ownership Checker

A Chrome extension that checks physical media listings on Australian storefronts (**eBay.com.au**, **Amazon.com.au**, and **JB Hi-Fi**) against your personal **Blu-ray.com** CSV collection export so you can spot duplicates before buying.

## How It Works

1. **Import Your Collection:** Load your Blu-ray.com CSV export into the extension's popup, which normalizes and caches your barcodes, ASINs, and titles in `chrome.storage.local`.
2. **Browse Storefronts:** When you visit product/listing pages on supported sites, `content.js` extracts product identifiers and evaluates ownership:
   - **YOU OWN THIS (Red):** Exact match on ASIN or normalized 12/13-digit UPC/EAN barcode.
   - **YOU MIGHT OWN THIS (Orange):** Fallback match on normalized title (stripping edition, format, region, and listing noise words).
3. **Shelf Check:** If a listing only triggers a title match, double-check the exact edition/barcode in your library—different regional releases or reissues can carry different barcodes for the same film.

## Project Structure

Keep your unpacked extension files flat in a single directory (which also serves as your Git repository root):

```text
.
├── .gitignore
├── README.md
├── manifest.json
├── content.js
├── popup.html
├── popup.js
└── icons/
```

## Setup & Local Development

1. Clone or initialize the repository in your extension folder.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked** and select this folder.
5. After editing `content.js`, `popup.js`, or `manifest.json`, click **Reload** on the extension card in `chrome://extensions` and refresh the storefront tab.

## Notes for Git

- Keep personal CSV exports (`*.csv`) and cached library dumps out of version control via `.gitignore`.
- Storefront layouts (especially eBay's item specifics and inline state) change periodically; check DevTools console logs (`[Blu-ray Checker]`) when debugging extraction on a specific listing.