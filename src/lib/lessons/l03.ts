// Lesson 3: Data visualization (Wed 9 Sep). Independent/dependent variables and which chart suits which data,
// from "Lesson 3, notes" and the Charts sheet of "Homework 2, solutions".
import { Sheet, int, pick, shuffle, round, TOP, type BlockMaker, type Block, type Part, type Trap } from "./kit.ts";
import type { Lesson } from "./types.ts";

const CHARTS = ["Pie", "Bar", "Line", "Scatter"];
const keep = (answer: number, traps: Trap[], tol = 0) =>
  traps.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - answer) > Math.max(tol * 1.5, 1e-9));
const sum = (xs: number[]) => xs.reduce((s, x) => s + x, 0);

// ---------- Q1: which chart? ----------
type Scene = { text: string; x: string; y: string; chart: "Pie" | "Bar" | "Line" | "Scatter"; why: string };
const SCENES: Record<Scene["chart"], Scene[]> = {
  Line: [
    { text: "The closing price of gold on the first day of every month for three years.", x: "Date", y: "Closing price", chart: "Line", why: "X is a date, a numeric scale that runs continuously: his gold-price example is a line chart." },
    { text: "The market cap of seven tech companies at the end of each year from 2014 to 2026.", x: "Year", y: "Market cap", chart: "Line", why: "X is time (years) and you want to follow each company along it: Spring 2026 Exam 1 Q1's key is a line chart." },
    { text: "The percentage change in Tesla, GM and Ford stock each month since January 2019.", x: "Date", y: "Percentage change", chart: "Line", why: "X is a date running continuously: Fall 2025 Exam 1 Q1(b)'s key is a line chart." },
    { text: "The number of visitors to a website on each of the last 90 days.", x: "Date", y: "Number of visitors", chart: "Line", why: "X is a date running continuously, so join the points with a line." },
  ],
  Scatter: [
    { text: "For 120 countries: the population and the number of Olympic medals won. Show how medals depend on population.", x: "Population", y: "Number of medals", chart: "Scatter", why: "X is numeric and each country is one point (X, Y): Spring 2026 Exam 1 Q3's key is a scatter chart." },
    { text: "For 9 countries: the population and the number of Nobel prizes awarded.", x: "Population", y: "Number of Nobel prizes", chart: "Scatter", why: "His own scatter example: Nobel prizes (dependent) against population (independent), a numeric X." },
    { text: "For 100 people: IQ and earnings. Explore how earnings depend on IQ.", x: "IQ", y: "Earnings", chart: "Scatter", why: "X (IQ) is numeric and discrete, one point per person: Homework 2 Q2's key is a scatter chart." },
    { text: "For the 20 largest companies: market cap and number of employees. Show how employees depend on market cap.", x: "Market cap", y: "Number of employees", chart: "Scatter", why: "Numeric X, one point per company: Fall 2025 Exam 1 Q1(c)'s key is a scatter chart." },
    { text: "For 40 students: hours studied and score on the exam.", x: "Hours studied", y: "Score on the exam", chart: "Scatter", why: "Two numbers per student and the score depends on hours (his independent/dependent example), so plot points." },
  ],
  Bar: [
    { text: "The number of aircraft carriers of five countries: USA, China, India, France and Russia.", x: "Country", y: "Number of aircraft carriers", chart: "Bar", why: "X (country) is categorical and the list is not exhaustive (it is missing some countries), so a pie chart is not appropriate: his Bar example." },
    { text: "The endowment of the 20 richest US colleges.", x: "College", y: "Endowment", chart: "Bar", why: "X (college) is categorical, and the top 20 is not every college: a bar chart (Homework 2 Q4)." },
    { text: "The number of men and the number of women shown gym, podcast and pet videos.", x: "Video type", y: "Number of users", chart: "Bar", why: "X (video type) is categorical with two groups to compare: Fall 2026 Exam 1 Section 3 (Empirical probability)'s key is a (clustered) bar chart." },
    { text: "The market cap of the five largest car makers in the world.", x: "Company", y: "Market cap", chart: "Bar", why: "X (company) is categorical and five companies are not the whole market, so bar, not pie." },
  ],
  Pie: [
    { text: "The percentage of the final grade from each form of assessment: quizzes, homework, three midterms and the final (they add to 100%).", x: "Assessment", y: "Percentage", chart: "Pie", why: "X is categorical and exhaustive (all of the grade is included): Homework 2 Q3 asks for a pie chart." },
    { text: "The total value held in cryptocurrencies: Bitcoin, Ethereum, Tether, XRP, BNB and Other.", x: "Coin", y: "Value ($ billions)", chart: "Pie", why: "X is categorical and \"Other\" makes the list exhaustive: Spring 2026 Exam 1 Q2's key is a pie chart." },
    { text: "The number of World Cup wins of every country that has ever won the World Cup.", x: "Country", y: "Number of wins", chart: "Pie", why: "X is categorical and every winner is included (exhaustive): his Pie sheet (he also showed a bar chart of it)." },
    { text: "A company's total sales split across all four of its sales regions.", x: "Region", y: "Sales", chart: "Pie", why: "X is categorical and the four regions make up all of the sales (exhaustive)." },
  ],
};

