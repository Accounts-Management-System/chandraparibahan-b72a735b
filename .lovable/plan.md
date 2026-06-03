# পরিকল্পনা

## ১. ভেন্ডর/ইনকাম/এক্সপেন্স এন্ট্রিতে Owner Tag বাধ্যতামূলক

- **Other Income (`other-income.tsx`)** ও **Expense (`expenses.tsx`)** ফর্মে **Owner** ড্রপডাউন যোগ — সব ওনারের লিস্ট (Chandra সহ)। বর্তমানে `owner_id` কলাম আছে কিন্তু UI-তে select নেই।
- প্রতিটি ইনকাম/এক্সপেন্স এন্ট্রি এখন একটা owner-এর সাথে যুক্ত হবে (Chandra = পরিবহনের নিজস্ব হিসাব)।
- vehicle_no সিলেক্ট করলে অটো-fill: সেই গাড়ির owner_id বসবে (override করা যাবে)।

## ২. Reports পেজ — শুধু পরিবহন (Chandra)

- Reports query-গুলোতে filter বসবে: `owner_id = Chandra owner id` (অথবা NULL fallback)।
- Trips, Other Incomes, Expenses — তিনটাই Chandra-owned vehicle/entries-এ সীমাবদ্ধ।
- ভেন্ডর জমা/খরচ যোগ-বিয়োগ করে Chandra-র net ব্যালেন্স।
- কোনো অন্য ওনারের ডাটা এখানে আসবে না।

## ৩. Owner Accounts — ভেন্ডরসহ owner-wise হিসাব

- Owner সিলেক্ট করলে দেখাবে:
  - **ইনকাম**: সেই owner-এর গাড়ির trips (fare_1+2) + other_incomes (owner_id match)
  - **এক্সপেন্স**: সেই owner-এর গাড়ির expenses + vendor expenses (owner_id match)
  - **ভেন্ডর সেকশন**: vendor-wise breakdown (জমা − খরচ = বাকি) — শুধু সেই owner-এর
  - **Balance** = মোট ইনকাম − মোট এক্সপেন্স

## ৪. Vendors পেজে Owner ফিল্টার

- Top-এ Owner dropdown (All / Chandra / অন্য ওনার): সিলেক্ট করলে শুধু সেই owner-এর ভেন্ডর entry গুলো aggregate হবে।

## ৫. Daily Income / Daily Expense

- একই owner ফিল্টার যোগ — এখন owner দিয়ে সঠিকভাবে scoping হবে (vehicle ow