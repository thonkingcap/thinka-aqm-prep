// Lesson 2: Introduction to spreadsheets (Wed 2 Sep). Cells, arrays, formulae, filling, and the counting /
// summing functions, from "Lesson 2, notes on the fly", "Lesson 2, data" (red questions), "Lesson 2, exercise"
// and "Homework 2, solutions".
import { Sheet, int, pick, shuffle, round, TOP, abs, type BlockMaker, type Block, type Part, type Rng, type Trap } from "./kit.ts";
import type { Lesson } from "./types.ts";

/** Drop traps that equal the right answer (or come too close to it). */
const keep = (answer: number, traps: Trap[], tol = 0) =>
  traps.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - answer) > Math.max(tol * 1.5, 1e-9));
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);
const mean = (xs: number[]) => sum(xs) / xs.length;

// ---------- Q1: purchase orders (mirrors the red questions in "Lesson 2, data › Purchase Orders") ----------
type Item = { name: string; qlo: number; qhi: number; step: number; plo: number; phi: number };
const ITEMS: Item[] = [
  { name: "Airframe fasteners", qlo: 8000, qhi: 20000, step: 500, plo: 4.1, phi: 4.4 },
  { name: "Shielded cable/ft.", qlo: 14000, qhi: 25000, step: 500, plo: 0.95, phi: 1.15 },
  { name: "Bolt-nut package", qlo: 3800, qhi: 5000, step: 50, plo: 3.4, phi: 3.8 },
  { name: "O-ring", qlo: 900, qhi: 2500, step: 50, plo: 2.4, phi: 3.0 },
  { name: "Gasket", qlo: 1200, qhi: 2000, step: 10, plo: 3.6, phi: 4.1 },
  { name: "Pressure gauge", qlo: 90, qhi: 125, step: 5, plo: 90, phi: 101 },
  { name: "Control panel", qlo: 400, qhi: 550, step: 10, plo: 205, phi: 255 },
  { name: "Side panel", qlo: 110, qhi: 175, step: 5, plo: 175, phi: 195 },
];
const SUPPLIERS = [
  { name: "Apex Fasteners", pay: 30 },
  { name: "Brightwire Ltd", pay: 30 },
  { name: "Corvid Aero", pay: 25 },
  { name: "Delta Seals", pay: 45 },
  { name: "Evergreen Parts", pay: 15 },
  { name: "Falcon Supply", pay: 30 },
];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const orders: BlockMaker = {
  key: "l2.orders",
  title: "Purchase orders: MIN, MAX, SUM, AVERAGE, COUNTA, COUNTIF(S), SUMIF and IF",
  make(rng): Block {
    const n = int(rng, 50, 70);
    // Each supplier carries 3 items, so COUNTIFS(supplier, item) questions have answers.
    const carries = SUPPLIERS.map(() => shuffle(rng, ITEMS).slice(0, 3));
    const m0 = int(rng, 0, 8);
    const rows: [string, string, string, number, number, number][] = [];
    let month = m0, seq = 1;
    for (let i = 0; i < n; i++) {
      if (i > 0 && rng() < 0.06) { month = (month + 1) % 12; seq = 1; }
      const si = int(rng, 0, SUPPLIERS.length - 1);
      const it = pick(rng, carries[si]);
      const q = it.qlo + it.step * int(rng, 0, Math.round((it.qhi - it.qlo) / it.step));
      const unit = round(it.plo + (it.phi - it.plo) * rng(), 2);
      const pay = rng() < 0.9 ? SUPPLIERS[si].pay : pick(rng, [15, 25, 30, 45]);
      rows.push([`${MONTHS[month]}${1000 + seq++}`, SUPPLIERS[si].name, it.name, q, round(q * unit, 2), pay]);
    }
    const S = new Sheet();
    const T = S.table("B", TOP, ["Order No.", "Supplier", "Item Description", "Quantity", "Order Cost", "Payments"], rows);
    const R = (h: string) => T.cols[h].range;
    const Q = rows.map((r) => r[3]), C = rows.map((r) => r[4]), P = rows.map((r) => r[5]);

    const itemsPresent = [...new Set(rows.map((r) => r[2]))];
    const item1 = pick(rng, itemsPresent);
    const pr = rows[int(rng, 0, n - 1)];
    const [sup2, item2] = [pr[1], pr[2]];
    const item3 = pick(rng, itemsPresent.length > 1 ? itemsPresent.filter((x) => x !== item1) : itemsPresent);
    const payCut = pick(rng, [30, 45].filter((p) => P.some((x) => x < p)));
    const big = 10000;
    const sizeRow = int(rng, 0, n - 1);

    const qr = TOP;
    S.header(`J${qr}`, "Answer the following:").header(`K${qr}`, "Your answer");
    const parts: Omit<Part, "cell">[] = [];
    parts.push({
      label: "Minimum quantity", answer: Math.min(...Q), tol: 0, formula: `=MIN(${R("Quantity")})`,
      explain: "MIN of the Quantity column (his Lesson 2 notes: =MIN(B4:B13)).",
    });
    parts.push({
      label: "Maximum quantity", answer: Math.max(...Q), tol: 0, formula: `=MAX(${R("Quantity")})`,
      explain: "MAX of the Quantity column.",
    });
    parts.push({
      label: "Total order costs", answer: round(sum(C), 2), formula: `=SUM(${R("Order Cost")})`,
      explain: "SUM adds every cell of the array.",
      traps: [{ value: sum(Q), why: "Summed the Quantity column instead of Order Cost." }],
    });
    parts.push({
      label: "Average number of payments", answer: mean(P), formula: `=AVERAGE(${R("Payments")})`,
      explain: "AVERAGE of the Payments column. Leave it unrounded.",
    });
    parts.push({
      label: "Number of purchase orders", answer: n, tol: 0, formula: `=COUNTA(${R("Order No.")})`,
      explain: "Each row is one order: COUNTA counts the order numbers (text), or =COUNT on a numeric column gives the same.",
      traps: [{ value: 0, why: "COUNT on the Order No. column: COUNT ignores text, use COUNTA." }],
    });
    const c1 = rows.filter((r) => r[2] === item1).length;
    parts.push({
      label: `Number of ${item1} orders`, answer: c1, tol: 0, formula: `=COUNTIF(${R("Item Description")},"${item1}")`,
      explain: "COUNTIF(range, criterion): the text criterion goes in quotes (not case sensitive).",
    });
    const cp = P.filter((x) => x < payCut).length, cpe = P.filter((x) => x <= payCut).length;
    parts.push({
      label: `Number of payments < ${payCut}`, answer: cp, tol: 0, formula: `=COUNTIF(${R("Payments")},"<${payCut}")`,
      explain: `The criterion "<${payCut}" goes in quotes because it contains an operator.`,
      traps: keep(cp, [{ value: cpe, why: `Used "<=${payCut}": that also counts payments of exactly ${payCut}.` }]),
    });
    const c2 = rows.filter((r) => r[1] === sup2 && r[2] === item2).length;
    parts.push({
      label: `Number of ${item2} orders by ${sup2}`, answer: c2, tol: 0,
      formula: `=COUNTIFS(${R("Supplier")},"${sup2}",${R("Item Description")},"${item2}")`,
      explain: "Two conditions at once: COUNTIFS(range1, criterion1, range2, criterion2).",
      traps: keep(c2, [{ value: rows.filter((r) => r[2] === item2).length, why: `Counted every ${item2} order, not just ${sup2}'s.` }]),
    });
    const s3 = round(sum(rows.filter((r) => r[2] === item3).map((r) => r[4])), 2);
    parts.push({
      label: `Total order cost of ${item3}`, answer: s3,
      formula: `=SUMIF(${R("Item Description")},"${item3}",${R("Order Cost")})`,
      explain: "SUMIF(criteria range, criterion, sum range) adds the costs on the rows whose item matches.",
      traps: keep(s3, [{ value: sum(rows.filter((r) => r[2] === item3).map((r) => r[3])), why: "Summed Quantity instead of Order Cost." }], Math.max(0.01, 0.002 * s3)),
    });
    const large = Q.filter((x) => x >= big).length, largeStrict = Q.filter((x) => x > big).length;
    parts.push({
      label: "Number of Large orders (Quantity >= 10000)", answer: large, tol: 0, formula: `=COUNTIF(${R("Quantity")},">=${big}")`,
      explain: "Large means Quantity >= 10000, so the criterion is \">=10000\".",
      traps: keep(large, [{ value: largeStrict, why: "Used \">10000\": an order of exactly 10000 is Large too." }, { value: n - large, why: "Counted the Small orders." }]),
    });
    const sizeCell = `E${T.first + sizeRow}`;
    const size = Q[sizeRow] >= big ? "Large" : "Small";
    parts.push({
      label: `ORDER SIZE of order ${rows[sizeRow][0]} (Large or Small)`, answer: size, options: ["Large", "Small"],
      formula: `=IF(${sizeCell}>=${big},"Large","Small")`,
      explain: "IF(test, value if true, value if false): Large when Quantity >= 10000, Small otherwise.",
    });
    parts.forEach((p, i) => S.ask(`J${qr + 1 + i}`, { ...p, cell: `K${qr + 1 + i}` } as Part));
    return {
      tab: "Purchase orders", title: "Purchase orders",
      text: [
        `The table lists ${n} purchase orders from an aircraft-parts buyer. Payments is the number of days the supplier gives to pay.`,
        "An order is Large if Quantity >= 10000 and Small otherwise.",
        "Answer each yellow cell with a formula that points at the table. Do not round.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "Add an ORDER SIZE column in H: type =IF(E9>=10000,\"Large\",\"Small\") in H9 and fill it down to the last order. Self-check: COUNTIF of that column for \"Large\" equals your count of Large orders.",
      ],
      colWidths: [3, 11, 18, 20, 10, 12, 10, 3, 3, 40, 14],
    };
  },
};

// ---------- Q2: online sales (mirrors "Lesson 2, exercise" Q3 and Homework 2) ----------
const CITIES = [{ c: "New York", w: 4 }, { c: "California", w: 4 }, { c: "Chicago", w: 3 }, { c: "Austin", w: 2 }, { c: "Boston", w: 2 }];
function weighted<T extends { w: number }>(rng: Rng, xs: T[]): T {
  const tot = xs.reduce((s, x) => s + x.w, 0);
  let u = rng() * tot;
  for (const x of xs) { u -= x.w; if (u < 0) return x; }
  return xs[xs.length - 1];
}

const sales: BlockMaker = {
  key: "l2.sales",
  title: "Online sales: COUNT, COUNTIF(S), SUM, AVERAGE, SUMIF(S), AVERAGEIF",
  make(rng): Block {
    const n = int(rng, 60, 80);
    const id0 = pick(rng, [10001, 20001, 30001, 50001]);
    const rows: [number, string, string, string, number, string, number][] = [];
    for (let i = 0; i < n; i++) {
      const amt = rng() < 0.12 ? round(80 + 170 * rng(), 2) : round(15 + 15 * rng() + 10 * rng(), 2);
      const hour = rng() < 0.55 ? int(rng, 8, 17) : int(rng, 0, 23);
      rows.push([id0 + i, weighted(rng, CITIES).c, rng() < 0.55 ? "Credit" : "Paypal", rng() < 0.7 ? "Web" : "Email", amt, rng() < 0.5 ? "DVD" : "Book", hour]);
    }
    const S = new Sheet();
    const T = S.table("B", TOP, ["Cust ID", "City", "Payment", "Source", "Amount", "Product", "Hour"], rows);
    const R = (h: string) => T.cols[h].range;
    const A = rows.map((r) => r[4]);
    const city = pick(rng, [...new Set(rows.map((r) => r[1]))]);
    const prod = pick(rng, ["DVD", "Book"]);
    const prod2 = prod === "DVD" ? "Book" : "DVD";
    const pay = pick(rng, ["Paypal", "Credit"]);
    const cityAvg = pick(rng, [...new Set(rows.map((r) => r[1]))]);
    const pr = rows[int(rng, 0, n - 1)];
    const [c3, p3, pd3] = [pr[1], pr[2], pr[5]];
    const total = round(sum(A), 2);

    const qr = TOP;
    S.header(`K${qr}`, "Use Excel functions to calculate:").header(`L${qr}`, "Your answer");
    const parts: Omit<Part, "cell">[] = [];
    parts.push({ label: "Number of customers", answer: n, tol: 0, formula: `=COUNT(${R("Cust ID")})`, explain: "One row per customer: COUNT the Cust ID numbers (or COUNTA)." });
    const nc = rows.filter((r) => r[1] === city).length;
    parts.push({ label: `Number of customers in ${city}`, answer: nc, tol: 0, formula: `=COUNTIF(${R("City")},"${city}")`, explain: "COUNTIF on the City column." });
    const np = rows.filter((r) => r[5] === prod).length;
    parts.push({ label: `Number of customers that purchased a ${prod}`, answer: np, tol: 0, formula: `=COUNTIF(${R("Product")},"${prod}")`, explain: "COUNTIF on the Product column." });
    const bh = rows.filter((r) => r[6] >= 8 && r[6] < 16).length;
    parts.push({
      label: "Number of orders during business hours (8:00AM-4:00PM)", answer: bh, tol: 0,
      formula: `=COUNTIFS(${R("Hour")},">=8",${R("Hour")},"<16")`,
      explain: "Hour 8 means 8:00–8:59 and hour 16 starts at 4:00PM, so business hours are Hour >= 8 and Hour < 16: two criteria on the same column with COUNTIFS.",
      traps: keep(bh, [
        { value: rows.filter((r) => r[6] >= 8 && r[6] <= 16).length, why: "Used \"<=16\": hour 16 is 4:00–4:59PM, after business hours." },
        { value: rows.filter((r) => r[6] > 8 && r[6] < 16).length, why: "Used \">8\": that leaves out the 8 o'clock hour." },
      ]),
    });
    parts.push({ label: "Total amount sold", answer: total, formula: `=SUM(${R("Amount")})`, explain: "SUM of the Amount column." });
    parts.push({ label: "Average amount sold", answer: mean(A), formula: `=AVERAGE(${R("Amount")})`, explain: "AVERAGE of the Amount column, unrounded." });
    const sb = round(sum(rows.filter((r) => r[5] === "Book").map((r) => r[4])), 2);
    parts.push({
      label: "Amount sold of books", answer: sb, formula: `=SUMIF(${R("Product")},"Book",${R("Amount")})`,
      explain: "SUMIF(criteria range, criterion, sum range).",
      traps: keep(sb, [{ value: rows.filter((r) => r[5] === "Book").length, why: "Counted the book orders instead of adding their amounts." }], 0.01),
    });
    const sbp = round(sum(rows.filter((r) => r[5] === prod2 && r[2] === pay).map((r) => r[4])), 2);
    parts.push({
      label: `Amount sold of ${prod2 === "Book" ? "books" : "DVDs"} through ${pay}`, answer: sbp,
      formula: `=SUMIFS(${R("Amount")},${R("Product")},"${prod2}",${R("Payment")},"${pay}")`,
      explain: "SUMIFS puts the sum range FIRST, then the (range, criterion) pairs.",
      traps: keep(sbp, [{ value: round(sum(rows.filter((r) => r[5] === prod2).map((r) => r[4])), 2), why: `Only applied the product condition, not ${pay}.` }], Math.max(0.01, 0.002 * sbp)),
    });
    const av = mean(rows.filter((r) => r[1] === cityAvg).map((r) => r[4]));
    parts.push({
      label: `Average amount for orders from ${cityAvg}`, answer: av,
      formula: `=AVERAGEIF(${R("City")},"${cityAvg}",${R("Amount")})`,
      explain: "AVERAGEIF(criteria range, criterion, average range), as in Homework 2 Q6.",
      traps: keep(av, [{ value: mean(A), why: "Averaged every order, not just this city's." }], Math.max(0.01, 0.002 * av)),
    });
    const n3 = rows.filter((r) => r[1] === c3 && r[2] === p3 && r[5] === pd3).length;
    parts.push({
      label: `Number of orders from ${c3} using ${p3} for ${pd3 === "Book" ? "books" : "DVDs"}`, answer: n3, tol: 0,
      formula: `=COUNTIFS(${R("City")},"${c3}",${R("Payment")},"${p3}",${R("Product")},"${pd3}")`,
      explain: "Three conditions: COUNTIFS with three (range, criterion) pairs, as in Homework 2 Q7.",
    });
    parts.forEach((p, i) => S.ask(`K${qr + 1 + i}`, { ...p, cell: `L${qr + 1 + i}` } as Part));
    return {
      tab: "Online sales", title: "Online sales",
      text: [
        `The table shows ${n} online purchases. Hour is the hour of the day the order was placed (0 = midnight to 12:59AM, 13 = 1:00PM to 1:59PM).`,
        "Use Excel functions that point at the table to calculate each yellow cell. Do not round.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        "In his files Time Of Day is a real Excel time, stored as a fraction of a day (noon = 0.5). His Homework 2 key counted morning orders with =COUNTIF(Q5:Q476,\"<=0.5\"). Self-check: type 12:00 in a cell, format it as a number, and see 0.5.",
      ],
      colWidths: [3, 10, 12, 10, 9, 10, 9, 7, 3, 3, 50, 14],
    };
  },
};

// ---------- Q3: filling with relative and absolute references (Lesson 2, data › Demand Prediction) ----------
const filling: BlockMaker = {
  key: "l2.fill",
  title: "Filling a formula: relative and absolute references",
  make(rng): Block {
    const p0 = pick(rng, [60, 70, 80, 90]);
    const step = pick(rng, [5, 10, 15]);
    const k = 6;
    const prices = Array.from({ length: k }, (_, i) => p0 + step * i);
    // Revenue p(a − bp) peaks at p = a/(2b): put the peak inside the price range (or just past it) so seeds differ.
    const b = pick(rng, [20, 25, 40, 50, 80, 100]);
    const peak = p0 + step * pick(rng, [1, 1.5, 2, 2.5, 3, 4, 6]);
    const a = 2 * b * peak;
    const S = new Sheet();
    S.header(`B${TOP}`, "Linear demand model").header(`C${TOP}`, "Value");
    S.label(`B${TOP + 1}`, "a").given(`C${TOP + 1}`, a);
    S.label(`B${TOP + 2}`, "b").given(`C${TOP + 2}`, b);
    const aC = `C${TOP + 1}`, bC = `C${TOP + 2}`;
    const h = TOP + 4;
    S.header(`B${h}`, "Price").header(`C${h}`, "Demand").header(`D${h}`, "Revenue");
    prices.forEach((p, i) => S.set(`B${h + 1 + i}`, p, "data"));
    const demand = prices.map((p) => a - b * p);
    prices.forEach((p, i) => {
      const r = h + 1 + i;
      const firstRow = h + 1;
      S.parts.push({
        label: `Demand at price ${p}`, cell: `C${r}`, answer: demand[i], tol: 0,
        formula: `=${abs(aC)}-${abs(bC)}*B${r}`,
        explain: i === 0
          ? `Demand = a − b × Price. Fix a and b with $ (${abs(aC)}, ${abs(bC)}) and leave the price relative (B${r}), then fill down.`
          : `Filled down from C${firstRow}: the price reference moved to B${r}, while ${abs(aC)} and ${abs(bC)} stayed put.`,
        traps: keep(demand[i], [{ value: a - b, why: "Left out the price: Demand = a − b × Price." }, { value: (a - b) * p, why: "Brackets: it's a − (b × Price), not (a − b) × Price." }]),
      });
    });
    prices.forEach((p, i) => {
      const r = h + 1 + i;
      S.parts.push({
        label: `Revenue at price ${p}`, cell: `D${r}`, answer: p * demand[i],
        formula: `=B${r}*C${r}`,
        explain: "Revenue = Price × Demand on the same row: both references relative, so it fills down correctly.",
      });
    });
    const rev = prices.map((p, i) => p * demand[i]);
    S.ask(`F${h + 1}`, {
      label: "Total demand over the six prices", cell: `G${h + 1}`, answer: sum(demand), tol: 0,
      formula: `=SUM(C${h + 1}:C${h + k})`,
      explain: "SUM of the Demand column you filled.",
    });
    S.ask(`F${h + 2}`, {
      label: "Largest revenue in the table", cell: `G${h + 2}`, answer: Math.max(...rev),
      formula: `=MAX(D${h + 1}:D${h + k})`,
      explain: "MAX of the Revenue column you filled.",
    });
    return {
      tab: "Filling", title: "Filling: relative and absolute references",
      text: [
        `A linear model predicts Demand = a − b × Price, with a = ${a} and b = ${b} in the givens table.`,
        `Type ONE formula for Demand in C${h + 1} that uses $ to fix a and b, then fill it down to C${h + k}. Do the same for Revenue = Price × Demand in column D.`,
        "Then answer the two summary cells.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Check your fill: click C${h + k} and read the formula bar. It should still say ${abs(aC)} and ${abs(bC)} but B${h + k}. If you forgot the $ signs, the a and b references slide down too and give nonsense.`,
        "Press F4 while the cursor is on a reference to cycle C9 → $C$9 → C$9 → $C9.",
      ],
      colWidths: [3, 22, 12, 14, 3, 32, 14],
    };
  },
};

// ---------- Q4: classify with VLOOKUP and IF (S26 Exam 1 Q8, F26 Exam 1 Table 7) ----------
const lookup: BlockMaker = {
  key: "l2.lookup",
  title: "Classify orders with VLOOKUP (approximate match) and IF; count each class",
  make(rng): Block {
    const n = int(rng, 40, 60);
    const t1 = pick(rng, [12, 15, 18]);
    const t2 = t1 + pick(rng, [5, 8, 10]);
    const t3 = t2 + pick(rng, [10, 12, 15]);
    const labels = ["small", "medium", "large", "very large"];
    const bounds = [0, t1, t2, t3];
    const amts: number[] = [];
    for (let i = 0; i < n; i++) {
      let x = rng() < 0.12 ? round(t3 + 80 * rng(), 2) : round(5 + (t3 - 3) * rng(), 2);
      if (bounds.includes(x)) x = round(x + 0.01, 2);
      amts.push(x);
    }
    const cls = (x: number) => (x >= t3 ? 3 : x >= t2 ? 2 : x >= t1 ? 1 : 0);
    const S = new Sheet();
    const T = S.table("B", TOP, ["Order", "Amount ($)"], amts.map((x, i) => [i + 1, x]));
    const Ar = T.cols["Amount ($)"].range, Ac = T.cols["Amount ($)"].c;
    // Lookup table: lower bounds, sorted ascending (VLOOKUP with TRUE needs that).
    S.header(`E${TOP}`, "From ($)").header(`F${TOP}`, "Size");
    bounds.forEach((v, i) => { S.given(`E${TOP + 1 + i}`, v); S.given(`F${TOP + 1 + i}`, labels[i]); });
    const tab = `$E$${TOP + 1}:$F$${TOP + 4}`;
    const E = (i: number) => `E${TOP + 1 + i}`;
    // Ask the size of two orders in different classes.
    const order = shuffle(rng, [0, 1, 2, 3]);
    const pickIdx = (c: number) => { const xs = amts.map((x, i) => [x, i] as const).filter(([x]) => cls(x) === c); return xs.length ? xs[int(rng, 0, xs.length - 1)][1] : -1; };
    const asked = order.map(pickIdx).filter((i) => i >= 0).slice(0, 2);
    const q = TOP + 6;
    S.header(`E${q}`, "Question").header(`G${q}`, "Your answer");
    let r = q + 1;
    for (const i of asked) {
      const lab = labels[cls(amts[i])];
      S.ask(`E${r}`, {
        label: `Size of order ${i + 1}`, cell: `G${r}`, answer: lab, options: labels,
        formula: `=VLOOKUP(${Ac}${T.first + i},${tab},2,TRUE)`,
        explain: `VLOOKUP with TRUE finds the largest "From" value that is ≤ the amount (${amts[i]}) and returns the size beside it. The table must be sorted ascending.`,
      });
      r++;
    }
    const cnt = (c: number) => amts.filter((x) => cls(x) === c).length;
    S.ask(`E${r++}`, {
      label: "Number of small orders", cell: `G${r - 1}`, answer: cnt(0), tol: 0,
      formula: `=COUNTIF(${Ar},"<"&${E(1)})`,
      explain: `Small means below ${t1}: the criterion "<"&${E(1)} joins the operator to the cell's value.`,
      traps: keep(cnt(0), [{ value: amts.filter((x) => x <= t1).length, why: "Used <=: an order of exactly the boundary is the next size up." }]),
    });
    const lg = cnt(2);
    S.ask(`E${r++}`, {
      label: "Number of large orders", cell: `G${r - 1}`, answer: lg, tol: 0,
      formula: `=COUNTIFS(${Ar},">="&${E(2)},${Ar},"<"&${E(3)})`,
      explain: `Large is from ${t2} up to (not including) ${t3}: two criteria on the same column with COUNTIFS.`,
      traps: keep(lg, [{ value: amts.filter((x) => x >= t2).length, why: "Forgot the upper limit, so very large orders were counted too." }]),
    });
    const vl = cnt(3);
    S.ask(`E${r++}`, {
      label: "Number of very large orders", cell: `G${r - 1}`, answer: vl, tol: 0,
      formula: `=COUNTIF(${Ar},">="&${E(3)})`,
      explain: `Very large means ${t3} or more.`,
    });
    const avg = mean(amts);
    const yi = int(rng, 0, n - 1);
    const yes = amts[yi] > avg ? "Yes" : "No";
    S.ask(`E${r++}`, {
      label: `Is order ${yi + 1} above the average amount? (Yes or No)`, cell: `G${r - 1}`, answer: yes, options: ["Yes", "No"],
      formula: `=IF(${Ac}${T.first + yi}>AVERAGE(${Ar}),"Yes","No")`,
      explain: "IF(test, value if true, value if false), with the average computed inside the test.",
    });
    return {
      tab: "Lookup", title: "Classify with VLOOKUP",
      text: [
        `Orders under $${t1} are small, from $${t1} up to $${t2} medium, from $${t2} up to $${t3} large, and $${t3} or more very large. The lookup table in E:F holds each size's lower limit.`,
        "Answer with formulas: VLOOKUP(amount, table, 2, TRUE) for a size, COUNTIF/COUNTIFS for the counts, IF for the Yes/No.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Classify every order: in D${T.first} type =VLOOKUP(${Ac}${T.first},${tab},2,TRUE) and fill down. The $ signs keep the lookup table fixed. Self-check: COUNTIF of your new column for "large" matches your count of large orders.`,
      ],
      colWidths: [3, 8, 12, 12, 30, 12, 14],
    };
  },
};

export const LESSON_02: Lesson = {
  n: 2,
  title: "Introduction to spreadsheets",
  unit: 1,
  week: "Week 1 · Wed 2 Sep · Introduction to spreadsheets",
  sources: ["Lesson 2, notes on the fly.xlsx", "Lesson 2, data.xlsx", "Lesson 2, exercise.xlsx", "Homework 2, solutions.xlsx", "S26_Exam1_solutions.xlsx", "Fall_2026_Exam1_solutions.xlsx"],
  summary:
    "Cells, arrays and formulas: the grammar of every exam answer. You learn to point formulas at cells, fill them down with the right relative and absolute references, and count, add and average the rows that meet a condition with COUNTIF(S), SUMIF(S) and AVERAGEIF(S).",
  defs: [
    { term: "Cell", text: "This is a cell. A spreadsheet consists of many cells. Cells have names: the cell in column B, row 7 is B7.", source: "Lesson 2, notes on the fly › Definitions B5:B7" },
    { term: "Rows and columns", text: "All rows are indicated by a number, and all columns by a letter.", source: "Lesson 2, notes on the fly › Definitions B19" },
    { term: "Array", text: "Any collection of cells is called an array.", source: "Lesson 2, notes on the fly › Definitions B9" },
    { term: "Writing an array", text: "An array is written as the top left cell, followed by a colon, followed by the bottom right cell. For example, the array H11:I12.", source: "Lesson 2, notes on the fly › Definitions B11:B13" },
    { term: "Column and row (arrays)", text: "An array which is a single vertical collection of cells is called a column, e.g. K14:K17. An array which is a single horizontal collection of cells is called a row, e.g. M14:P14.", source: "Lesson 2, notes on the fly › Definitions B15:B17" },
    { term: "Excel is a calculator", text: "Excel is a glorified calculator. Anything your calculator can do Excel can do: =2+2, =3*4, =8^2.", source: "Lesson 2, notes on the fly › Formatting J3:J9" },
    { term: "Value or string", text: "There is a difference between what Excel interprets as a value or a string: a number stored as text is not a value.", source: "Lesson 2, notes on the fly › Formatting B13:C16" },
    { term: "Displayed vs stored", text: "The number that is displayed is not the same thing as the value stored by Excel: =1/3 may show 0.3333 but stores 0.333333…, which is not the same as typing 0.33.", source: "Lesson 2, notes on the fly › Formatting J11:J17" },
    { term: "Formula", text: "Excel can handle complicated formulas. Every formula must begin with the equals symbol \"=\" followed by capital letters, e.g. =MIN(B4:B13), =MAX(B4:B13), =SUM(B4:B13).", source: "Lesson 2, notes on the fly › Formulae B2:F6" },
    { term: "Filling", text: "Filling in Excel allows you to replicate a formula multiple times: =B6+C6 in D6, filled down, becomes =B7+C7, =B8+C8, …", source: "Lesson 2, notes on the fly › Filling B3:D25" },
    { term: "Relative and absolute references (key fact)", text: "When you fill, a plain reference like B6 moves with the formula (relative); a $ fixes it (absolute): $K$4:$K$1003 never moves, E$8 keeps row 8, $D13 keeps column D. He expects you to absolute/relative reference cells and fill accordingly.", source: "Midterm 1 announcement (Spring 2026); Fall_2026_Exam1_solutions › Empirical probability E4, E13" },
    { term: "ORDER SIZE (IF)", text: "Large: Quantity >= 10000; Small otherwise. An IF formula writes the class for each row: =IF(E4>=10000,\"Large\",\"Small\").", red: true, source: "Lesson 2, data › Purchase Orders H2:H3" },
    { term: "Conditional counts and sums", text: "The questions he set on the purchase orders: number of O-ring orders, number of payments < 30, number of O-ring orders by one supplier, total order cost of one item. These are COUNTIF, COUNTIF with \"<30\", COUNTIFS and SUMIF.", red: true, source: "Lesson 2, data › Purchase Orders J6:J14" },
  ],
  examples: [
    {
      title: "Filling a formula down",
      setup: "Columns B and C hold X and Y (X = 1, 2, …, 20; Y = 90, 88, …, 52). Fill column D with X + Y.",
      table: { head: ["X", "Y", "X+Y"], rows: [[1, 90, "=B6+C6"], [2, 88, "=B7+C7"], [3, 86, "=B8+C8"], ["…", "…", "…"], [20, 52, "=B25+C25"]] },
      steps: [
        { say: "Type the formula once, in D6", formula: "=B6+C6", result: "91" },
        { say: "Drag the fill handle down: each row's references move with it", formula: "=B7+C7", result: "90" },
        { say: "The last row", formula: "=B25+C25", result: "72" },
      ],
      takeaway: "Write the formula once with the right references, then fill.",
      source: "Lesson 2, notes on the fly › Filling",
    },
    {
      title: "The purchase-order questions (red in his file)",
      setup: "His Purchase Orders sheet has 94 orders in A4:G97 (Order No., Supplier, Item No., Item Description, Quantity, Order Cost, Payments) and asks the red questions below. (The answers are computed from his data; his file leaves the cells blank.)",
      steps: [
        { say: "ORDER SIZE for the first order (19500 units), then fill down H4:H97", formula: "=IF(E4>=10000,\"Large\",\"Small\")", result: "Large" },
        { say: "Minimum quantity", formula: "=MIN(E4:E97)", result: "90" },
        { say: "Maximum quantity", formula: "=MAX(E4:E97)", result: "25000" },
        { say: "Total order costs", formula: "=SUM(F4:F97)", result: "2471760" },
        { say: "Average number of payments", formula: "=AVERAGE(G4:G97)", result: "30.6382978723404" },
        { say: "Number of purchase orders", formula: "=COUNTA(A4:A97)", result: "94" },
        { say: "Number of O-ring orders", formula: "=COUNTIF(D4:D97,\"O-Ring\")", result: "12" },
        { say: "Number of payments < 30", formula: "=COUNTIF(G4:G97,\"<30\")", result: "17" },
        { say: "Number of O-ring orders by Spacetime Technologies", formula: "=COUNTIFS(B4:B97,\"Spacetime Technologies\",D4:D97,\"O-Ring\")", result: "3" },
        { say: "Total order cost of Airframe fasteners", formula: "=SUMIF(D4:D97,\"Airframe fasteners\",F4:F97)", result: "839550" },
      ],
      takeaway: "One condition: COUNTIF/SUMIF. Several conditions: COUNTIFS/SUMIFS. Operators go inside the quotes: \"<30\".",
      source: "Lesson 2, data › Purchase Orders",
    },
    {
      title: "Homework 2: his solutions",
      setup: "472 online orders in J5:Q476 (Cust ID, City, Payment, Transaction Code, Source, Amount, Product, Time Of Day). Answer with Excel formulas.",
      steps: [
        { say: "1. How many orders are made from Boston?", formula: "=COUNTIF(K5:K476,\"Boston\")", result: "8" },
        { say: "2. What amount is the most expensive order?", formula: "=MAX(O5:O476)", result: "247.14" },
        { say: "3. How many orders are made in the morning? (Times are fractions of a day; noon is 0.5)", formula: "=COUNTIF(Q5:Q476,\"<=0.5\")", result: "219" },
        { say: "5. How many orders are for books made from New York?", formula: "=COUNTIFS(K5:K476,\"New York\",P5:P476,\"Book\")", result: "54" },
        { say: "6. Average amount for orders made from California", formula: "=AVERAGEIF(K5:K476,\"California\",O5:O476)", result: "39.0069767441860" },
        { say: "7. Orders from Chicago using Paypal for books", formula: "=COUNTIFS(K5:K476,\"Chicago\",L5:L476,\"Paypal\",P5:P476,\"Book\")", result: "22" },
        { say: "8. Average amount for orders made from Austin for books (average range first)", formula: "=AVERAGEIFS(O5:O476,K5:K476,\"Austin\",P5:P476,\"Book\")", result: "59.97" },
        { say: "9. Total order amount for all orders from New York", formula: "=SUMIF(K5:K476,\"New York\",O5:O476)", result: "3946.05" },
      ],
      takeaway: "SUMIF/AVERAGEIF: criteria range first. SUMIFS/AVERAGEIFS: the range to add or average comes first.",
      source: "Homework 2, solutions › Orders",
    },
  ],
  quiz: [
    { q: "How do you write the array whose top-left cell is H11 and bottom-right cell is I12?", options: ["H11:I12", "H11-I12", "I12:H11", "H11,I12"], answer: 0, why: "An array is written as the top left cell, a colon, then the bottom right cell." },
    { q: "K14:K17 is a single vertical collection of cells. He calls it a…", options: ["row", "column", "string", "formula"], answer: 1, why: "A single vertical array is a column; a single horizontal one (M14:P14) is a row." },
    { q: "=1/3 is displayed as 0.3333. What value does Excel store?", options: ["0.3333", "0.33", "0.333333… (one third, to full precision)", "The text \"1/3\""], answer: 2, why: "The number that is displayed is not the same thing as the value stored. That's why exams say: don't round, use the cell." },
    { q: "D6 holds =B6+C6. You fill it down one row. What does D7 hold?", options: ["=B6+C6", "=B7+C7", "=C6+D6", "=$B$6+$C$6"], answer: 1, why: "Relative references move with the fill: one row down, B6 becomes B7 and C6 becomes C7." },
    { q: "You want a formula to keep pointing at the table $K$4:$K$1003 when filled down and across. Which reference does that?", options: ["K4:K1003", "$K$4:$K$1003", "K$4:K1003", "'K4:K1003'"], answer: 1, why: "$ before both the column letter and row number makes the reference absolute, as in his Fall 2026 Exam 1 key." },
    { q: "Which counts the O-ring orders in D4:D97?", options: ["=COUNT(D4:D97,\"O-Ring\")", "=COUNTIF(D4:D97,\"O-Ring\")", "=SUMIF(D4:D97,\"O-Ring\")", "=COUNTIF(\"O-Ring\",D4:D97)"], answer: 1, why: "COUNTIF(range, criterion), with the text in quotes." },
    { q: "Which gives the number of payments less than 30 in G4:G97?", options: ["=COUNTIF(G4:G97,<30)", "=COUNTIF(G4:G97,\"<30\")", "=COUNTIF(G4:G97,\"<=30\")", "=COUNT(G4:G97<30)"], answer: 1, why: "A criterion with an operator goes inside quotes: \"<30\". \"<=30\" would also count 30." },
    { q: "Which is the total order cost (F) of Airframe fasteners (item in D)?", options: ["=SUMIF(F4:F97,\"Airframe fasteners\",D4:D97)", "=SUMIF(D4:D97,\"Airframe fasteners\",F4:F97)", "=COUNTIF(D4:D97,\"Airframe fasteners\")", "=SUM(D4:D97,\"Airframe fasteners\")"], answer: 1, why: "SUMIF(criteria range, criterion, sum range): look in D, add up F." },
    { q: "In AVERAGEIFS, which argument comes first?", options: ["The first criteria range", "The range to average", "The first criterion", "The number of conditions"], answer: 1, why: "AVERAGEIFS and SUMIFS start with the range to average or add: =AVERAGEIFS(O5:O476,K5:K476,\"Austin\",P5:P476,\"Book\")." },
    { q: "In Homework 2 he counted morning orders with =COUNTIF(Q5:Q476,\"<=0.5\"). Why 0.5?", options: ["Half the orders are in the morning", "Excel stores a time as a fraction of a day, so noon is 0.5", "Amounts under $0.50 are morning orders", "0.5 is the median time"], answer: 1, why: "A time is a fraction of a day: 12:00 is 0.5, 6:00 is 0.25." },
  ],
  excel: [
    { fn: "MIN, MAX, SUM, AVERAGE", use: "Over an array: =MIN(B4:B13), =MAX(B4:B13), =SUM(B4:B13); AVERAGE for a mean." },
    { fn: "COUNT / COUNTA", use: "COUNT counts numbers; COUNTA counts every non-empty cell (use it for text such as order numbers or names)." },
    { fn: "COUNTIF", use: "=COUNTIF(range,criterion): =COUNTIF(K5:K476,\"Boston\"); with an operator in quotes, =COUNTIF(G4:G97,\"<30\"). Text matching ignores case." },
    { fn: "COUNTIFS", use: "Several conditions: =COUNTIFS(K5:K476,\"Chicago\",L5:L476,\"Paypal\",P5:P476,\"Book\"). Two conditions on one column make a between: =COUNTIFS(H9:H70,\">=8\",H9:H70,\"<16\")." },
    { fn: "SUMIF / AVERAGEIF", use: "=SUMIF(criteria range, criterion, sum range), e.g. =SUMIF(K5:K476,\"New York\",O5:O476); AVERAGEIF the same way." },
    { fn: "SUMIFS / AVERAGEIFS", use: "Range to add/average FIRST: =AVERAGEIFS(O5:O476,K5:K476,\"Austin\",P5:P476,\"Book\")." },
    { fn: "IF", use: "=IF(E4>=10000,\"Large\",\"Small\"), filled down to classify every row." },
    { fn: "VLOOKUP", use: "Classify by bands: =VLOOKUP(O5,$D$41:$E$44,2,TRUE) with the lower limits sorted ascending in the first column (S26 Exam 1; F26 Exam 1 age classes)." },
    { fn: "Filling and $", use: "Type once, fill down/across. $ fixes a column, a row or both: $K$4:$K$1003, E$8, $D13. F4 cycles through them." },
  ],
  watch: [
    "Spring 2026 Exam 1 \"Excel skills\": MAX/MIN of amounts, outliers counted with =COUNTIF(Q5:Q476,\">2\")+COUNTIF(Q5:Q476,\"<-2\"), =COUNTIFS(K5:K476,\"Boston\",L5:L476,\"Credit\"), =AVERAGEIF(K5:K476,\"California\",O5:O476), and an order-size column filled with =VLOOKUP(O5,$D$41:$E$44,2,TRUE).",
    "Fall 2026 Exam 1 Section 3 (Empirical probability) (Table 6): a two-way count table with =COUNTIFS($K$4:$K$1003,\"Man\",$L$4:$L$1003,\"Gym\"); Table 7 used mixed references, =COUNTIFS($P$4:$P$1003,$D13,$L$4:$L$1003,E$12), filled across and down, and an age class column with =VLOOKUP(M4,$F$18:$G$20,2,TRUE).",
    "Fall 2025 Exam 1 Q1(a): percentage change =(E9/E$8)-1 filled down and across (the $ keeps the first row); Q1(d): a summary table with =SUMIF($W$7:$W$26,AA21,$V$7:$V$26).",
    "The Midterm 1 announcement (Spring 2026) lists \"absolute/relative reference cells and fill accordingly\" and \"COUNTIF, SUMIFS, PERCENTILE, IF, VLOOKUP\" by name: any function used in class or homework is fair game.",
    "Slips: SUMIF's sum range is LAST but SUMIFS/AVERAGEIFS put it FIRST; forgetting quotes around \"<30\"; \">\" vs \">=\" at a boundary; COUNT on a text column gives 0 (use COUNTA); forgetting $ on a lookup table or a fixed parameter before filling.",
    "He grades the stored value: point formulas at cells instead of retyping rounded numbers.",
  ],
  makers: [orders, sales, filling, lookup],
};
