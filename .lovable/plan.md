## লক্ষ্য

বর্তমান সমস্যা: Income/Expense, Vendor, Owner সব এক জায়গায় মিলে যাচ্ছে। সমাধান — ইনপুট পেজ অপরিবর্তিত রেখে **Data Bank-কে central source** বানানো, এবং সেখান থেকে কয়েকটি আলাদা **সেক্টর পেজ** তৈরি করা যেখানে প্রতিটি সেক্টর শুধু তার নিজের হিসাব দেখাবে।

## নতুন সেক্টর পেজ (Sidebar এ আলাদা link)

### ১. দৈনিক ইনকাম (Daily Income) — `/daily-income`
পুরা চন্দ্রা পরিবহনের ইনকাম একসাথে।
- ফিল্টার: তারিখ from-to / মাস / গাড়ি / ওনার
- কলাম: **তারিখ — গাড়ি নাম্বার — ভাড়া**
- নিচে: মোট ইনকাম

### ২. দৈনিক খরচ (Daily Expense) — `/daily-expense`
পুরা চন্দ্রা পরিবহনের খরচ একসাথে।
- ফিল্টার: তারিখ / মাস / গাড়ি / ওনার / ক্যাটাগরি / হেড
- কলাম: **তারিখ — হেড — খরচ**
- নিচে: মোট খরচ, **নেট = ইনকাম − খরচ**

### ৩. ওনার সেক্টর (Owner-wise) — `/owner-accounts`
- ওনার select → তার সব গাড়ি list
- প্রতি গাড়ির: তারিখ-ওয়াইজ ভাড়া (ইনকাম) ও খরচ (এক্সপেন্স head ধরে)
- summary: গাড়ি-ভিত্তিক জমা / খরচ / ব্যালেন্স
- grand total: ওনারের total জমা − total খরচ = ব্যালেন্স

### ৪. ভেন্ডর / থার্ড-পার্টি সেক্টর — `/vendors` (existing, refine)
চন্দ্রা পরিবহনের নামে আসা সব থার্ড-পার্টি হিসাব — Bank, পরিবহন বাকী, supplier ইত্যাদি (Data Manufacturer থেকে যোগ করা)।

**গুরুত্বপূর্ণ পরিবর্তন:** ভেন্ডর dropdown থেকে **owners বাদ** যাবে — ওনাররা শুধু Owner সেক্টরে থাকবে। ভেন্ডর শুধু Data Manufacturer থেকে যোগ করা extra entities।

- ভেন্ডর সার্চ/select → ঐ ভেন্ডরের সব income (পাওনা) ও expense (পরিশোধ) entry list
- কলাম: **তারিখ — গাড়ি নাম্বার (যদি থাকে) — পাওনা — পরিশোধ — ব্যালেন্স**
- প্রতি ভেন্ডরের running balance

### ৫. Data Bank (existing) — সব raw data + filter, audit-এর জন্য

## ইনপুট ফর্মে পরিবর্তন

Income/Expense ফর্মে Vendor field আছে। সেটা থাকবে, কিন্তু dropdown-এ:
- Owners বাদ
- শুধু Data Manufacturer-এ create করা vendors থাকবে
- entry-তে owner আসবে গাড়ি নাম্বার থেকে auto (vehicles.owner_id), আলাদা select লাগবে না

## টেকনিক্যাল বিবরণ

**নতুন routes:**
- `src/routes/daily-income.tsx`
- `src/routes/daily-expense.tsx`
- `src/routes/owner-accounts.tsx`

**Edit:**
- `src/routes/vendors.tsx` — owner-vendor merge logic বাদ, শুধু `entry_lookups (kind=vendor)` থেকে list
- `src/components/LookupSelect.tsx` (vendor kind) — owner names বাদ দেওয়া
- `src/routes/jama-khoroch.tsx` — vendor dropdown এ owner আসবে না
- `src/components/AppLayout.tsx` — sidebar এ ৩টা নতুন link যোগ
- `src/lib/i18n.tsx` — নতুন label

**Data source (no schema change needed):**
- Daily Income = `trips` table (fare_1 + fare_2 sum) + `other_incomes`
- Daily Expense = `expenses` table
- Owner accounts = trips/expenses/incomes join vehicles → owner_id group
- Vendor = expenses/other_incomes WHERE vendor IS NOT NULL group by vendor

কোনো database migration লাগবে না — পুরো কাজ presentation layer-এ।

## ফাইল list

**নতুন (৩):**
- `src/routes/daily-income.tsx`
- `src/routes/daily-expense.tsx`
- `src/routes/owner-accounts.tsx`

**Edit (৪):**
- `src/routes/vendors.tsx`
- `src/components/LookupSelect.tsx`
- `src/components/AppLayout.tsx`
- `src/lib/i18n.tsx`
