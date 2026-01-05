# TTS Audio Files

This folder contains .mp3 audio files for text-to-speech explanations of each page in Marathi.

## File Naming Convention

Each .mp3 file is named according to the page it explains:

- `dashboard.mp3` - Dashboard page explanation
- `medicines.mp3` - Medicines list page
- `medicines-new.mp3` - New medicine page
- `medicines-detail.mp3` - Medicine detail page
- `inventory.mp3` - Inventory page
- `inventory-adjust.mp3` - Stock adjustment page
- `inventory-transfer.mp3` - Stock transfer page
- `inventory-audit.mp3` - Stock audit page
- `suppliers.mp3` - Suppliers list page
- `suppliers-new.mp3` - New supplier page
- `suppliers-detail.mp3` - Supplier detail page
- `purchases-orders.mp3` - Purchase orders page
- `purchases-orders-new.mp3` - New purchase order page
- `purchases-receipts.mp3` - Purchase receipts page
- `purchases-receipts-new.mp3` - New purchase receipt page
- `purchases-returns.mp3` - Purchase returns page
- `purchases-returns-new.mp3` - New purchase return page
- `customers.mp3` - Customers list page
- `customers-new.mp3` - New customer page
- `customers-detail.mp3` - Customer detail page
- `sales.mp3` - Sales list page
- `sales-new.mp3` - New sale page
- `sales-detail.mp3` - Sale detail page
- `sales-returns.mp3` - Sales returns page
- `sales-returns-new.mp3` - New sales return page
- `expiry-management.mp3` - Expiry management page
- `expiry-reports.mp3` - Expiry reports page
- `return-analytics.mp3` - Return analytics page
- `advanced-analytics.mp3` - Advanced analytics page
- `accounts-receivable.mp3` - Accounts receivable page
- `accounts-payable.mp3` - Accounts payable page
- `profit-loss.mp3` - Profit & Loss page
- `balance-sheet.mp3` - Balance Sheet page
- `cash-flow.mp3` - Cash Flow page
- `tax-reports.mp3` - Tax Reports page
- `reports.mp3` - Reports main page
- `reports-inventory.mp3` - Inventory reports page
- `reports-sales.mp3` - Sales reports page
- `reports-purchases.mp3` - Purchase reports page
- `settings.mp3` - Settings main page
- `settings-store.mp3` - Store settings page
- `settings-profile.mp3` - Profile settings page
- `settings-system.mp3` - System settings page

## How Audio Files Were Generated

All audio files were automatically generated using Google Text-to-Speech (gTTS) from the Marathi markdown files in the `explanations/` folder.

To regenerate audio files:
```bash
python scripts/generate-tts.py --all
```

To generate a single file:
```bash
python scripts/generate-tts.py explanations/dashboard.md
```

## Usage

The TTS player component will automatically detect the current page and play the corresponding audio file when the speaker icon is clicked in the header.