const choose: BlockMaker = {
  key: "l3.choose",
  title: "Which chart? Pie, bar, line or scatter, and which variable goes on the horizontal axis",
  make(rng): Block {
    const types = shuffle(rng, CHARTS) as Scene["chart"][];
    const extra = [pick(rng, CHARTS), pick(rng, CHARTS)] as Scene["chart"][];
    const used = new Set<Scene>();
    const scenes = [...types, ...extra].map((t) => {
      const pool = SCENES[t].filter((s) => !used.has(s));
      const s = pick(rng, pool.length ? pool : SCENES[t]);
      used.add(s);
      return s;
    });
    const order = shuffle(rng, scenes);
    const S = new Sheet();
    S.header(`B${TOP}`, "#").header(`C${TOP}`, "The data").header(`D${TOP}`, "Chart (Pie, Bar, Line or Scatter)").header(`E${TOP}`, "Variable on the horizontal axis (X)");
    order.forEach((s, i) => {
      const r = TOP + 1 + i;
      S.set(`B${r}`, i + 1, "label").text(`C${r}`, s.text);
      S.parts.push({
        label: `Data ${i + 1}: chart`, cell: `D${r}`, answer: s.chart, options: CHARTS, formula: `"${s.chart}"`,
        explain: s.why,
      });
      const xo = rng() < 0.5 ? [s.x, s.y] : [s.y, s.x];
      S.parts.push({
        label: `Data ${i + 1}: horizontal axis (${xo.join(" or ")})`, cell: `E${r}`, answer: s.x, options: xo, formula: `"${s.x}"`,
        explain: `${s.y} depends on ${s.x}, so ${s.x} is the independent variable: it goes on the horizontal axis (X), ${s.y} on the vertical axis (Y).`,
      });
    });
    return {
      tab: "Which chart", title: "Which chart?",
      text: [
        "For each data set type the chart his table calls for: Line (X numeric, continuous, such as dates), Scatter (X numeric, discrete, one point per item), Bar (X categorical) or Pie (X categorical and exhaustive: all data included).",
        "Then type the variable that goes on the horizontal axis: the independent variable, the one the other depends on.",
      ],
      cells: S.cells, parts: S.parts,
      colWidths: [3, 4, 70, 22, 30],
    };
  },
};

