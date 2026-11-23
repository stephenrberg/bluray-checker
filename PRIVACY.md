# Privacy Policy — Blu-ray.com Collection Checker

**Effective Date:** November 23, 2026  
**Developer:** Stephen Berg (`stephenrberg.com`)

## Overview
Blu-ray.com Collection Checker ("the Extension") is a browser tool designed to help physical media collectors check whether Blu-ray, 4K Ultra HD, and DVD listings on supported retail websites already exist in their personal Blu-ray.com collection.

Your privacy is respected completely: **the Extension does not collect, transmit, store remotely, sell, or share any personal data or browsing history.**

## Data Processed by the Extension
1. **User-Imported Collection Data (`chrome.storage.local`):**
   - When you upload a CSV export from Blu-ray.com in the Extension popup, the Extension parses the file locally in your browser to extract product identifiers (UPC/EAN barcodes, ASINs) and normalized movie/TV titles.
   - This parsed data is saved exclusively in your browser's local storage (`chrome.storage.local`) so lookups work offline and across browser sessions.
   - No collection data, CSV contents, or file metadata are ever uploaded to an external server.

2. **Retail Product Page Content:**
   - When you visit supported retail product pages (JB Hi-Fi, Sanity, EzyDVD, Amazon, and eBay), the Extension inspects page content locally in your browser to read the product title, ASIN, or UPC/EAN barcode and compare it against your locally stored collection.
   - On supported Shopify-based storefronts (such as JB Hi-Fi and Sanity), the Extension may fetch the storefront's own public product JSON endpoint (`/products/<handle>.js`) on the same domain to retrieve the product barcode.
   - The Extension does not log, track, or transmit the URLs you visit or the products you view.

## Third-Party Services & Analytics
- The Extension contains **no** analytics, telemetry, crash reporting, advertising SDKs, or third-party tracking scripts.
- No data is shared with or sold to third parties.

## Data Retention & Deletion
- Your imported collection data remains stored locally on your device until you overwrite it with a new CSV import, clear the Extension's storage, or uninstall the Extension.
- Uninstalling the Extension immediately deletes all data stored in `chrome.storage.local`.

## Changes to This Policy
If future updates change how the Extension handles local data or supported storefronts, this Privacy Policy will be updated with a revised effective date.

## Contact
If you have questions about this Privacy Policy or the Extension, you can reach the developer via [stephenrberg.com](https://www.stephenrberg.com/).