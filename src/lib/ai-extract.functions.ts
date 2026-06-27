import { createServerFn } from "@tanstack/react-start";

type Target = "trips" | "expenses";

const SCHEMAS: Record<Target, { columns: { name: string; type: "string" | "number" | "date"; desc: string }[]; instructions: string }> = {
  trips: {
    columns: [
      { name: "trip_date", type: "date", desc: "YYYY-MM-DD তারিখ" },
      { name: "vehicle_no", type: "string", desc: "গাড়ীর নম্বর" },
      { name: "route_1", type: "string", desc: "প্রথম ট্রিপের রুট" },
      { name: "jama_1", type: "number", desc: "প্রথম ট্রিপের জমা" },
      { name: "dena_1", type: "number", desc: "প্রথম ট্রিপের দেনা/খরচ" },
      { name: "fare_1", type: "number", desc: "প্রথম ট্রিপের ভাড়া" },
      { name: "route_2", type: "string", desc: "দ্বিতীয় ট্রিপের রুট" },
      { name: "jama_2", type: "number", desc: "দ্বিতীয় ট্রিপের জমা" },
      { name: "dena_2", type: "number", desc: "দ্বিতীয় ট্রিপের দেনা" },
      { name: "fare_2", type: "number", desc: "দ্বিতীয় ট্রিপের ভাড়া" },
      { name: "supervisor", type: "string", desc: "সুপারভাইজার / চালকের নাম" },
    ],
    instructions:
      "ছবিটি একটি দৈনিক জমা/হিসাব কাগজ। প্রতিটি গাড়ী/সারির জন্য আলাদা row দাও। বাংলা সংখ্যাকে ইংরেজি ডিজিটে রূপান্তর কর। যা পাওয়া যাবে না তা null দাও।",
  },
  expenses: {
    columns: [
      { name: "expense_date", type: "date", desc: "YYYY-MM-DD তারিখ" },
      { name: "vehicle_no", type: "string", desc: "গাড়ীর নম্বর (যদি থাকে)" },
      { name: "category", type: "string", desc: "ক্যাটাগরি (যেমন তেল, মেরামত, বেতন)" },
      { name: "head", type: "string", desc: "খরচের হেড / উপশ্রেণী" },
      { name: "description", type: "string", desc: "বিবরণ / নোট" },
      { name: "vendor", type: "string", desc: "ভেন্ডর / প্রাপক" },
      { name: "amount", type: "number", desc: "টাকার পরিমাণ" },
    ],
    instructions:
      "ছবিটি একটি খরচ/ভাউচার কাগজ। প্রতিটি আলাদা খরচের জন্য আলাদা row দাও। বাংলা সংখ্যাকে ইংরেজি ডিজিটে রূপান্তর কর। category না থাকলে 'অন্যান্য' দাও।",
  },
};

export const extractRowsFromImage = createServerFn({ method: "POST" })
  .inputValidator((d: { imageDataUrl: string; target: Target }) => d)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const schema = SCHEMAS[data.target];
    if (!schema) throw new Error("Invalid target");

    const colList = schema.columns
      .map((c) => `- ${c.name} (${c.type}): ${c.desc}`)
      .join("\n");

    const systemPrompt = `তুমি একজন OCR + ডাটা এক্সট্রাকশন এজেন্ট। ছবি থেকে নিচের কলামগুলো বের করে JSON দিবে।

কলামসমূহ:
${colList}

${schema.instructions}

কঠোর JSON format দিবে (অন্য কোনো লেখা না):
{"rows":[ { "${schema.columns[0].name}": "...", ... }, ... ]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: "এই ছবি থেকে সমস্ত row বের কর।" },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("AI rate limit. একটু পরে আবার চেষ্টা করুন।");
      if (res.status === 402) throw new Error("AI credits শেষ। কর্মস্থলে credit যোগ করুন।");
      throw new Error(`AI error ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try {
      parsed = typeof content === "string" ? JSON.parse(content) : content;
    } catch {
      parsed = { rows: [] };
    }
    const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
    // normalize: keep only known columns
    const allowed = new Set(schema.columns.map((c) => c.name));
    const cleaned = rows.map((r: any) => {
      const out: Record<string, any> = {};
      for (const c of schema.columns) {
        let v = r?.[c.name];
        if (v === undefined || v === null || v === "") {
          out[c.name] = c.type === "number" ? 0 : "";
          continue;
        }
        if (c.type === "number") {
          const n = Number(String(v).replace(/[^\d.-]/g, ""));
          out[c.name] = isNaN(n) ? 0 : n;
        } else {
          out[c.name] = String(v);
        }
      }
      // unknown keys ignored
      void allowed;
      return out;
  });

export const extractColumnFromImage = createServerFn({ method: "POST" })
  .inputValidator((d: { imageDataUrl: string; target: Target; column: string }) => d)
  .handler(async ({ data }) => {
    const key = process.env.LOVABLE_API_KEY;
    if (!key) throw new Error("LOVABLE_API_KEY not configured");
    const schema = SCHEMAS[data.target];
    if (!schema) throw new Error("Invalid target");
    const col = schema.columns.find((c) => c.name === data.column);
    if (!col) throw new Error("Invalid column");

    const systemPrompt = `তুমি একজন OCR এজেন্ট। ছবি থেকে শুধুমাত্র "${col.name}" (${col.desc}) এর মান গুলো বের কর। উপর থেকে নিচ ক্রমে যত গুলো মান আছে সব দাও। বাংলা সংখ্যাকে ইংরেজি ডিজিটে রূপান্তর কর।

কঠোর JSON format দিবে:
{"values": ["...", "...", ...]}`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: [
              { type: "text", text: `এই ছবি থেকে শুধু "${col.name}" কলামের মান গুলো বের কর।` },
              { type: "image_url", image_url: { url: data.imageDataUrl } },
            ],
          },
        ],
        response_format: { type: "json_object" },
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      if (res.status === 429) throw new Error("AI rate limit।");
      if (res.status === 402) throw new Error("AI credits শেষ।");
      throw new Error(`AI error ${res.status}: ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    const content = json.choices?.[0]?.message?.content ?? "{}";
    let parsed: any = {};
    try { parsed = typeof content === "string" ? JSON.parse(content) : content; } catch { parsed = { values: [] }; }
    const raw = Array.isArray(parsed.values) ? parsed.values : [];
    const values = raw.map((v: any) => {
      if (v === null || v === undefined) return col.type === "number" ? 0 : "";
      if (col.type === "number") {
        const n = Number(String(v).replace(/[^\d.-]/g, ""));
        return isNaN(n) ? 0 : n;
      }
      return String(v);
    });
    return { column: col, values };
  });
    return { rows: cleaned, columns: schema.columns };
  });
