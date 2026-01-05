# DDRC Web App - Page Structure & Button Analysis

## Overview
This document maps all pages, their buttons, links, and navigation patterns for the demo runner.

---

## 1. `/login` - Login Page
**File:** `app/login/page.tsx`

**Elements:**
- Input: `input[type="tel"]` - Phone number (10 digits)
- Button: `button[type="submit"]` - "ओटीपी पाठवा" (Send OTP)
- Selector: `.btn-primary` with text "ओटीपी पाठवा"

**Navigation:**
- On submit → `/otp?phone={phone}`

**Demo Action:**
- Fill phone: `9999999999` (admin bypass)
- Click submit button
- Wait for navigation to `/otp`

---

## 2. `/otp` - OTP Verification Page
**File:** `app/otp/page.tsx`

**Elements:**
- Input: `input[type="text"]` - OTP (6 digits, auto-verifies when 6 digits entered)
- Button: `button.btn-primary` - "पडताळा" (Verify)
- Button: `button.btn-link` - "ओटीपी पुन्हा पाठवा" (Resend OTP)
- Display: Phone number (read-only)
- Display: Name (read-only, editable with pencil icon)
- Display: Role badge

**Navigation:**
- Auto-verifies when OTP length = 6
- On verify → `/dashboard`

**Demo Action:**
- Fill OTP: `000000` (bypass OTP)
- Wait for auto-verification or click "पडताळा"
- Wait for navigation to `/dashboard`

---

## 3. `/dashboard` - Dashboard Page
**File:** `app/dashboard/page.tsx`

**Elements:**
- Stat cards: Multiple `.card` elements with stats
- Chart filters: `select.form-select` - Filter dropdown (taluka, gender, disability, udid, fieldOfficers)
- Charts: Bar charts and Doughnut charts
- Lists: Taluka, District, Gender breakdowns
- Age ranges table

**Navigation:**
- Sidebar navigation (via AdminLayout)
- No direct buttons to other pages (navigation via sidebar)

**Demo Action:**
- Wait for page load
- Highlight stat cards
- Show chart filters
- Navigate via sidebar to other pages

---

## 4. `/survekshan` - Surveys List Page
**File:** `app/survekshan/page.tsx`

**Elements:**
- Filter dropdown: `select.form-select` - Filter type (all, unassigned, pending, etc.)
- DataTable: `table.dataTable` - Surveys table
- View buttons: `button.btn-outline-primary:has(i.bi-eye)` - View survey detail
- Button onclick: `onclick="handleViewSurvey({id})"` - Calls global function

**Navigation:**
- Click view button → `/surveys/{id}`

**Demo Action:**
- Wait for DataTable to load
- Find first view button: `button.btn-outline-primary:has(i.bi-eye)`
- Extract survey ID from onclick attribute
- Click button
- Wait for navigation to `/surveys/{id}`

**Important:**
- Uses DataTables library (jQuery)
- View button is dynamically rendered in DataTable
- Global function `handleViewSurvey(id)` navigates

---

## 5. `/surveys/[id]` - Survey Detail Page
**File:** `app/surveys/[id]/page.tsx`

**Elements:**
- Export buttons:
  - `button.btn-outline-success` - "Excel मध्ये निर्यात करा" (Export to Excel)
  - `button.btn-outline-danger` - "PDF मध्ये निर्यात करा" (Export to PDF)
- Verification Officer buttons (if user is verification_officer):
  - `button.btn-warning` - "स्पष्टीकरण विनंती करा" (Request Clarification)
  - `button.btn-success` - "पडताळलेले म्हणून चिन्हांकित करा" (Mark as Verified)
  - `button.btn-danger` - "नाकारा" (Reject)
- Back button: `button.btn-secondary` - "मागे जा" (Go Back)
- Edit answer buttons: `button.btn-outline-primary:has(i.bi-pencil)` - Edit answer
- Clarification buttons: `button.btn-outline-warning:has(i.bi-question-circle)` - Request clarification

