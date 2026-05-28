
## পরিবর্তনের সারাংশ

আপনার অনুরোধে অনেকগুলো বড় ফিচার আছে। আমি সেগুলো ৬টা ধাপে ভাগ করে বানাবো।

---

### ধাপ ১ — ডেইলি একাউন্ট থেকে রুট বাদ
- Daily Accounts এন্ট্রি ফরম থেকে "রুট" দেখানো বাদ যাবে (ভাড়া ১+২ যোগ ফল এখনো ম্যাচ হয়ে ব্যাকগ্রাউন্ডে route_1 হিসেবে সেভ হবে, কিন্তু UI তে দেখাবে না)
- Data Bank এ চাইলে রুট কলাম রাখা যাবে (আপনি বললে বাদ দেবো)

---

### ধাপ ২ — Shareholders পেইজ (পুরাতন Contacts রিপ্লেস)
- `/contacts` → `/shareholders` রিনেম
- প্রতি শেয়ারহোল্ডারের ফিল্ড: নাম, মোবাইল/WhatsApp, ঠিকানা, **Login ID, PIN (৪-৬ ডিজিট), স্ট্যাটাস (active/blocked)**
- Admin "Add Shareholder" করলে ID + PIN সেট করে দিবে
- প্রতি শেয়ারহোল্ডারের সাথে এক বা একাধিক গাড়ী লিঙ্ক করা যাবে (vehicle.owner_name এর জায়গায় shareholder_id)
- লিস্টে প্রত্যেক শেয়ারহোল্ডারের নামের পাশে "View Data" বাটন — ক্লিক করলে শুধু তার গাড়ীর Data Bank খুলবে

---

### ধাপ ৩ — Auth & Role সিস্টেম
- নতুন টেবিল: `app_users` (admin / moderator / shareholder), `user_roles` enum
- **Admin/Moderator**: বর্তমান Supabase email-password auth দিয়েই লগইন (এডমিন ম্যানুয়ালি Admin পেইজ থেকে moderator তৈরি করবে — ID + PIN)
- **Shareholder Guest লগইন**: আলাদা একটা লগইন স্ক্রীন (Login ID + PIN দিয়ে) — সফল হলে read-only মোডে পুরা সাইট দেখতে পারবে, কিন্তু:
  - কোনো Add/Edit/Delete বাটন দেখবে না (UI level + RLS দুই জায়গায় ব্লক)
  - শুধু নিজের shareholder_id এর সাথে লিঙ্ক করা ডাটা দেখবে
- **PIN পরিবর্তন**: শেয়ারহোল্ডার নিজের মোবাইলে OTP confirmation পেয়ে PIN বদলাতে পারবে
  - **SMS/WhatsApp গেটওয়ে দরকার** — আপনি কোনটা ব্যবহার করতে চান বলবেন? (Twilio / MSG91 / UAZAPI — API key লাগবে)

---

### ধাপ ৪ — Admin পেইজ (admin-only)
- `/admin` — শুধু admin রোলের জন্য
- সাব-সেকশন:
  1. **Moderator Manage**: ID + PIN দিয়ে নতুন moderator তৈরি/মুছে ফেলা
  2. **My Diary**: ব্যক্তিগত নোট রাখার জায়গা (টাইটেল, কন্টেন্ট, তারিখ) — শুধু এডমিন দেখবে

---

### ধাপ ৫ — জমা-খরচ পেইজ (নতুন accounting view)
- নতুন রুট `/jama-khoroch` — দুই ট্যাব:
  - **জমা ট্যাব**: তারিখ — গাড়ী নাম্বার/বিবরন — পরিমান। "Add জমা" বাটন (admin/moderator only)। গাড়ী নাম্বার দিলে অটো sync হবে vehicles টেবিলের সাথে
  - **খরচ ট্যাব**: তারিখ — খরচ খাত — বিবরন — পরিমান। "Add Expense" বাটন
- উপরে summary: মোট জমা, মোট খরচ, ব্যালেন্স
- (নোট: এটা existing `expenses`/`other_incomes` থেকে আলাদা ভিউ হবে নাকি ওগুলোকেই reuse করবো? — আমার পরামর্শ: existing টেবিলই reuse করি, শুধু নতুন combined view পেইজ)

---

### ধাপ ৬ — Data Bank আপডেট
- গাড়ী নাম্বারের পরে নতুন কলাম: **মালিক/শেয়ারহোল্ডার নাম** (vehicle → shareholder এর join থেকে)
- উপরে সার্চ বার এক্সপান্ড:
  - তারিখ দিয়ে (একটা তারিখ)
  - মাস দিয়ে (month picker)
  - গাড়ী নাম্বার দিয়ে
  - শেয়ারহোল্ডারের নাম দিয়ে (এক/একাধিক গাড়ীর সব ডাটা একসাথে)

---

## আমার ৩টা প্রশ্ন (এগুলোর উত্তর দিন, তাহলে কাজ শুরু করি):

1. **PIN পরিবর্তনের জন্য SMS/WhatsApp**: এখনি বানাবো নাকি প্রথমে শুধু admin manually PIN reset করার ব্যবস্থা রাখবো? (গেটওয়ে integrate করতে API key দরকার)
2. **জমা-খরচ পেইজ**: existing `expenses` + `other_incomes` টেবিলের ডাটা দেখাবে (নতুন combined view), নাকি একদম আলাদা নতুন টেবিল চান?
3. **Shareholder guest login**: তারা যখন লগইন করবে, তারা কি sidebar এর সব মেনু দেখবে (read-only) নাকি শুধু নির্দিষ্ট কিছু পেইজ (Dashboard, Data Bank, নিজের shareholder page)?

উত্তর দিলে ধাপে ধাপে বাস্তবায়ন শুরু করবো — প্রথমে database migration + auth roles, তারপর UI।
