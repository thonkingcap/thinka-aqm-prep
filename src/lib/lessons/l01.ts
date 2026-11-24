// Lesson 1: Welcome (Mon 31 Aug). Data, variables and the types of data, from "Class 1 notes".
import { Sheet, int, pick, shuffle, round, TOP, type BlockMaker, type Block, type Rng, type Trap } from "./kit.ts";
import type { Lesson } from "./types.ts";

const TYPES = ["Categorical", "Numeric"];
const SUBS = ["Nominal", "Ordinal", "Discrete", "Continuous"];

/** Drop traps that equal the right answer (they would be flagged as too close). */
const keep = (answer: number, traps: Trap[]) => traps.filter((t) => Number.isFinite(t.value) && Math.abs(t.value - answer) > 1e-9);

type Var = { name: string; data: string; sub: "Nominal" | "Ordinal" | "Discrete" | "Continuous"; why: string };
const typeOf = (v: Var) => (v.sub === "Nominal" || v.sub === "Ordinal" ? "Categorical" : "Numeric");

// Only variables his notes classify (or that follow his definitions with no room for doubt).
const POOL: Record<Var["sub"], Var[]> = {
  Discrete: [
    { name: "Number of pets", data: "2", sub: "Discrete", why: "a count: you can't have 2.5 pets, so there are gaps (his own example)" },
    { name: "Population of a country", data: "342000000", sub: "Discrete", why: "a count of people, so it can't be subdivided (his own example)" },
    { name: "Number of items in an online order", data: "3", sub: "Discrete", why: "a count of items, so there are gaps between the possible values" },
    { name: "Number of employees at a company", data: "1250", sub: "Discrete", why: "a count of people, so there are gaps between the possible values" },
    { name: "Goals scored in a soccer match", data: "4", sub: "Discrete", why: "a count of goals, so there are gaps between the possible values" },
    { name: "Number of aircraft carriers a navy has", data: "11", sub: "Discrete", why: "a count, so there are gaps between the possible values" },
  ],
  Continuous: [
    { name: "Length of a room (m)", data: "25.1240117", sub: "Continuous", why: "a measurement that can be subdivided again and again (his example: dimensions of a room)" },
    { name: "Average daily screen time (hours)", data: "4.3172", sub: "Continuous", why: "a measurement of time, which can be subdivided again and again (his example: avg screen time)" },
    { name: "Weight of a parcel (kg)", data: "2.4183", sub: "Continuous", why: "a measurement that can in theory be subdivided again and again" },
    { name: "Time taken to deliver an order (hours)", data: "31.725", sub: "Continuous", why: "a measurement of time, which can in theory be subdivided again and again" },
    { name: "Height of a student (cm)", data: "172.384", sub: "Continuous", why: "a measurement that can in theory be subdivided again and again" },
  ],
  Nominal: [
    { name: "US State you are from", data: "Ohio", sub: "Nominal", why: "just a name, with no order (his own example)" },
    { name: "Favorite sport", data: "Taekwondo", sub: "Nominal", why: "just a name, with no order (his own example)" },
    { name: "Payment method", data: "Paypal", sub: "Nominal", why: "just a name, with no order" },
    { name: "Favorite ice cream", data: "Cookie dough", sub: "Nominal", why: "just a name, with no order" },
    { name: "Intended occupation", data: "Professor", sub: "Nominal", why: "just a name, with no order" },
    { name: "Product bought", data: "Book", sub: "Nominal", why: "just a name, with no order" },
  ],
  Ordinal: [
    { name: "Month of purchase", data: "March", sub: "Ordinal", why: "a name with an implicit order: January comes before February (his own example)" },
    { name: "Survey response", data: "Strongly agree", sub: "Ordinal", why: "words with an implicit ranking: strongly agree, agree, don't agree (his own example)" },
    { name: "T-shirt size", data: "XL", sub: "Ordinal", why: "words with an implicit ranking: S < M < L < XL" },
    { name: "Class year", data: "Sophomore", sub: "Ordinal", why: "words with an implicit order: first-year, sophomore, junior, senior" },
    { name: "Customer rating", data: "Good", sub: "Ordinal", why: "words with an implicit ranking: poor, fair, good, excellent" },
  ],
};