**Navigation:**
- Back button → `/survekshan`
- Modals for clarification/rejection

**Demo Action:**
- Wait for survey details to load
- Highlight export buttons
- If verification officer, highlight action buttons
- Show answer sections
- Navigate back to survekshan

---

## 6. `/sections` - Sections Management Page
**File:** `app/sections/page.tsx`

**Elements:**
- Add button: `button.btn-primary` - "नवीन सर्वेक्षण सुरू करा" (Start New Survey) - Actually navigates to survekshan
- DataTable: `table.dataTable` - Sections table
- Edit buttons: `button.btn-outline-primary:has(i.bi-pencil)` - Edit section
- Delete buttons: `button.btn-outline-danger:has(i.bi-trash)` - Delete section
- Button onclick: `onclick="handleEditSection({id})"` and `onclick="handleDeleteSection({id})"`

**Navigation:**
- Add button → `/survekshan`
- Edit/Delete via modals

**Demo Action:**
- Wait for DataTable to load
- Show sections list
- Highlight edit/delete buttons
- Show modals if clicked

---

## 7. `/questions` - Questions Management Page
**File:** `app/questions/page.tsx`

**Elements:**
- Add button: `button.btn-primary` - "Add Question"
- Filter dropdown: `select.form-select` - Section filter
- DataTable: `table.dataTable` - Questions table
- Edit buttons: `button.btn-outline-primary:has(i.bi-pencil)` - Edit question
- Delete buttons: `button.btn-outline-danger:has(i.bi-trash)` - Delete question
- Button onclick: `onclick="handleEditQuestion({id})"` and `onclick="handleDeleteQuestion({id})"`

**Navigation:**
- Add/Edit via modals

**Demo Action:**
- Wait for DataTable to load
- Show questions list
- Highlight add/edit/delete buttons
- Show modals if clicked

---

## 8. `/officers` - Field Officers Page
**File:** `app/officers/page.tsx`

**Elements:**
- Refresh button: `button.btn-primary` - "Refresh"
- Expandable rows: `tr` with `onClick` - Expand to show forms
- Chevron icon: `i.bi-chevron-right` / `i.bi-chevron-down` - Expand/collapse indicator

**Navigation:**
- No navigation, just expand/collapse rows

**Demo Action:**
- Wait for officers list to load
- Click first row to expand
- Show completed/incomplete forms
- Highlight refresh button

---

## 9. `/access-requests` - Access Requests Page
**File:** `app/access-requests/page.tsx`

**Elements:**
- Filter buttons: `button.btn-outline-primary` / `button.btn-primary` - Status filters (प्रलंबित, मंजूर केलेले, नाकारलेले)
- Refresh button: `button.btn-outline-secondary` - "रिफ्रेश"
- View selfie button: `button.btn-outline-info` - "पाहा" (View selfie)
- Approve button: `button.btn-success` - "मंजूर" (Approve)
- Decline button: `button.btn-danger` - "नाकारा" (Decline)
- Note textarea: `textarea.form-control` - Admin notes

**Navigation:**
- No navigation, just status updates

**Demo Action:**
- Wait for requests to load
- Show filter buttons
- Highlight approve/decline buttons
- Show selfie modal if clicked

---

## 10. `/admin/rate` - Admin Rate Page
**File:** `app/admin/rate/page.tsx`

**Elements:**
- Input: `input[type="number"]` - Rate input
- Save button: `button.btn-primary[type="submit"]` - "जतन करा" (Save)

**Navigation:**
- No navigation, just save rate

**Demo Action:**
- Wait for page load
- Show rate input
- Highlight save button
- Show save action

---

## 11. `/api-docs` - API Documentation Page
**File:** `app/api-docs/page.tsx`

**Elements:**
- SwaggerUI component - Full API documentation

**Navigation:**
- No navigation, just documentation

**Demo Action:**
- Wait for SwaggerUI to load
- Highlight API documentation interface

---

## Common Navigation Elements