// ---------- Q2: pie or bar? shares of a total ----------
type Set_ = { title: string; x: string; y: string; cats: string[]; lo: number; hi: number; exhaustive: boolean; note: string };
const SETS: Set_[] = [
  { title: "Sales by region (all regions)", x: "Region", y: "Sales ($ thousands)", cats: ["North", "South", "East", "West"], lo: 200, hi: 900, exhaustive: true, note: "the four regions are all of the company's sales, so the list is exhaustive" },
  { title: "Monthly household budget", x: "Category", y: "Spending ($)", cats: ["Rent", "Food", "Transport", "Utilities", "Savings", "Everything else"], lo: 150, hi: 1800, exhaustive: true, note: "\"Everything else\" closes the list, so all of the budget is included" },
  { title: "Votes for every candidate in a class election", x: "Candidate", y: "Votes", cats: ["Ava", "Ben", "Chloe", "Diego", "Emma"], lo: 8, hi: 60, exhaustive: true, note: "every candidate is listed, so all the votes are included" },
  { title: "Headcount by department (whole company)", x: "Department", y: "Employees", cats: ["Sales", "Marketing", "Operations", "Finance", "IT", "HR"], lo: 12, hi: 140, exhaustive: true, note: "every department is listed, so the whole company is included" },
  { title: "Value held in a fund, by asset (with Other)", x: "Asset", y: "$ millions", cats: ["Stocks", "Bonds", "Property", "Gold", "Cash", "Other"], lo: 20, hi: 600, exhaustive: true, note: "the \"Other\" row covers everything else in the fund, so the list is exhaustive" },
  { title: "Five best-selling products (of 40 on sale)", x: "Product", y: "Units sold", cats: ["Desk lamp", "Notebook", "Water bottle", "Backpack", "Headphones"], lo: 120, hi: 900, exhaustive: false, note: "only 5 of the 40 products are listed, so the list is not exhaustive and a pie chart is not appropriate" },
  { title: "Top six sales reps by revenue (of 25)", x: "Sales rep", y: "Revenue ($ thousands)", cats: ["Kofi", "Lena", "Mateo", "Nora", "Omar", "Priya"], lo: 80, hi: 400, exhaustive: false, note: "only the top 6 of 25 reps are listed, so the list is not exhaustive" },
  { title: "Largest five suppliers by spend", x: "Supplier", y: "Spend ($ thousands)", cats: ["Apex", "Brightwire", "Corvid", "Delta", "Evergreen"], lo: 50, hi: 700, exhaustive: false, note: "only the five largest suppliers are listed, not all of them: not exhaustive" },
];

