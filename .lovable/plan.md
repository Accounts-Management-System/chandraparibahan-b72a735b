# পরিকল্পনা

## ১. Reports পেজে Data Bank-এর মতো সার্চ অপশন
- `reports.tsx` এ `SearchFilters` (date, vehicle, owner, category, head) যোগ।
- ট্যাব ভিত্তিক (Trips / Expenses / Other Incomes) ভিউ + প্রতি ট্যাবে total footer।
- উপরে summary cards: ইনকাম, এক্সপেন্স, নেট, ভাড়া।

## ২. Others Income স্কোপ ঠিক করা (গুরুত্বপূর্ণ)
- **Others Income সেকশনে কেবল `other_incomes` টেবিলের ডাটাই দেখাবে** — কোনো owner-related auto-pull নেই।
- Reports/Data Bank-এ Others Income ট্যাব = শুধু `other_incomes` raw rows (owner filter দিলে সেই owner-এর entry শুধু)।
- কোনো ভেন্ডর/owner হিসাবের জমা এখানে যোগ হবে না।

## ৩. Owner Accounts লজিক
- **ইনকাম উৎস**: শুধু সেই owner-এর গাড়ির `trips` থেকে `fare_1+fare_2` ও `jama_1+jama_2`। অন্য কিছু নয়।
- **খরচ উৎস**: সেই owner-এর গাড়ির `trips.dena_1+dena_2` + সেই owner-এর গাড়ির `expenses`।
- **`other_incomes` থেকে কিছু আনা হবে না** owner accounts-এ।
- Net = (fare + jama) − (dena + expenses)।

## ৪. Vendor পাওনা (Receivable) নতুন এন্ট্রি অপশন
- `vendors` টেবিলে নতুন কলাম `entry_type` ('পাওনা' | 'জমা' | 'খরচ') অথবা নতুন `vendor_receivables` টেবিল যোগ।
- প্রস্তাব: একই `vendors` টেবিলে `entry_type` enum যোগ — পাওনা (receivable), জমা (collection), খরচ (payment)।
- Chandra (পরিবহন) vendor হিসাব:
  - পাওনা − (পরিবহনের `other_incomes` জমা) − (পরিবহনের `expenses` যেগুলো সেই vendor-এ পরিশোধ) = বাকি।
- প্রতি owner-এর জন্য আলাদা vendor হিসাব।

## ৫. Vendor পেজে Owner নামের বাটন
- উপরে সব owner-এর বাটন row (All + প্রতি owner)। সিলেক্ট করলে শুধু সেই owner-এর vendor entries।
- প্রতি owner-এর আলাদা summary (মোট পাওনা / জমা / খরচ / বাকি)।

---

## প্রশ্ন (অনুগ্রহ করে নিশ্চিত করুন):

1. **Vendor `entry_type` স্কিমা**: `vendors` টেবিলে `entry_type` enum কলাম যোগ করব ('receivable' / 'collection' / 'payment')? নাকি আলাদা `vendor_receivables` টেবিল?

2. **পাওনা থেকে কী বাদ যাবে (Chandra-র ক্ষেত্রে)**:
   - "পরিবহনের other_incomes জমা" বলতে কি Chandra owner_id-যুক্ত সব `other_incomes` rows?
   - "দৈনিক খরচ থেকে পরিশোধ" বলতে কি `expenses` table-এ ঐ vendor-এর নামে entry, নাকি একটা নতুন vendor-link field দরকার?

3. **Others Income এ আগে যেসব entry owner_id সহ আছে** — সেগুলো কি delete/migrate করব, নাকি just owner-scoped reporting থেকে বাদ দেব (raw থাকবে)?

approve করলে implementation শুরু করব।
