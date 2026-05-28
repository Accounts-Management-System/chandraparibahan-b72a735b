import React, { createContext, useContext, useEffect, useState } from "react";

type Lang = "bn" | "en";

const dict = {
  brand: { bn: "চন্দ্রা পরিবহন", en: "Chandra Paribahan" },
  tagline: { bn: "ব্যবস্থাপনা সিস্টেম", en: "Management System" },
  login: { bn: "লগইন", en: "Login" },
  logout: { bn: "লগআউট", en: "Logout" },
  email: { bn: "ইমেইল", en: "Email" },
  password: { bn: "পাসওয়ার্ড", en: "Password" },
  signup: { bn: "নতুন অ্যাকাউন্ট", en: "Sign up" },
  loginForm: { bn: "চন্দ্রা পরিবহন লগইন ফর্ম", en: "Chandra Paribahan Login Form" },
  dashboard: { bn: "ড্যাশবোর্ড", en: "Dashboard" },
  dailyAccounts: { bn: "দৈনিক জমা হিসাব", en: "Daily Accounts" },
  expenses: { bn: "দৈনিক খরচ", en: "Daily Expenses" },
  otherIncome: { bn: "অন্যান্য জমা", en: "Other Income" },
  vehicles: { bn: "গাড়ী", en: "Vehicles" },
  contacts: { bn: "যোগাযোগ", en: "Contacts" },
  dataBank: { bn: "ডাটা ব্যাংক", en: "Data Bank" },
  reports: { bn: "রিপোর্ট", en: "Reports" },
  individual: { bn: "ব্যক্তিগত", en: "Individual" },
  company: { bn: "কোম্পানি", en: "Company" },
  rental: { bn: "ভাড়া", en: "Rental" },
  vendor: { bn: "ভেন্ডর", en: "Vendor" },
  owner: { bn: "মালিক", en: "Owner" },
  helper: { bn: "সহকারী", en: "Helper" },
  partner: { bn: "অংশীদার", en: "Partner" },
  dada_bhai: { bn: "দাদা ভাই", en: "Dada Bhai" },
  mejho_bhai: { bn: "মেঝো ভাই", en: "Mejho Bhai" },
  choto_bhai: { bn: "ছোট ভাই", en: "Choto Bhai" },
  bordidi: { bn: "বড় দিদি", en: "Bor Didi" },
  mejhdidi: { bn: "মেঝো দিদি", en: "Mejh Didi" },
  date: { bn: "তারিখ", en: "Date" },
  vehicleNo: { bn: "গাড়ী নাম্বার", en: "Vehicle No" },
  jama1: { bn: "জমা-১", en: "Deposit-1" },
  jama2: { bn: "জমা-২", en: "Deposit-2" },
  dena1: { bn: "দেনা-১", en: "Debt-1" },
  dena2: { bn: "দেনা-২", en: "Debt-2" },
  fare1: { bn: "ভাড়া (রুট ১)", en: "Fare (Route 1)" },
  fare2: { bn: "ভাড়া (রুট ২)", en: "Fare (Route 2)" },
  route1: { bn: "রুট ১", en: "Route 1" },
  route2: { bn: "রুট ২", en: "Route 2" },
  route: { bn: "রুট", en: "Route" },
  routes: { bn: "রুটসমূহ", en: "Routes" },
  routeName: { bn: "রুটের নাম", en: "Route name" },
  fare: { bn: "ভাড়া", en: "Fare" },
  addRoute: { bn: "রুট যোগ করুন", en: "Add route" },
  serial: { bn: "সিরিয়াল", en: "Serial" },
  balance: { bn: "ব্যালেন্স", en: "Balance" },
  jamaTotal: { bn: "জমা টাকা", en: "Deposit" },
  denaTotal: { bn: "দেনা টাকা", en: "Debt" },
  fareTotal: { bn: "মোট ভাড়া", en: "Total Fare" },
  supervisor: { bn: "সুপারভাইজার", en: "Supervisor" },
  category: { bn: "খাত", en: "Category" },
  amount: { bn: "পরিমান", en: "Amount" },
  name: { bn: "নাম", en: "Name" },
  phone: { bn: "ফোন", en: "Phone" },
  address: { bn: "ঠিকানা", en: "Address" },
  type: { bn: "ধরন", en: "Type" },
  save: { bn: "সংরক্ষণ", en: "Save" },
  add: { bn: "যোগ করুন", en: "Add" },
  edit: { bn: "সম্পাদনা", en: "Edit" },
  delete: { bn: "মুছুন", en: "Delete" },
  cancel: { bn: "বাতিল", en: "Cancel" },
  search: { bn: "অনুসন্ধান", en: "Search" },
  filter: { bn: "ফিল্টার", en: "Filter" },
  all: { bn: "সব", en: "All" },
  total: { bn: "মোট", en: "Total" },
  actions: { bn: "ক্রিয়া", en: "Actions" },
  from: { bn: "থেকে", en: "From" },
  to: { bn: "পর্যন্ত", en: "To" },
  apply: { bn: "প্রয়োগ", en: "Apply" },
  exportCsv: { bn: "CSV এক্সপোর্ট", en: "Export CSV" },
  print: { bn: "প্রিন্ট", en: "Print" },
  loading: { bn: "লোড হচ্ছে...", en: "Loading..." },
  noData: { bn: "কোন তথ্য নেই", en: "No data" },
  confirmDelete: { bn: "আপনি কি নিশ্চিত মুছে ফেলতে চান?", en: "Are you sure you want to delete?" },
  saved: { bn: "সংরক্ষিত হয়েছে", en: "Saved" },
  deleted: { bn: "মুছে ফেলা হয়েছে", en: "Deleted" },
  income: { bn: "আয়", en: "Income" },
  expense: { bn: "ব্যয়", en: "Expense" },
  net: { bn: "নিট", en: "Net" },
  todaysSummary: { bn: "আজকের সারাংশ", en: "Today's Summary" },
  recentTrips: { bn: "সাম্প্রতিক ট্রিপ", en: "Recent Trips" },
  totalJama: { bn: "মোট জমা", en: "Total Deposit" },
  tripCount: { bn: "ট্রিপ সংখ্যা", en: "Trip Count" },
  selectVehicle: { bn: "গাড়ী নির্বাচন", en: "Select vehicle" },
  allVehicles: { bn: "সব গাড়ী", en: "All vehicles" },
  selectRoute: { bn: "রুট নির্বাচন", en: "Select route" },
  quickEntry: { bn: "দ্রুত এন্ট্রি", en: "Quick Entry" },
  overview: { bn: "সারাংশ", en: "Overview" },
  enterAmount: { bn: "পরিমান লিখুন", en: "Enter amount" },
  enterCategory: { bn: "খাত", en: "Category" },
  submit: { bn: "সাবমিট", en: "Submit" },
  update: { bn: "আপডেট", en: "Update" },
  clearForm: { bn: "ফরম ক্লিয়ার", en: "Clear Form" },
  vehicleInfo: { bn: "গাড়ী তথ্য", en: "Vehicle Info" },
  addRouteSection: { bn: "রুট যোগ করুন", en: "Add Route" },
  head: { bn: "খরচ খাত", en: "Head" },
  description: { bn: "বিবরন", en: "Description" },
  dataManufacturer: { bn: "ডাটা ম্যানুফ্যাকচার", en: "Data Manufacturer" },
  manage: { bn: "ব্যবস্থাপনা", en: "Manage" },
  value: { bn: "মান", en: "Value" },
  selectOrType: { bn: "নির্বাচন বা টাইপ করুন", en: "Select or type" },
  shareholders: { bn: "শেয়ারহোল্ডার", en: "Shareholders" },
  shareholder: { bn: "শেয়ারহোল্ডার", en: "Shareholder" },
  admin: { bn: "এডমিন", en: "Admin" },
  moderator: { bn: "মডারেটর", en: "Moderator" },
  loginId: { bn: "লগইন আইডি", en: "Login ID" },
  pin: { bn: "পিন", en: "PIN" },
  whatsapp: { bn: "হোয়াটসঅ্যাপ", en: "WhatsApp" },
  active: { bn: "একটিভ", en: "Active" },
  inactive: { bn: "নিস্ক্রিয়", en: "Inactive" },
  viewData: { bn: "ডাটা দেখুন", en: "View Data" },
  resetPin: { bn: "পিন রিসেট", en: "Reset PIN" },
  newPin: { bn: "নতুন পিন", en: "New PIN" },
  createModerator: { bn: "মডারেটর তৈরি", en: "Create Moderator" },
  diary: { bn: "ডায়েরি", en: "Diary" },
  myDiary: { bn: "আমার ডায়েরি", en: "My Diary" },
  title: { bn: "শিরোনাম", en: "Title" },
  content: { bn: "বিবরণ", en: "Content" },
  jamaKhoroch: { bn: "জমা-খরচ", en: "Income-Expense" },
  jama: { bn: "জমা", en: "Income" },
  khoroch: { bn: "খরচ", en: "Expense" },
  addJama: { bn: "জমা যোগ", en: "Add Income" },
  addExpense: { bn: "খরচ যোগ", en: "Add Expense" },
  searchByMonth: { bn: "মাস দিয়ে সার্চ", en: "Search by Month" },
  searchByCar: { bn: "গাড়ী দিয়ে সার্চ", en: "Search by Car" },
  searchByShareholder: { bn: "শেয়ারহোল্ডার দিয়ে সার্চ", en: "Search by Shareholder" },
  guestReadOnly: { bn: "গেস্ট মোড (শুধু দেখা)", en: "Guest mode (read only)" },
  yourId: { bn: "আপনার আইডি", en: "Your ID" },
  pinSet: { bn: "পিন/পাসওয়ার্ড সেট করা হয়েছে", en: "PIN updated" },
  noLogin: { bn: "এখনো লগইন তৈরি হয়নি", en: "No login yet" },
  createLogin: { bn: "লগইন তৈরি", en: "Create Login" },
  loggedIn: { bn: "লগইন করা আছে", en: "Logged in" },
  loginSuccess: { bn: "লগইন সফল হয়েছে", en: "Login successful" },
  signupCheckEmail: { bn: "অ্যাকাউন্ট তৈরি হয়েছে। ইমেইল কনফার্ম করুন।", en: "Account created. Please confirm your email." },
  owners: { bn: "ওনার / মালিক", en: "Owners" },
  dynamicDropdown: { bn: "ডায়নামিক ড্রপডাউন", en: "Dynamic Dropdown" },
  headsHint: { bn: "একাধিক নাম: এক লাইনে একটি বা কমা দিয়ে আলাদা করুন", en: "Multiple names: one per line or comma separated" },
  searchByOwner: { bn: "ওনার দিয়ে সার্চ", en: "Search by Owner" },
  searchByDate: { bn: "তারিখ দিয়ে সার্চ", en: "Search by Date" },
  searchByDateRange: { bn: "তারিখ রেঞ্জ দিয়ে সার্চ", en: "Search by Date Range" },
  searchByVehicle: { bn: "গাড়ী দিয়ে সার্চ", en: "Search by Vehicle" },
  searchByCategory: { bn: "ক্যাটাগরি দিয়ে সার্চ", en: "Search by Category" },
  vehicleFare: { bn: "গাড়ী ভাড়া", en: "Vehicle Fare" },
  totalAmount: { bn: "মোট পরিমাণ", en: "Total Amount" },
} as const;