const pie: BlockMaker = {
  key: "l3.pie",
  title: "Pie or bar? Totals and each category's share",
  make(rng): Block {
    const set = pick(rng, SETS);
    const vals = set.cats.map(() => int(rng, set.lo, set.hi));
    const S = new Sheet();
    const T = S.table("B", TOP, [set.x, set.y], set.cats.map((c, i) => [c, vals[i]]));
    const V = T.cols[set.y].range, Vc = T.cols[set.y].c;
    const total = sum(vals);
    const q = TOP;
    S.header(`E${q}`, "Question").header(`F${q}`, "Your answer");
    const parts: Omit<Part, "cell">[] = [];
    parts.push({ label: "Total", answer: total, tol: 0, formula: `=SUM(${V})`, explain: "SUM of the values: the whole that the slices would share." });
    const ks = shuffle(rng, set.cats.map((_, i) => i)).slice(0, 2);
    for (const k of ks) {
      const a = vals[k] / total;
      parts.push({
        label: `${set.cats[k]}'s share of the total (as a decimal or %)`, answer: a, format: "prob",
        formula: `=${Vc}${T.first + k}/SUM(${V})`,
        explain: "Share = this value ÷ the total. Format the cell as a percentage if you like: the stored value is the same.",
        traps: keep(a, [{ value: a * 100, why: "Multiplied by 100 as well as formatting as a %: the value should be a fraction like 0.25." }, { value: total / vals[k], why: "Divided the wrong way round: the total goes on the bottom." }], 0.002),
      });
    }
    const top = Math.max(...vals) / total;
    parts.push({
      label: "Largest share of the total", answer: top, format: "prob", formula: `=MAX(${V})/SUM(${V})`,
      explain: "The largest slice: MAX ÷ SUM.",
      traps: keep(top, [{ value: Math.max(...vals), why: "Gave the largest value, not its share of the total." }], 0.002),
    });
    const ex = set.exhaustive ? "Yes" : "No";
    parts.push({
      label: "Is the list exhaustive? (Yes or No)", answer: ex, options: ["Yes", "No"], formula: `"${ex}"`,
      explain: `${set.exhaustive ? "Yes" : "No"}: ${set.note}.`,
    });
    const ch = set.exhaustive ? "Pie" : "Bar";
    parts.push({
      label: "The chart his table calls for (Pie or Bar)", answer: ch, options: CHARTS, formula: `"${ch}"`,
      explain: set.exhaustive
        ? "X is categorical and exhaustive, so a pie chart (a bar chart also works for any categorical X, as his World Cup example shows)."
        : "X is categorical but not exhaustive, so a bar chart: \"Therefore a pie chart is not appropriate\" (his Bar sheet).",
    });
    parts.forEach((p, i) => S.ask(`E${q + 1 + i}`, { ...p, cell: `F${q + 1 + i}` } as Part));
    return {
      tab: "Pie or bar", title: set.title,
      text: [
        `The table shows ${set.title.toLowerCase()}.`,
        "Find the total and the shares with formulas pointing at the table (leave shares as decimals or format them as %), then decide: is the list exhaustive, and which chart fits?",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Select ${T.cols[set.x].c}${TOP}:${Vc}${T.last} and insert the chart you chose. Give it a concise title (e.g. "${set.title}")${set.exhaustive ? " and data labels showing percentages" : " and axis titles"}. Self-check: ${set.exhaustive ? "the labelled percentages match your shares" : "the tallest bar is the largest value"}, and nothing distracting (no 3-D).`,
      ],
      colWidths: [3, 20, 22, 3, 44, 14],
    };
  },
};

// ---------- Q3: build a summary table, then chart it (F25 Exam 1 Q1(d), F26 Exam 1 Q3) ----------
const INDUSTRIES = ["Semiconductors", "Software", "Banking", "Retail", "Oil"];
const COS = ["Acme", "Borealis", "Cobalt", "Dynamo", "Ember", "Fjord", "Granite", "Helix", "Iris", "Juniper", "Kestrel", "Lumen", "Meridian", "Nimbus",
  "Onyx", "Pioneer", "Quasar", "Redwood", "Summit", "Tundra", "Umbra", "Vertex", "Willow", "Xenon", "Yukon", "Zephyr", "Atlas", "Beacon", "Cedar", "Delta",
  "Echo", "Falcon", "Garnet", "Harbor", "Indigo", "Jasper", "Keystone", "Lynx", "Magnolia", "Nova"];

const summary: BlockMaker = {
  key: "l3.summary",
  title: "Summarise raw data with SUMIF and COUNTIF, then chart the summary",
  make(rng): Block {
    const n = int(rng, 24, 40);
    const inds = shuffle(rng, INDUSTRIES).slice(0, 4);
    const names = shuffle(rng, COS).slice(0, n);
    const rows = names.map((nm) => {
      const ind = pick(rng, inds);
      const cap = int(rng, 40, 900) + (rng() < 0.1 ? int(rng, 500, 2500) : 0);
      const emp = int(rng, 5, 300);
      return [`${nm} ${pick(rng, ["Inc.", "Corp.", "Group", "plc"])}`, ind, cap, emp] as [string, string, number, number];
    });
    // Every industry appears at least once.
    inds.forEach((ind, i) => { rows[i][1] = ind; });
    const S = new Sheet();
    const T = S.table("B", TOP, ["Company", "Industry", "Market cap ($ billions)", "Employees (thousands)"], rows);
    const M = T.cols["Market cap ($ billions)"].range;
    const h = TOP;
    S.header(`G${h}`, "Industry").header(`H${h}`, "Combined market cap").header(`I${h}`, "Number of companies");
    inds.forEach((ind, i) => {
      const r = h + 1 + i;
      S.label(`G${r}`, ind);
      const s = sum(rows.filter((x) => x[1] === ind).map((x) => x[2]));
      const c = rows.filter((x) => x[1] === ind).length;
      S.parts.push({
        label: `Combined market cap: ${ind}`, cell: `H${r}`, answer: s, tol: 0,
        formula: `=SUMIF($C$${T.first}:$C$${T.last},G${r},$D$${T.first}:$D$${T.last})`,
        explain: "SUMIF(criteria range, criterion, sum range) with the industry name taken from column G; $ keeps the data ranges fixed when you fill down (as in his Fall 2025 Exam 1 key).",
        traps: keep(s, [{ value: c, why: "Counted the companies instead of adding their market caps." }]),
      });
      S.parts.push({
        label: `Number of companies: ${ind}`, cell: `I${r}`, answer: c, tol: 0,
        formula: `=COUNTIF($C$${T.first}:$C$${T.last},G${r})`,
        explain: "COUNTIF with the industry in column G as the criterion.",
      });
    });
    const capAll = sum(rows.map((x) => x[2]));
    const r0 = h + 6;
    const parts: Omit<Part, "cell">[] = [
      { label: "Total market cap of all companies", answer: capAll, tol: 0, formula: `=SUM(${M})`, explain: "SUM of the Market cap column; it equals the sum of your summary column (a good check)." },
      { label: "The independent variable (X) of the summary chart", answer: "Industry", options: ["Industry", "Combined market cap"], formula: `"Industry"`, explain: "Combined market cap depends on the industry, so industry goes on the horizontal axis." },
      { label: "Is X categorical or numeric?", answer: "Categorical", options: ["Categorical", "Numeric"], formula: `"Categorical"`, explain: "Industry names are words: categorical, so his table points to a bar chart (or a pie, since every company is in exactly one industry)." },
    ];
    parts.forEach((p, i) => S.ask(`G${r0 + i}`, { ...p, cell: `H${r0 + i}` } as Part));
    return {
      tab: "Summary table", title: "Market cap by industry",
      text: [
        `The table lists ${n} large companies with their industry, market cap and employees.`,
        "Fill the summary table in G:I with ONE SUMIF and ONE COUNTIF formula each, filled down (use $ on the data ranges). Then answer the three questions below it.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Chart the combined market cap of each industry: select G${h}:H${h + 4} and insert a bar chart with a title and axis titles. Self-check: the bar heights match your SUMIF column. (His Fall 2025 Exam 1 key shows both a bar and a pie chart for this kind of table.)`,
        "Also produce a scatter chart of employees (Y) against market cap (X) for all the companies, with axis titles. Self-check: one dot per company, market cap along the bottom.",
      ],
      colWidths: [3, 20, 16, 14, 14, 3, 30, 18, 18],
    };
  },
};