const classify: BlockMaker = {
  key: "l1.types",
  title: "Classify variables: categorical or numeric, then nominal, ordinal, discrete or continuous",
  make(rng): Block {
    const chosen = shuffle(rng, SUBS.flatMap((s) => shuffle(rng, POOL[s as Var["sub"]]).slice(0, 2)));
    const S = new Sheet();
    S.header(`B${TOP}`, "Variable").header(`C${TOP}`, "One instance (data)").header(`D${TOP}`, "Categorical or Numeric?").header(`E${TOP}`, "Nominal, Ordinal, Discrete or Continuous?");
    chosen.forEach((v, i) => {
      const r = TOP + 1 + i;
      S.label(`B${r}`, v.name).given(`C${r}`, v.data);
      const t = typeOf(v);
      S.parts.push({
        label: `${v.name}: categorical or numeric`, cell: `D${r}`, answer: t, options: TYPES, formula: `"${t}"`,
        explain: t === "Numeric" ? `${v.name} is a number, so it is numeric (quantitative).` : `${v.name} is words or names, so it is categorical.`,
      });
      S.parts.push({
        label: `${v.name}: nominal, ordinal, discrete or continuous`, cell: `E${r}`, answer: v.sub, options: SUBS, formula: `"${v.sub}"`,
        explain: `${v.sub}: ${v.why}.`,
      });
    });
    return {
      tab: "Types of data", title: "What type of data is it?",
      text: [
        "Each row is a variable (a quantity or attribute you are interested in) with one instance of its data.",
        "In column D type Categorical or Numeric. In column E type the finer type: Nominal or Ordinal for categorical data, Discrete or Continuous for numeric data.",
        "Numeric data is a number; categorical data is simply words or names.",
      ],
      cells: S.cells, parts: S.parts,
      colWidths: [3, 38, 22, 24, 40],
    };
  },
};

const FIRST = ["Ava", "Ben", "Chloe", "Diego", "Emma", "Farah", "Gus", "Hana", "Isaac", "Jade", "Kofi", "Lena", "Mateo", "Nora", "Omar", "Priya",
  "Quinn", "Rosa", "Sam", "Tara", "Uma", "Victor", "Wen", "Ximena", "Yusuf", "Zoe", "Arjun", "Bella", "Caleb", "Daria", "Eli", "Fiona", "Grace", "Hugo", "Ines", "Jonah", "Kira", "Liam"];
const STATES: { s: string; w: number; lo: number; hi: number }[] = [
  { s: "Massachusetts", w: 5, lo: 3, hi: 95 },
  { s: "New York", w: 3, lo: 150, hi: 320 },
  { s: "California", w: 2, lo: 2600, hi: 3100 },
  { s: "Texas", w: 2, lo: 1550, hi: 2000 },
  { s: "Florida", w: 2, lo: 1150, hi: 1450 },
  { s: "International", w: 2, lo: 3200, hi: 7500 },
];
const SPORTS = ["Soccer", "Basketball", "Tennis", "Taekwondo", "Swimming", "Running"];
function weighted<T extends { w: number }>(rng: Rng, xs: T[]): T {
  const tot = xs.reduce((s, x) => s + x.w, 0);
  let u = rng() * tot;
  for (const x of xs) { u -= x.w; if (u < 0) return x; }
  return xs[xs.length - 1];
}