type Key = keyof typeof dict;

const LangCtx = createContext<{ lang: Lang; setLang: (l: Lang) => void; t: (k: Key) => string }>({
  lang: "bn",
  setLang: () => {},
  t: (k) => k,
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>("bn");
  useEffect(() => {
    const saved = (typeof window !== "undefined" && (localStorage.getItem("lang") as Lang)) || "bn";
    setLangState(saved);
  }, []);
  const setLang = (l: Lang) => {
    setLangState(l);
    if (typeof window !== "undefined") localStorage.setItem("lang", l);
  };
  const t = (k: Key) => (dict[k] ? dict[k][lang] : (k as string));
  return <LangCtx.Provider value={{ lang, setLang, t }}>{children}</LangCtx.Provider>;
}

export function useT() {
  return useContext(LangCtx);
}

const bnDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
export function toBnDigits(input: string | number): string {
  return String(input).replace(/[0-9]/g, (d) => bnDigits[+d]);
}
export function fmtNum(n: number | string | null | undefined, lang: Lang): string {
  if (n === null || n === undefined || n === "") return "-";
  const num = Number(n);
  if (Number.isNaN(num)) return "-";
  const s = num.toLocaleString("en-US", { maximumFractionDigits: 2 });
  return lang === "bn" ? toBnDigits(s) : s;
}
export function fmtDate(d: string | Date | null | undefined, lang: Lang): string {
  if (!d) return "-";
  const date = typeof d === "string" ? new Date(d) : d;
  const s = date.toLocaleDateString("en-GB");
  return lang === "bn" ? toBnDigits(s) : s;
}