// ---------- Q4: line chart of percentage change (F25 Exam 1 Q1(a)–(b)) ----------
const STOCKS = [["Northwind", "Contoso", "Fabrikam"], ["Alder Motors", "Birch Auto", "Cedar Cars"], ["Orbit Air", "Polar Air", "Quill Air"], ["Ridge Foods", "Sable Foods", "Thorn Foods"]];
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const line: BlockMaker = {
  key: "l3.line",
  title: "Percentage change with a mixed reference, then a line chart",
  make(rng): Block {
    const names = pick(rng, STOCKS);
    const months = int(rng, 18, 30);
    const y0 = pick(rng, [2021, 2022, 2023]);
    const series = names.map(() => {
      let p = int(rng, 20, 300) + round(rng(), 2);
      const drift = (rng() - 0.5) * 0.06;
      const out: number[] = [];
      for (let m = 0; m < months; m++) { out.push(round(p, 2)); p = Math.max(1, p * (1 + drift + 0.07 * (rng() - 0.5) * 2)); }
      return out;
    });
    const rows = Array.from({ length: months }, (_, m) => [`${MON[m % 12]} ${y0 + Math.floor(m / 12)}`, ...series.map((s) => s[m])]);
    const S = new Sheet();
    const T = S.table("B", TOP, ["Date", ...names], rows);
    const first = T.first, last = T.last;
    const cols = names.map((nm) => T.cols[nm].c);
    const q = TOP;
    S.header(`H${q}`, "Question").header(`I${q}`, "Your answer");
    const parts: Omit<Part, "cell">[] = [];
    names.forEach((nm, j) => {
      const a = series[j][months - 1] / series[j][0] - 1;
      parts.push({
        label: `${nm}: percentage change from ${rows[0][0]} to ${rows[months - 1][0]}`, answer: a, tol: 0.0005,
        formula: `=(${cols[j]}${last}/${cols[j]}$${first})-1`,
        explain: `(current price / original price) − 1, formatted as a %. ${cols[j]}$${first} keeps row ${first} (the original price) fixed when you fill down, as in his Fall 2025 Exam 1 key =(E9/E$8)-1.`,
        traps: keep(a, [{ value: a * 100, why: "Multiplied by 100 as well as formatting as a %." }, { value: series[j][months - 1] - series[j][0], why: "Gave the change in dollars, not the percentage change." }], 0.0005),
      });
    });
    const mi = int(rng, 1, months - 2), jj = int(rng, 0, names.length - 1);
    const am = series[jj][mi] / series[jj][0] - 1;
    parts.push({
      label: `${names[jj]}: percentage change from ${rows[0][0]} to ${rows[mi][0]}`, answer: am, tol: 0.0005,
      formula: `=(${cols[jj]}${first + mi}/${cols[jj]}$${first})-1`,
      explain: "Same formula on that month's row; if you filled a whole percentage-change column, just point at the right cell.",
      traps: keep(am, [{ value: series[jj][mi] / series[jj][mi - 1] - 1, why: "Compared with the month before instead of the original price (the $ was missing)." }], 0.0005),
    });
    const hi = Math.max(...series[0]);
    parts.push({ label: `Highest ${names[0]} price`, answer: hi, formula: `=MAX(${T.cols[names[0]].range})`, explain: "MAX of that column." });
    parts.push({ label: "Chart for the prices over time", answer: "Line", options: CHARTS, formula: `"Line"`, explain: "X is a date (numeric, continuous): a line chart, like his gold-price chart and the Fall 2025 Exam 1 key." });
    parts.push({ label: "Variable on the horizontal axis", answer: "Date", options: ["Date", "Price"], formula: `"Date"`, explain: "Price depends on the date: date is the independent variable, on the horizontal axis." });
    parts.forEach((p, i) => S.ask(`H${q + 1 + i}`, { ...p, cell: `I${q + 1 + i}` } as Part));
    return {
      tab: "Line chart", title: "Share prices over time",
      text: [
        `Table: monthly share prices of ${names.join(", ")} from ${rows[0][0]} to ${rows[months - 1][0]}.`,
        "Percentage change = (current price / original price) − 1, formatted as a percentage. Write it once with a mixed reference (e.g. C9/C$9) so it could be filled down and across.",
      ],
      cells: S.cells, parts: S.parts,
      manual: [
        `Fill a percentage-change table next to the prices (one formula, filled down and across), then insert ONE line chart of the percentage change of all three stocks with a title, axis titles and a legend. Self-check: all three lines start at 0% in ${rows[0][0]}.`,
        "If Excel puts the series the wrong way round, use Select Data to fix the series and the horizontal axis labels.",
      ],
      colWidths: [3, 12, 12, 12, 12, 3, 3, 52, 14],
    };
  },
};