const survey: BlockMaker = {
  key: "l1.survey",
  title: "A class survey: count with COUNTA and COUNTIF, and name each variable's type",
  make(rng): Block {
    const n = int(rng, 24, 36);
    const names = shuffle(rng, FIRST).slice(0, n);
    const rows = names.map((nm) => {
      const st = weighted(rng, STATES);
      const miles = round(st.lo + (st.hi - st.lo) * rng(), 1);
      const u = rng();
      const pets = u < 0.33 ? 0 : u < 0.62 ? 1 : u < 0.82 ? 2 : u < 0.94 ? 3 : 4;
      return [nm, st.s, miles, pets, pick(rng, SPORTS)] as [string, string, number, number, string];
    });
    const S = new Sheet();
    const T = S.table("B", TOP, ["Student", "Home state", "Miles from home", "Number of pets", "Favorite sport"], rows);
    const R = (h: string) => T.cols[h].range;
    const present = (j: number) => [...new Set(rows.map((r) => r[j] as string))];
    const state = pick(rng, present(1));
    const sport = pick(rng, present(4));
    const k = pick(rng, [1, 2]);
    const M = pick(rng, [100, 500, 1000, 2000]);
    const cnt = (f: (r: (typeof rows)[number]) => boolean) => rows.filter(f).length;

    const q = TOP;
    S.header(`H${q}`, "Question").header(`I${q}`, "Your answer");
    const ask = (i: number, p: Parameters<Sheet["ask"]>[1]) => S.ask(`H${q + 1 + i}`, { ...p, cell: `I${q + 1 + i}` });
    ask(0, {
      label: "Number of students in the survey", cell: "", answer: n, tol: 0,
      formula: `=COUNTA(${R("Student")})`,
      explain: "COUNTA counts the non-empty cells, so it works on a column of names. (COUNT only counts numbers.)",
      traps: [{ value: n + 1, why: "Included the header cell in the range." }, { value: 0, why: "Used COUNT on a column of names: COUNT ignores text." }],
    });
    ask(1, {
      label: `Number of students from ${state}`, cell: "", answer: cnt((r) => r[1] === state), tol: 0,
      formula: `=COUNTIF(${R("Home state")},"${state}")`,
      explain: "COUNTIF(range, criterion) counts the cells in the range that match; text criteria go in quotes.",
    });
    ask(2, {
      label: `Number whose favorite sport is ${sport}`, cell: "", answer: cnt((r) => r[4] === sport), tol: 0,
      formula: `=COUNTIF(${R("Favorite sport")},"${sport}")`,
      explain: "Count the matching names with COUNTIF.",
    });
    const zero = cnt((r) => r[3] === 0);
    ask(3, {
      label: "Number of students with no pets", cell: "", answer: zero, tol: 0,
      formula: `=COUNTIF(${R("Number of pets")},0)`,
      explain: "A number criterion needs no quotes: COUNTIF(range, 0).",
    });
    const more = cnt((r) => r[3] > k), atLeast = cnt((r) => r[3] >= k);
    ask(4, {
      label: `Number of students with more than ${k} pet${k > 1 ? "s" : ""}`, cell: "", answer: more, tol: 0,
      formula: `=COUNTIF(${R("Number of pets")},">${k}")`,
      explain: `"More than ${k}" is the criterion ">${k}", in quotes because it contains an operator.`,
      traps: keep(more, [{ value: atLeast, why: `Used ">=${k}": that also counts students with exactly ${k}.` }]),
    });
    const far = cnt((r) => r[2] > M);
    ask(5, {
      label: `Number living more than ${M} miles from home`, cell: "", answer: far, tol: 0,
      formula: `=COUNTIF(${R("Miles from home")},">${M}")`,
      explain: `Criterion ">${M}" counts the cells holding a number bigger than ${M}.`,
      traps: keep(far, [{ value: n - far, why: `Counted the students within ${M} miles instead.` }]),
    });
    ask(6, {
      label: "Miles from home: Categorical or Numeric?", cell: "", answer: "Numeric", options: TYPES, formula: `"Numeric"`,
      explain: "Miles from home is a number, so it is numeric (one of his own examples).",
    });
    ask(7, {
      label: "Number of pets: Discrete or Continuous?", cell: "", answer: "Discrete", options: SUBS, formula: `"Discrete"`,
      explain: "Number of pets can't be subdivided (no 1.5 pets): discrete numeric, his own example.",
    });
    ask(8, {
      label: "Favorite sport: Nominal or Ordinal?", cell: "", answer: "Nominal", options: SUBS, formula: `"Nominal"`,
      explain: "A sport is just a name with no order: nominal categorical, his own example.",
    });
    return {
      tab: "Class survey", title: "A class survey",
      text: [
        `${n} students answered a short survey on the first day of class. Each column is a variable; each row holds one student's data.`,
        "Answer the yellow cells with Excel formulas that point at the table (COUNTA, COUNTIF), and type the type of data for the last three.",
      ],
      cells: S.cells, parts: S.parts,
      manual: ["Try Excel as a calculator in an empty cell: =2+2, =2*2 and =2^2 all show 4. Every formula starts with =."],
      colWidths: [3, 12, 16, 16, 15, 16, 3, 44, 14],
    };
  },
};

