
## লক্ষ্য
সব পেচানো হিসাব বাদ। একটাই formula:
**ব্যালেন্স = (দৈনিক জমা + অন্যান্য জমা) − দৈনিক খরচ**

ডাটা manufacturer (daily-accounts, other-income, expenses) থেকেই আসবে। কোনো নতুন টেবিল না।

---

## ১. Dashboard
মূল পরিবহন কার্ড update:
- দৈনিক জমা মোট (trips.jama_1+jama_2)
- অন্যান্য জমা মোট (other_incomes.amount)
- দৈনিক খরচ মোট (expenses.amount)
- **ব্যালেন্স = (দৈনিক জমা + অন্যান্য জমা) − দৈনিক খরচ**

---

## ২. Reports পেজ
উপরের summary cards হবে:
- দৈনিক জমা | অন্যান্য জমা | দৈনিক খরচ | **ব্যালেন্স**
- গাড়ি ভাড়া আলাদা card (শুধু trips.fare যোগফল — তথ্যের জন্য)

ট্যাব আগের মতই (Trips / Expenses / Other Income) — শুধু footer summary নতুন formula।
Search filter (date, vehicle, owner) আগের মতই থাকবে।

---

## ৩. Data Bank
Default view = মূল পরিবহন