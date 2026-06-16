## লক্ষ্য

অ্যাপটি অফলাইনে চলবে — Trips, Expenses, Other Income সহ সব এন্ট্রি পেইজে ডাটা এন্ট্রি করা যাবে, পুরাতন ডাটা ক্যাশ থেকে দেখা যাবে, এবং ইন্টারনেট ফিরলে অফলাইনে জমা হওয়া এন্ট্রি স্বয়ংক্রিয়ভাবে নির্দিষ্ট টেবিলে সিঙ্ক হবে। কনফ্লিক্ট হলে শেষ এন্ট্রি জিতবে।

## ব্যবহারকারীর অভিজ্ঞতা

- ইন্টারনেট না থাকলেও অ্যাপ খোলা যাবে (হোম স্ক্রিনে ইনস্টলযোগ্য PWA)
- উপরে একটি ছোট ইন্ডিকেটর: `অনলাইন` / `অফলাইন (N pending)`
- অফলাইনে সেভ করলে টোস্ট: "অফলাইনে সেভ হয়েছে, নেটওয়ার্ক এলে সিঙ্ক হবে"
- নেট এলে অটোমেটিক ব্যাকগ্রাউন্ডে সিঙ্ক + টোস্ট: "N টি এন্ট্রি সিঙ্ক হয়েছে"
- ব্যর্থ সিঙ্ক হলে সেই এন্ট্রি Pending থাকবে, পরবর্তী চেষ্টায় আবার যাবে

## কী যুক্ত হবে

### ১. PWA / Service Worker
- `vite-plugin-pwa` যোগ — অ্যাপ শেল ক্যাশ, অফলাইনে লোড
- প্রিভিউ/ডেভে service worker বন্ধ (Lovable preview-safe)
- পাবলিশ করা সাইটেই কাজ করবে

### ২. ডাটা ক্যাশ (পড়া)
- React Query এর জন্য IndexedDB persister
- সব select queries (trips, expenses, other_incomes, owners, vehicles, lookups ইত্যাদি) লোকালি ক্যাশ হবে
- অফলাইনে পেইজ খুললে ক্যাশ থেকে দেখাবে

### ৩. মিউটেশন কিউ (লেখা)
- নতুন helper: `queueOrRun(table, payload, op)` 
- অনলাইন → সরাসরি supabase insert/update/delete
- অফলাইন → IndexedDB এর `pending_mutations` স্টোরে জমা, UI তে optimistic update
- প্রভাবিত পেইজ: Daily Accounts (trips), Daily Expense (expenses), Other Income, Jama-Khoroch, Owners, Vehicles, Routes, Vendors, Contacts, Admin Diary, Data Bank

### ৪. অটো-সিঙ্ক
- `navigator.onLine` + `online` event লিসেনার
- অনলাইন হলে queue FIFO ক্রমে drain — প্রতিটি mutation আসল টেবিলে যাবে
- সফল হলে queue থেকে মুছবে, React Query invalidate
- ব্যর্থ হলে retry count বাড়িয়ে রাখবে, পরে আবার

### ৫. কনফ্লিক্ট রেজোলিউশন
- শেষ লেখা জিতবে (Supabase server timestamp ভিত্তিক) — কোনো বিশেষ merge logic না, সাধারণ upsert/update

## টেকনিক্যাল ডিটেইল

```text
src/
├── lib/
│   ├── offline/
│   │   ├── db.ts              # idb (IndexedDB) wrapper, stores: pending_mutations
│   │   ├── queue.ts           # enqueue/drain/retry logic
│   │   ├── sync.ts            # online listener + drain trigger
│   │   ├── persister.ts       # React Query IDB persister
│   │   └── useOnline.ts       # hook for status
│   └── data/
│       └── mutate.ts          # queueOrRun(table, op, payload) helper
├── components/
│   └── OfflineIndicator.tsx   # top bar chip
└── routes/__root.tsx          # mount persister + sync + indicator
```

- প্যাকেজ: `idb`, `@tanstack/react-query-persist-client`, `@tanstack/query-async-storage-persister`, `vite-plugin-pwa`
- Vite PWA: `registerType: "autoUpdate"`, navigation `NetworkFirst`, preview/iframe/dev এ register বন্ধ
- সব existing `supabase.from(...).insert/update/delete` কল গুলো `mutate.ts` helper দিয়ে রিপ্লেস
- ID generation: অফলাইন insert এর জন্য client-side `crypto.randomUUID()` ব্যবহার (যেসব টেবিলে uuid PK)
- Trips এর `serial_no` ট্রিগার সার্ভারে আছে — অফলাইনে temporary serial, সিঙ্কের সময় সার্ভার ঠিক করবে (insert এ serial_no পাঠাব না)

## সীমাবদ্ধতা (জানিয়ে রাখা)

- অফলাইনে নতুন রেকর্ড দেখাবে কিন্তু server-generated fields (auto serial) সিঙ্কের পর আপডেট হবে
- File/image আপলোড অফলাইনে সাপোর্ট হবে না (এই অ্যাপে নেই, তাই সমস্যা না)
- প্রথমবার অ্যাপ অফলাইনে চালাতে হলে একবার অনলাইনে খুলে নিতে হবে (অ্যাপ শেল ও ডাটা ক্যাশ করার জন্য)
- iOS Safari এ PWA install করতে "Add to Home Screen" দিতে হবে

অনুমোদন দিলে কাজ শুরু করছি।