### Sidebar (AdminLayout)
**File:** `components/AdminLayout.tsx`

**Menu Items:**
- Dashboard: `/dashboard`
- Survekshan: `/survekshan`
- Sections: `/sections`
- Questions: `/questions`
- Access Requests: `/access-requests`
- Officers: `/officers`
- Admin Rate: `/admin/rate`

**Selectors:**
- Sidebar links: `a[href="/{path}"]` or navigation via router

---

## Key Patterns

### 1. DataTables
- Many pages use DataTables (jQuery-based)
- Buttons are rendered dynamically in DataTable columns
- Global functions handle button clicks: `handleViewSurvey`, `handleEditSection`, etc.
- Wait for DataTable to initialize before interacting

### 2. Modals
- Many actions open modals (clarification, rejection, edit, delete)
- Modals use: `div.modal.show.d-block`
- Close buttons: `button.btn-close`

### 3. Dynamic Routes
- Survey detail: `/surveys/{id}` - ID is dynamic
- Extract ID from URL or button onclick

### 4. User Type Based UI
- Verification officers see different buttons on survey detail page
- Check `localStorage.getItem('user_type')` for user type

### 5. Auto-Verification
- OTP page auto-verifies when 6 digits entered
- May not need to click verify button

---

## Demo Runner Requirements

1. **Wait for DataTables**: Always wait for DataTable initialization before clicking buttons
2. **Extract IDs**: Extract survey IDs from onclick attributes or URLs
3. **Handle Modals**: Wait for modals to appear before interacting
4. **Check User Type**: Verify user type for conditional UI elements
5. **Route Verification**: Always verify route before playing audio
6. **Button Selectors**: Use specific selectors (class + icon) for buttons

---

## Button Selector Reference

| Page | Button | Selector |
|------|--------|----------|
| Login | Send OTP | `button.btn-primary[type="submit"]` |
| OTP | Verify | `button.btn-primary` with text "पडताळा" |
| Survekshan | View Survey | `button.btn-outline-primary:has(i.bi-eye)` |
| Survey Detail | Export Excel | `button.btn-outline-success` with text "Excel" |
| Survey Detail | Export PDF | `button.btn-outline-danger` with text "PDF" |
| Survey Detail | Mark Verified | `button.btn-success` with text "पडताळलेले" |
| Survey Detail | Reject | `button.btn-danger` with text "नाकारा" |
| Survey Detail | Back | `button.btn-secondary` with text "मागे जा" |
| Sections | Edit | `button.btn-outline-primary:has(i.bi-pencil)` |
| Sections | Delete | `button.btn-outline-danger:has(i.bi-trash)` |
| Questions | Add | `button.btn-primary` with text "Add Question" |
| Questions | Edit | `button.btn-outline-primary:has(i.bi-pencil)` |
| Questions | Delete | `button.btn-outline-danger:has(i.bi-trash)` |
| Officers | Refresh | `button.btn-primary` with text "Refresh" |
| Access Requests | Approve | `button.btn-success` with text "मंजूर" |
| Access Requests | Decline | `button.btn-danger` with text "नाकारा" |
| Admin Rate | Save | `button.btn-primary[type="submit"]` |

---

## Audio File Mapping

| Audio File | Route | Page |
|------------|-------|------|
| `login.mp3` | `/login` | Login Page |
| `otp.mp3` | `/otp` | OTP Verification |
| `dashboard.mp3` | `/dashboard` | Dashboard |
| `survekshan.mp3` | `/survekshan` | Surveys List |
| `surveys-detail.mp3` | `/surveys/{id}` | Survey Detail |
| `sections.mp3` | `/sections` | Sections Management |
| `questions.mp3` | `/questions` | Questions Management |
| `officers.mp3` | `/officers` | Field Officers |
| `access-requests.mp3` | `/access-requests` | Access Requests |
| `admin-rate.mp3` | `/admin/rate` | Admin Rate |
| `api-docs.mp3` | `/api-docs` | API Documentation |


