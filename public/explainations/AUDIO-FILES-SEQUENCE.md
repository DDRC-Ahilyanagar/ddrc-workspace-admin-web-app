# Audio Files Playback Sequence

## Complete List of Audio Files in Demo Order

1. **01_login.mp3** - Login page (played during login step action, before typing credentials)

2. **dashboard.mp3** - Dashboard overview

3. **customers.mp3** - Customers section introduction
   - *[Action: Click "Add Customer" button - no audio]*
4. **customers-new.mp3** - Add new customer (played BEFORE action - when page loads)
5. **customers-detail.mp3** - View customer details

6. **suppliers.mp3** - Suppliers section introduction
   - *[Action: Click "Add Supplier" button - no audio]*
7. **suppliers-new.mp3** - Add new supplier (played BEFORE action - when page loads)
8. **suppliers-detail.mp3** - View supplier details

9. **medicines.mp3** - Medicines section introduction
   - *[Action: Click "Add Medicine" button - no audio]*
10. **medicines-new.mp3** - Add new medicine (played BEFORE action - when page loads)
11. **medicines-detail.mp3** - View medicine details

12. **sales.mp3** - Sales section introduction
   - *[Action: Click "New Sale" button - no audio]*
13. **sales-new.mp3** - Create new sale (played BEFORE action - when page loads)
14. **sales-detail.mp3** - View sale details

15. **sales-returns.mp3** - Sales returns section
   - *[Action: Click "New Return" button - no audio]*
16. **sales-returns-new.mp3** - Create sales return (played BEFORE action - when page loads)

17. **purchases-orders.mp3** - Purchase orders section
   - *[Action: Click "New Order" button - no audio]*
18. **purchases-orders-new.mp3** - Create purchase order (played BEFORE action - when page loads)

19. **purchases-receipts.mp3** - Purchase receipts section
   - *[Action: Click "New Receipt" button - no audio]*
20. **purchases-receipts-new.mp3** - Create purchase receipt (played BEFORE action - when page loads)

21. **purchases-returns.mp3** - Purchase returns section
   - *[Action: Click "New Return" button - no audio]*
22. **purchases-returns-new.mp3** - Create purchase return (played BEFORE action - when page loads)

23. **inventory.mp3** - Inventory section introduction
24. **inventory-adjust.mp3** - Inventory adjustment
25. **inventory-transfer.mp3** - Inventory transfer
26. **inventory-audit.mp3** - Inventory audit

27. **expiry-management.mp3** - Expiry management
28. **expiry-reports.mp3** - Expiry reports

29. **reports.mp3** - Reports section introduction
30. **reports-sales.mp3** - Sales reports
31. **reports-purchases.mp3** - Purchase reports
32. **reports-inventory.mp3** - Inventory reports

33. **profit-loss.mp3** - Profit & Loss report
34. **balance-sheet.mp3** - Balance Sheet report
35. **cash-flow.mp3** - Cash Flow report
36. **accounts-receivable.mp3** - Accounts Receivable
37. **accounts-payable.mp3** - Accounts Payable
38. **tax-reports.mp3** - Tax Reports

39. **return-analytics.mp3** - Return Analytics

40. **advanced-analytics.mp3** - Advanced Analytics

41. **settings.mp3** - Settings section introduction
42. **settings-profile.mp3** - Profile settings
43. **settings-store.mp3** - Store settings
44. **settings-system.mp3** - System settings

45. **08_outro.mp3** - Demo outro/ending

---

## Total: 45 Audio Files

## Notes:
- `01_login.mp3` is played inside the login step action (before typing credentials)
- `customers-new.mp3` uses `playAudioBeforeAction: true` (plays when add customer page loads)
- All other audio files play AFTER their respective actions complete
- Steps with empty `audioFile: ''` have no audio narration

