# পরিবর্তনের পরিকল্পনা

## ১. Data Manufacturer — Dynamic Dropdown (Category → Heads)

বর্তমান `entry_lookups` table তিন আলাদা list রাখে (category/head/description), কিন্তু কোনো সম্পর্ক নেই। নতুন structure:

- নতুন table `expense_categories` (id, name)
- নতুন table `expense_heads` (id, category_id, name) — এক category-র অধীনে একাধিক head
- Admin Data Manufacturer পেজে:
  - বাঁ কলাম: Category list (Add/Delete)
  - ডান কলাম: নির্বাচিত category-র Heads (Add/Delete, multiple একসাথে comma/newline দিয়ে paste করা যাবে)
- Expense/Other Income ফর্মে:
  - Category dropdown → পরিবর্তন হলে Head dropdown filter হয়
  - Description optional text
  - Amount

উদাহরণ: Category "বেতন" → Heads: "করিম", "রহিম", "সালাম" … → optional বিবরণ → পরিমাণ।

## ২. Owners (Shareholder এর জায়গায় গ্রুপিং)

- নতুন table `owners` (id, name, phone, notes)
- `vehicles` table-এ `owner_id` যোগ (এক owner-র একাধিক গাড়ি)
- নতুন route `/owners` — Owner Add/Edit/Delete + সেই owner-র গাড়িগুলোর তালিকা
- Vehicles পেজে Owner dropdown (গাড়ি assign)
- Expense / Other Income ফর্মে নতুন **Owner** dropdown (vehicle no এর পাশে / আগে) — owner select করলে সেই owner-র গাড়িগুলো filter হয়ে আসবে
- পুরনো `contacts` (shareholder) navigation থেকে সরিয়ে দেয়া হবে (table রাখা থাকবে data না হারানোর জন্য, কিন্তু sidebar এ আর দেখাবে না)

## ৩. Data Bank — সব কলাম

- Expense rows: তারিখ, ওনার, গাড়ি নং, ক্যাটাগরি, হেড, বিবরণ, পরিমাণ
- Other Income rows: একইভাবে সব কলাম
- বর্তমান summarized view-র জায়গায় বিস্তারিত table (search/filter সহ — তারিখ, owner, গাড়ি)

## টেকনিক্যাল বিবরণ

**Migration:**
```sql
CREATE TABLE owners (id, name, phone, notes, timestamps);
ALTER TABLE vehicles ADD COLUMN owner_id uuid REFERENCES owners(id);
CREATE TABLE expense_categories (id, name unique, timestamps);
CREATE TABLE expense_heads (id, category_id REFERENCES expense_categories, name, timestamps);
-- GRANTS + RLS (read all auth, write admin/moderator)
```

**Files to edit:**
- `supabase/migrations/...` — owners, expense_categories, expense_heads
- `src/routes/data-manufacturer.tsx` — দুই-কলাম Category/Head UI
- `src/routes/owners.tsx` (new) — Owner management
- `src/routes/vehicles.tsx` — Owner dropdown যোগ
- `src/routes/expenses.tsx` — Category→Head cascade + Owner dropdown
- `src/routes/other-income.tsx` — একই pattern
- `src/routes/data-bank.tsx` — সব কলাম সহ full table
- `src/components/AppLayout.tsx` — sidebar এ Owners যোগ, Shareholder সরানো
- `src/lib/i18n.tsx` — নতুন label
- `src/components/LookupSelect.tsx` — category/head এর জন্য নতুন CascadingSelect বানানো (পুরনোটা description এর জন্য থাকবে)

পুরনো `entry_lookups` table থাকছে (description এর জন্য use হবে)।