export const LESSON_03: Lesson = {
  n: 3,
  title: "Data visualization",
  unit: 1,
  week: "Week 2 · Wed 9 Sep · Data visualization",
  sources: ["Lesson 3, notes.xlsx", "Homework 2, solutions.xlsx (Charts)", "F25_Exam1_solutions.xlsx", "S26_Exam1_solutions.xlsx", "Fall_2026_Exam1_solutions.xlsx"],
  summary:
    "Every chart in the course is two-dimensional: the independent variable goes across, the dependent (always numeric) goes up, and the type of the independent variable decides the chart. Every exam has chart marks, for picking the right chart and presenting it properly (title, axis titles, nothing distracting, honest).",
  defs: [
    { term: "Two dimensions", text: "All charts we consider are 2 dimensional. Horizontal axis is X; vertical axis is Y.", source: "Lesson 3, notes › Charts B3:B7" },
    { term: "Independent and dependent variables", text: "These two variables are classified as either independent or dependent. A dependent variable depends on the independent variable. An independent variable doesn't depend on anything.", source: "Lesson 3, notes › Charts B9:B13" },
    { term: "Example", text: "Your score on an exam (Y) and how many hours you studied (X): score on the exam is the dependent variable, hours studied is the independent variable.", source: "Lesson 3, notes › Charts B15:C19" },
    { term: "Which way round", text: "The convention is to plot dependent variables vertically and independent horizontally.", source: "Lesson 3, notes › Charts B22" },
    { term: "Choosing a chart", text: "Our dependent variables (Y) will always be numeric. The appropriate chart type depends on (X).", source: "Lesson 3, notes › Charts K3" },
    { term: "Line", text: "Use a line chart when X is numeric, continuous (his example: gold's closing price against the date).", source: "Lesson 3, notes › Charts K6:L6; Line sheet" },
    { term: "Scatter", text: "Use a scatter chart when X is numeric, discrete (his example: number of Nobel prizes against population).", source: "Lesson 3, notes › Charts K8:L8; Scatter sheet" },
    { term: "Bar", text: "Use a bar chart when X is categorical (his example: number of aircraft carriers by country).", source: "Lesson 3, notes › Charts K10:L10; Bar sheet" },
    { term: "Pie", text: "Use a pie chart when X is categorical and also exhaustive, meaning that all data is included (his example: World Cup wins by country).", source: "Lesson 3, notes › Charts K12:O14; Pie sheet" },
    { term: "Not exhaustive → no pie", text: "This list is not exhaustive: it's missing some countries. Therefore a pie chart is not appropriate.", source: "Lesson 3, notes › Bar C12:C16" },
    { term: "All charts must", text: "Have a concise title which briefly explains what the chart shows; axis titles if not obvious; avoid distracting features; be honest!", source: "Lesson 3, notes › Charts K15:L23" },
    { term: "The six charts (key fact)", text: "We have 6 charts: pie, bar, line, scatter, histogram, boxplot. Know which chart is appropriate from the context, present it properly, and edit it with the Select Data button. (Histograms and boxplots come in later lessons.)", source: "Midterm 1 announcement (Spring 2026)" },
  ],
  examples: [
    {
      title: "World Cup wins: pie (and bar)",
      setup: "His Pie sheet lists every country that has won the World Cup and its number of wins. Which chart, and what does each slice show?",
      table: { head: ["Country", "Wins"], rows: [["Spain", 1], ["Argentina", 3], ["Brazil", 5], ["France", 2], ["England", 1], ["Germany", 4], ["Italy", 4], ["Uruguay", 2]] },
      steps: [
        { say: "X is the country: categorical. Y is the number of wins: numeric." },
        { say: "Every World Cup winner is in the list, so X is exhaustive: a pie chart fits. He drew it titled \"World cup wins by country\" (and also a bar chart, which works for any categorical X)." },
        { say: "Total number of World Cups won (the whole pie)", formula: "=SUM(C3:C10)", result: "22" },
        { say: "Brazil's slice as a share of the pie", formula: "=C5/SUM($C$3:$C$10)", result: "0.227272727 (22.7%)" },
      ],
      takeaway: "Categorical and exhaustive: pie. Categorical but not exhaustive (his aircraft carriers: USA 11, China 3, India 2, France 1, Russia 1): bar only.",
      source: "Lesson 3, notes › Pie, Bar",
    },
    {
      title: "Nobel prizes against population: scatter",
      setup: "\"How does a country's population affect the number of Nobel prizes awarded?\"",
      table: { head: ["Country", "Population (millions)", "Number of Nobel prizes"], rows: [["US", 342, 425], ["UK", 69, 144], ["Germany", 84, 116], ["France", 69, 78], ["Sweden", 10, 34], ["Japan", 124, 33], ["Russia", 141, 30], ["Canada", 41, 29], ["Switzerland", 9, 27]] },
      steps: [
        { say: "Dependent variable = number of Nobel prizes (it depends on population), so it goes on the vertical axis." },
        { say: "Independent variable = population, on the horizontal axis. It is numeric, so the choice is line or scatter; his table says scatter for a discrete numeric X." },
        { say: "Select F10:G19 and insert a scatter chart; add the axis titles \"Population\" and \"Number of Nobel prizes\"." },
      ],
      takeaway: "Say which variable depends on which before you insert anything: that fixes the axes.",
      source: "Lesson 3, notes › Scatter",
    },
    {
      title: "Gold price over time: line",
      setup: "His Line sheet has the monthly closing price of gold from August 2022 to January 2026.",
      table: { head: ["Date", "Close"], rows: [["Aug 2022", 1726.2], ["Sep 2022", 1672], ["Oct 2022", 1640.7], ["…", "…"], ["Dec 2025", 4341.1], ["Jan 2026", 5082.6]] },
      steps: [
        { say: "Independent variable = date; dependent variable = closing price (his labels on the sheet)." },
        { say: "Date is numeric and continuous, so a line chart. He titled it \"Gold price per ounce\"." },
      ],
      takeaway: "Time across the bottom, joined up: line chart.",
      source: "Lesson 3, notes › Line",
    },
  ],
  quiz: [
    { q: "On a chart, which variable is typically drawn on the horizontal axis?", options: ["Independent", "Dependent"], answer: 0, why: "The convention is to plot dependent variables vertically and independent horizontally (Spring 2026 Exam 1 Q3)." },
    { q: "Your score on an exam and how many hours you studied: which is the dependent variable?", options: ["Hours studied", "Score on the exam", "Neither: both are independent", "It depends on the chart"], answer: 1, why: "The score depends on the hours studied, so score (Y) is dependent and hours (X) independent. His own example." },
    { q: "According to his notes, what decides the appropriate chart type?", options: ["The dependent variable (Y)", "The independent variable (X)", "How many rows of data there are", "Whichever chart looks best"], answer: 1, why: "Our dependent variables (Y) will always be numeric. The appropriate chart type depends on (X)." },
    { q: "X is categorical but the list is missing some categories (e.g. aircraft carriers for five countries). Which chart?", options: ["Pie", "Bar", "Line", "Scatter"], answer: 1, why: "Categorical but not exhaustive, so a pie chart is not appropriate: bar." },
    { q: "X is categorical and exhaustive (all data included), e.g. the percentage of your grade from each form of assessment. Which chart does his table name?", options: ["Pie", "Line", "Scatter", "Histogram"], answer: 0, why: "Pie: X is categorical and also exhaustive. (Homework 2 Q3 asks for exactly this pie chart.)" },
    { q: "The closing price of gold each month for three years. Which chart?", options: ["Bar", "Pie", "Line", "Scatter"], answer: 2, why: "X is a date, numeric and continuous: line. His gold-price example." },
    { q: "For 120 countries you have population and number of Olympic medals, and want to show how medals depend on population. Which chart?", options: ["Line", "Scatter", "Pie", "Bar"], answer: 1, why: "A numeric X with one point per country: scatter, as in Spring 2026 Exam 1 Q3's key." },
    { q: "Crypto holdings: Bitcoin, Ethereum, Tether, XRP, BNB and Other. Why is a pie chart fine here?", options: ["There are fewer than ten coins", "The \"Other\" row makes the list exhaustive", "The values are in dollars", "Pie charts are always fine for money"], answer: 1, why: "A pie needs X categorical and exhaustive; \"Other\" includes everything else (Spring 2026 Exam 1 Q2)." },
    { q: "Which is NOT one of his rules that all charts must follow?", options: ["Have a concise title", "Axis titles if not obvious", "Use 3-D effects so it stands out", "Be honest"], answer: 2, why: "All charts must avoid distracting features; 3-D effects are exactly that." },
  ],
  excel: [
    { fn: "Insert › Charts", use: "Select the X and Y columns (with headers) and insert a Pie, Bar (column), Line or Scatter chart." },
    { fn: "Chart title and axis titles", use: "Chart Elements (+): a concise title always; axis titles unless obvious; legend when there are several series." },
    { fn: "Select Data", use: "Fix which columns are the series and which are the horizontal axis labels (named in the Midterm 1 announcement (Spring 2026))." },
    { fn: "SUMIF / COUNTIF", use: "Build your own summary table first when the data are raw rows: =SUMIF($W$7:$W$26,AA21,$V$7:$V$26) (Fall 2025 Exam 1 Q1(d))." },
    { fn: "Shares and % change", use: "Share of a pie: =C5/SUM($C$3:$C$10). Percentage change: =(E9/E$8)-1, formatted as a percentage." },
  ],
  watch: [
    "Spring 2026 Exam 1 \"Charts\": Q1 market cap of seven companies by year → line; Q2 crypto holdings with an \"Other\" row → pie; Q3 medals against population → scatter. Quick question 3: the horizontal axis holds the independent variable.",
    "Fall 2026 Exam 1: Q1 a chart with two separate lines for revenue and cost (0 to 4000 coffees), and Q3 \"a single chart which appropriately displays\" the men/women by video type table → his key is one clustered bar chart, not two charts.",
    "Fall 2025 Exam 1: Q1(b) line chart of the percentage change of three stocks (after Q1(a) =(E9/E$8)-1); Q1(c) scatter of employees against market cap; Q1(d) build an industry table with SUMIF, then chart it (his key shows a pie and a bar).",
    "Homework 2 Charts: commodity prices over time → line; earnings against IQ → scatter; percentage of grade by assessment → pie; top 20 college endowments → bar (color-coded private vs public).",
    "Lost marks come from presentation: no title, no axis titles, a legend saying \"Series1\", 3-D or other distracting features. A pie for a non-exhaustive list is wrong.",
    "Time on the X axis (dates, months, years) → line, even though a year looks like a whole number; pairs of measurements for separate items (countries, companies, people) → scatter.",
  ],
  makers: [choose, pie, summary, line],
};