export const LESSON_01: Lesson = {
  n: 1,
  title: "Welcome: data, variables and types of data",
  unit: 1,
  week: "Week 1 · Mon 31 Aug · Welcome",
  sources: ["Class 1 notes.xlsx", "F25_Exam1_solutions.xlsx"],
  summary:
    "The first class sets up the language of the whole course: a variable is something you are interested in, and data are instances of it. Every later choice (which chart to draw, which measure to compute) starts with knowing whether your data are categorical or numeric, and of which kind.",
  defs: [
    { term: "Data", text: "What is data? It literally could be anything.", source: "Class 1 notes › Notes again B3" },
    { term: "Variable", text: "A variable is a quantity or attribute you are interested in. Examples: nation/state you're from, miles from home, favorite color, sport, intended occupation, pen type.", source: "Class 1 notes › Notes again B5:K8" },
    { term: "Data (instances)", text: "Data is/are instances of a particular variable. Examples: UK (nation), 3900 (miles from home), Indigo (favorite color), Taekwondo (sport), Professor (intended occupation).", source: "Class 1 notes › Notes again B9:K12" },
    { term: "Two types of data", text: "There are two types of data: numeric/quantitative and categorical.", source: "Class 1 notes › Notes again B15" },
    { term: "Numeric (quantitative)", text: "Data which is a number. Examples: miles from home, rating, screen time.", source: "Class 1 notes › Notes again C17:E18" },
    { term: "Discrete numeric", text: "The numbers cannot be subdivided (there are gaps). Examples: number of pets, population.", source: "Class 1 notes › Notes again K17:L18" },
    { term: "Continuous numeric", text: "Numbers which theoretically can be subdivided again and again. Examples: dimensions of a room (25.1240117), miles from home, average screen time.", source: "Class 1 notes › Notes again K19:K20" },
    { term: "Categorical", text: "Simply words or names. Examples: day of the week born, yes/no response, food.", source: "Class 1 notes › Notes again C21:E22" },
    { term: "Ordinal", text: "A word/name which has an implicit order/ranking. Examples: month; survey responses (strongly agree, agree, don't agree, etc.).", source: "Class 1 notes › Notes again K21:K22" },
    { term: "Nominal", text: "Just a name or a word. Examples: US State, sport.", source: "Class 1 notes › Notes again K23:L24" },
    { term: "It depends on the definition", text: "Many examples depend on how the variable was defined. If you can only answer number of miles to 1 d.p. then in a sense this is now discrete.", source: "Class 1 notes › Notes again B25:B26" },
    { term: "Excel as a calculator", text: "A formula starts with = and uses + − * / and ^ for powers: =2+2, =2*2 and =2^2 all give 4.", source: "Class 1 notes › Sheet1 C5:C9" },
  ],
  examples: [
    {
      title: "Variables and their data, classified",
      setup: "In class he listed variables the students might be interested in, with one instance of data for each. Classify each one.",
      table: {
        head: ["Variable", "Data", "Type"],
        rows: [
          ["Nation/State you're from", "UK", "Categorical, nominal"],
          ["Miles from home", 3900, "Numeric, continuous"],
          ["Favorite color", "Indigo", "Categorical, nominal"],
          ["Sport", "Taekwondo", "Categorical, nominal"],
          ["Intended occupation", "Professor", "Categorical, nominal"],
          ["Number of pets", "(e.g. 2)", "Numeric, discrete"],
          ["Month", "(e.g. March)", "Categorical, ordinal"],
        ],
      },
      steps: [
        { say: "First ask: is the data a number? 3900 miles is a number, so miles from home is numeric. UK, Indigo, Taekwondo and Professor are words, so those variables are categorical." },
        { say: "For numeric data ask: can it be subdivided again and again? Distance can (3900.37… miles), so it is continuous. Number of pets has gaps (no 2.5 pets), so it is discrete." },
        { say: "For categorical data ask: is there an implicit order? Months have one (January, February, …), so month is ordinal. Sports and states don't, so they are nominal." },
        { say: "Remember his note: it depends on how the variable is defined. If miles can only be answered to 1 d.p. it is, in a sense, discrete." },
      ],
      takeaway: "Number or words first (numeric or categorical), then gaps or not (discrete or continuous), order or not (ordinal or nominal).",
      source: "Class 1 notes › Notes again",
    },
    {
      title: "Excel is a calculator",
      setup: "In the very first sheet he typed three formulas into cells.",
      steps: [
        { say: "Add", formula: "=2+2", result: "4" },
        { say: "Multiply", formula: "=2*2", result: "4" },
        { say: "Power (2 squared)", formula: "=2^2", result: "4" },
      ],
      takeaway: "Every formula begins with =; ^ raises to a power.",
      source: "Class 1 notes › Sheet1 C5:C9",
    },
    {
      title: "An exam question on data types",
      setup: "Fall 2025 Exam 1, Part 3: tick every type that applies. (a) A list of students' names. (b) A list of students' dates of birth. Options: Numeric, Quantitative, Categorical, Ordinal, Nominal.",
      steps: [
        { say: "(a) Names are words with no order: his key ticks Categorical and Nominal." },
        { say: "(b) Dates of birth: his key ticks Categorical and Ordinal (dates have a natural order, like his month example)." },
      ],
      takeaway: "On his multiple-choice data-type questions more than one box can be right: tick the main type and the finer type.",
      source: "F25_Exam1_solutions › Part 3 Q3(a)–(b)",
    },
  ],
  quiz: [
    { q: "In his notes, what is a variable?", options: ["A quantity or attribute you are interested in", "Any number stored in a cell", "A value that changes when you press F9", "The vertical axis of a chart"], answer: 0, why: "His definition: a variable is a quantity or attribute you are interested in." },
    { q: "\"Indigo\" is an answer to the variable \"favorite color\". In his language, Indigo is…", options: ["a variable", "data: an instance of the variable", "an ordinal variable", "a formula"], answer: 1, why: "Data is/are instances of a particular variable. Favorite color is the variable; Indigo is one instance of it." },
    { q: "Number of pets is…", options: ["Numeric, discrete", "Numeric, continuous", "Categorical, ordinal", "Categorical, nominal"], answer: 0, why: "It's a number with gaps (no 2.5 pets): discrete numeric, one of his examples." },
    { q: "The dimensions of a room (e.g. 25.1240117 m) are…", options: ["Numeric, discrete", "Numeric, continuous", "Categorical, nominal", "Categorical, ordinal"], answer: 1, why: "Continuous numeric: numbers which theoretically can be subdivided again and again. This is his own example." },
    { q: "Survey responses \"Strongly agree, agree, don't agree\" are…", options: ["Nominal", "Ordinal", "Discrete", "Continuous"], answer: 1, why: "Ordinal: a word/name with an implicit order or ranking. This is his example." },
    { q: "Which of these is nominal data?", options: ["US State", "Month", "Number of pets", "Screen time"], answer: 0, why: "Nominal: just a name or a word, with no order. US State is his example; month is ordinal; the other two are numeric." },
    { q: "Miles from home is continuous, but a survey only lets you answer to 1 decimal place. According to his note…", options: ["It becomes categorical", "In a sense it is now discrete", "It is still continuous in every sense", "It can't be used as data"], answer: 1, why: "His N.b.: many examples depend on how the variable was defined; if you can only answer to 1 d.p. then in a sense it is now discrete." },
    { q: "Fall 2025 Exam 1 asked what type of data a list of students' dates of birth is. His key ticked…", options: ["Numeric and Quantitative", "Categorical and Ordinal", "Categorical and Nominal", "Quantitative only"], answer: 1, why: "His solution ticks Categorical and Ordinal: dates have a natural order, like months." },
    { q: "Which formula gives 2 squared?", options: ["=2^2", "=2*2*2", "2^2", "=SQRT(2)"], answer: 0, why: "^ is the power operator, and every formula must begin with =. (=2*2 also gives 4, but =2*2*2 is 8.)" },
  ],
  excel: [
    { fn: "= + − * / ^", use: "Excel as a calculator: =2+2, =2*2, =2^2. Every formula starts with =." },
    { fn: "COUNTA", use: "Counts non-empty cells, e.g. how many names are in a list (COUNT only counts numbers)." },
    { fn: "COUNTIF", use: "Counts cells meeting a condition: =COUNTIF(C9:C38,\"Texas\") or =COUNTIF(E9:E38,\">2\"). Formally taught in Lesson 2." },
  ],
  watch: [
    "Fall 2025 Exam 1 Part 3 Q3(a)–(b) asked for data types as multiple choice with several correct boxes: names were Categorical + Nominal, dates of birth Categorical + Ordinal. Tick the main type and the finer type.",
    "Fall 2025 Exam 1 Part 3 Q3(e)–(f) tied data type to measures: ‘the mean can only be defined for numerical data’ is True, and ‘the mode can only be defined for numerical data’ is False (categories have a mode too). You meet the measures in Lesson 4.",
    "The Lesson 2 exercise asked \"Categorical or quantitative?\" for each column of an online-sales table, so quantitative = numeric in his language.",
    "The type of the independent variable decides the chart in Lesson 3 (categorical → bar or pie, numeric → line or scatter), so this classification comes back on every exam's chart question.",
    "Classic slip: calling ordinal data (months, survey ratings, sizes) nominal. If the words have a natural order, it's ordinal.",
  ],
  makers: [classify, survey],
};
