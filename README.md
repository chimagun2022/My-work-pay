# My Work & Pay — private iPhone PWA (v1)

## What's included
- Clock in / clock out with an active shift indicator
- Manual shift entry and editing, including overnight shifts
- Manually entered unpaid break minutes
- Monthly shift hours and gross pay estimate
- Paid/unpaid leave and leave allowance tracker
- Simplified England 2026/27 Income Tax and employee NI estimate
- Optional pension contribution and pension tax-treatment setting
- JSON backup/restore and monthly CSV report
- PWA manifest and service worker for installable/offline use after first load

## Important limits
This is a first prototype. Tax is a simplified estimate, not HMRC payroll software or a payslip. It does not model cumulative PAYE, all tax codes, student loans, benefits, multiple jobs, irregular pay-period rules or all pension schemes. Check current HMRC guidance and your payslip before relying on a figure. Holiday pay is a user-configured estimate; UK holiday-pay entitlement and reference-period rules can be more complicated than a flat daily rate.

Data is stored in browser local storage on the device. It is not encrypted by this app. Anyone with access to the unlocked device/browser profile may be able to view it. Export a JSON backup regularly. Deleting Safari website data may delete records.

## Free hosting with GitHub Pages
1. On a computer, sign in to GitHub and create a new repository, e.g. `my-work-pay`.
2. Upload all files in this folder to the repository root. Include `index.html`, `styles.css`, `app.js`, `manifest.webmanifest`, `sw.js`, `icon-192.png`, and `icon-512.png`.
3. In the repository, open **Settings → Pages**.
4. Under build/deployment, choose **Deploy from a branch**, select the default branch (often `main`) and folder `/ (root)`, then save.
5. Wait for GitHub Pages to publish. The site URL is usually `https://YOUR-USERNAME.github.io/my-work-pay/`.
6. Open that URL in Safari on your iPhone. Test that the page loads and add a test shift.
7. In Safari, tap **Share** → **Add to Home Screen**. If shown, enable **Open as Web App**, then tap **Add**.
8. Open the new home-screen icon. Load the app once while online so its assets can be cached for offline use.
9. In Settings, use **Export full backup (JSON)** to save a backup. Test the import feature with a backup copy before depending on it.

GitHub Pages is a public static-hosting service: do not put personal work records in the repository. Only app code should be uploaded. The app data stays in the browser local storage and is not sent to the GitHub repository by this code. Anyone who knows the published URL can open the app, but each browser profile has its own local data.

## Test checklist
- Add a shift, edit it, and confirm hours = elapsed time minus unpaid break.
- Test overnight shift, e.g. 22:00 to 06:00 with a 30-minute break.
- Clock in and clock out; then edit the saved shift to correct breaks.
- Add paid leave and unpaid leave and check the monthly report.
- Change hourly rate and pension settings; verify estimate changes.
- Export JSON, clear test data, then import the JSON backup.
- Export a CSV report and open it in Numbers or Excel.
- After the app is installed and loaded once, switch on Airplane Mode and check that it opens.

## Tax calculation note
The estimator annualises the selected month's gross pay (monthly gross × 12), applies simplified annual Income Tax bands and uses a monthly NI threshold approximation. It is not a precise per-pay-period PAYE/NI calculation. Scottish Income Tax has separate bands; other settings are present for region selection. Before using for decisions, compare with HMRC calculators and actual payroll records.
