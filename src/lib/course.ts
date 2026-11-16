// AQM 1000 Midterm 2 content, written from the Lesson 12–17 notes and the in-class whiteboard.
// Worked examples use the class's own numbers; every value is computed live by src/lib/excel.ts.

export type Step = { label: string; formula: string; note?: string; format?: "prob" | "num" | "pct" };
export type Example = { title: string; source: string; setup: string; data?: number[]; steps: Step[]; conclusion: string };
export type Formula = { label: string; math: string; excel: string };
export type Topic = {
  id: string;
  title: string;
  lesson: string;
  summary: string;
  /** The lesson in plain English: the idea, an everyday comparison, and what you actually do in Excel. */
  plain?: { idea: string; like: string; doThis: string[] };
  notes: { heading: string; body: string }[];
  formulas: Formula[];
  example?: Example;
  pitfalls: string[];
};

const L16_RNG = [80, 80, 83, 80, 79, 79, 80, 81];
const L14_ORDERS = [884, 645, 248, 648, 569, 1024, 945, 399, 871, 685];
const L15_T = [5, 4, 5, 5, 3, 3, 1];
const L17_CEREAL = [10.1, 9.8, 9.7, 9.1, 10.2];
const L18_VAR = [-1.939079083967954, -0.37007680475653615, -0.4816070031665731, -1.0269309314026032, -0.46645709517179057, 0.8394863471039571, 1.0074245437863283, -0.05828610483149532, -0.9869245332083665, -0.8156757758115418];
const L18_X = [7.531012922991067, 9.475853655894753, 11.035000423144083, 11.113176040234976, 9.880185441725189, 9.681792814953951, 9.469259819306899, 10.76589458331, 8.859839251963422, 10.26963789423462];
const L18_Y = [8.099989054229809, 7.424127625185065, 8.305907749658218, 7.612897798011545, 8.796065139889834, 8.19695483185933, 10.033956777973799, 7.920998223184142, 8.763380174044869, 8.796689280628925];
const PAIRED_E1 = [72, 65, 80, 58, 90, 77, 69];
const PAIRED_E2 = [78, 70, 79, 66, 93, 80, 75];
const PAIRED_D = PAIRED_E2.map((x, i) => x - PAIRED_E1[i]);
const list = (xs: number[]) => xs.join(",");
const short = (xs: number[]) => xs.map((x) => x.toFixed(3)).join(", ");

export const TOPICS: Topic[] = [
  {
    id: "normal",
    title: "The normal curve and Z-scores",
    lesson: "Lesson 12",
    summary: "Most things (heights, times, scores) bunch up around an average and thin out on both sides. Excel tells you the chance of landing in a range, or which value cuts off the top or bottom slice.",
    plain: {
      idea: "The bell curve shows how likely each value is. The area under the curve over a stretch is the chance of landing in that stretch.",
      like: "Picture a pile of sand shaped like a bell. The share of sand sitting over part of the ground is the chance a value lands there.",
      doThis: ["Chance of LESS than a number: `NORM.DIST(number, mean, sd, TRUE)`", "Chance of MORE than it: `1 - NORM.DIST(…)`", "The value that cuts off the top 10%: `NORM.INV(0.9, mean, sd)`"],
    },
    notes: [
      {
        heading: "Area = chance",
        body: "The curve is centred on the average, μ (\"mu\"). How wide it is depends on the standard deviation, σ (\"sigma\"): how spread out the values are. All the area under the curve adds up to 1 (100%). The area over a stretch is the chance of landing there. Here, \"less than\" and \"less than or equal to\" give the same answer.",
      },
      {
        heading: "Two Excel tools, opposite jobs",
        body: "Have a value and want a chance? Use `NORM.DIST`. Have a chance and want a value? Use `NORM.INV`. Both always talk about the area to the LEFT of the value.",
      },
      {
        heading: "Turning the words into Excel",
        body: "Less than a: `NORM.DIST(a, μ, σ, TRUE)`. More than a: `1 - NORM.DIST(a, μ, σ, TRUE)`. Between a and b: `NORM.DIST(b, …) - NORM.DIST(a, …)`. Top 10%: the value with 90% below it, `NORM.INV(0.9, μ, σ)`. Bottom 10%: `NORM.INV(0.1, μ, σ)`. Middle 50%: `NORM.INV(0.25, …)` to `NORM.INV(0.75, …)`.",
      },
      {
        heading: "Z-scores",
        body: "A z-score says how many standard deviations a value is above (positive) or below (negative) the average: z = (x − μ) / σ. So z = 2 means \"two spreads above average\". For z-scores Excel has `NORM.S.DIST(z, TRUE)` and `NORM.S.INV(p)` (the S means a curve with average 0 and spread 1). Rule of thumb: about 68% of values are within 1 sd of the average, 95% within 2 and 99.7% within 3.",
      },
    ],
    formulas: [
      { label: "P(X < a)", math: "area left of a", excel: "=NORM.DIST(a, μ, σ, TRUE)" },
      { label: "P(X > a)", math: "1 − area left of a", excel: "=1-NORM.DIST(a, μ, σ, TRUE)" },
      { label: "P(a < X < b)", math: "difference of two areas", excel: "=NORM.DIST(b,μ,σ,TRUE)-NORM.DIST(a,μ,σ,TRUE)" },
      { label: "Value with p to its left", math: "percentile", excel: "=NORM.INV(p, μ, σ)" },
      { label: "Z-score", math: "z = (x − μ) / σ", excel: "=(x-μ)/σ" },
      { label: "Standard normal", math: "Z ~ N(0, 1)", excel: "=NORM.S.DIST(z,TRUE)   =NORM.S.INV(p)" },
    ],
    example: {
      title: "Download times",
      source: "Lesson 12, Normal sheet",
      setup: "The time X to download an image is normal with mean 18.0 seconds and standard deviation 5.0 seconds.",
      steps: [
        { label: "P(X < 15)", formula: "=NORM.DIST(15,18,5,TRUE)", format: "prob" },
        { label: "P(X > 25)", formula: "=1-NORM.DIST(25,18,5,TRUE)", format: "prob" },
        { label: "P(16 < X < 20)", formula: "=NORM.DIST(20,18,5,TRUE)-NORM.DIST(16,18,5,TRUE)", format: "prob" },
        { label: "Time by which 90% are downloaded", formula: "=NORM.INV(0.9,18,5)", note: "seconds" },
        { label: "Bottom 10% finish within", formula: "=NORM.INV(0.1,18,5)", note: "seconds" },
      ],
      conclusion: "90% of images download within about 24.4 seconds; the fastest 10% take under about 11.6 seconds.",
    },
    pitfalls: [
      "The last argument must be TRUE. FALSE gives the curve's height, not a chance.",
      "\"Top 10%\" means 0.9 goes into NORM.INV, not 0.1.",
      "For \"more than\", don't forget the 1 − ….",
    ],
  },
  {
    id: "clt",
    title: "Sampling distributions and the CLT",
    lesson: "Lessons 12–14",
    summary: "An average of several values bounces around much less than a single value does. How much less? Divide the spread by √n.",
    plain: {
      idea: "If you average n values, that average changes from sample to sample, but much less than one value does. Its spread is σ/√n, called the standard error.",
      like: "One student's height varies a lot. The average height of a class of 30 barely changes from one class to the next.",
      doThis: ["Question about ONE item: use σ", "Question about the AVERAGE of n items: use `σ/SQRT(n)` instead", "Everything else is the same NORM.DIST or NORM.INV"],
    },
    notes: [
      {
        heading: "Everyone vs the few you measured",
        body: "The population is everyone (or everything) you care about. Its true average μ and spread σ are usually unknown. A sample is the few you actually measure. From it you get the sample average x̄ (\"x-bar\") and the sample spread s. Numbers about the whole population are called parameters; numbers worked out from your sample are called statistics.",
      },
      {
        heading: "The average moves around, but less",
        body: "Take another sample and you'll get a slightly different x̄. Those averages bunch up around the true μ, with a spread of σ/√n. That spread has a name: the standard error (SE). A bigger sample means a smaller SE, so x̄ lands closer to μ.",
      },
      {
        heading: "Why bell curves show up everywhere (the CLT)",
        body: "Even when single values aren't bell-shaped (dice, quiz scores), the averages of big enough samples are close to bell-shaped. That's the Central Limit Theorem (CLT), and it's why NORM.DIST works for averages.",
      },
      {
        heading: "One box vs the average of five",
        body: "P(X < 10.5) is about one box: use σ. P(X̄ < 10.5) is about the average of n boxes: use SE = σ/√n in the same NORM.DIST.",
      },
    ],
    formulas: [
      { label: "Standard error", math: "SE = σ / √n", excel: "=σ/SQRT(n)" },
      { label: "P(X̄ < a)", math: "X̄ ~ N(μ, SE²)", excel: "=NORM.DIST(a, μ, σ/SQRT(n), TRUE)" },
      { label: "Z-score of a sample mean", math: "Z = (x̄ − μ) / (σ/√n)", excel: "=(x̄-μ)/(σ/SQRT(n))" },
    ],
    example: {
      title: "Cereal boxes",
      source: "Lesson 13, Confidence interval sheet",
      setup: "A machine fills boxes with X ~ N(11, 0.5²) ounces. You weigh n = 5 boxes.",
      steps: [
        { label: "Standard error", formula: "=0.5/SQRT(5)", note: "ounces" },
        { label: "P(X̄ < 10.5)", formula: "=NORM.DIST(10.5,11,0.5/SQRT(5),TRUE)", format: "prob" },
        { label: "Compare: one box, P(X < 10.5)", formula: "=NORM.DIST(10.5,11,0.5,TRUE)", format: "prob" },
        { label: "95% range for x̄, left", formula: "=NORM.INV(0.025,11,0.5/SQRT(5))" },
        { label: "95% range for x̄, right", formula: "=NORM.INV(0.975,11,0.5/SQRT(5))" },
      ],
      conclusion: "One light box is common (about 16%), but an average of five boxes under 10.5 oz is rare (about 1.3%).",
    },
    pitfalls: [
      "Using σ instead of σ/√n when the question is about an average.",
      "Calling x̄ a parameter. It comes from your sample, so it's a statistic.",
    ],
  },
  {
    id: "ci-z",
    title: "Confidence intervals with σ known",
    lesson: "Lessons 13–15",
    summary: "A confidence interval is a range that probably holds the true average: your best guess, plus or minus a margin of error.",
    plain: {
      idea: "You can't know the true average for sure, so you give a range: best guess ± a margin. \"95% confident\" means this method catches the true value 95 times out of 100.",
      like: "A weather forecast: \"70°F, give or take 3\". The \"give or take\" is the margin of error.",
      doThis: ["Margin = `NORM.S.INV(1-α/2) * σ/SQRT(n)`", "Lower = centre − margin, upper = centre + margin", "Centre on μ if it's given (where will x̄ land?), or on x̄ if it isn't (where is μ?)"],
    },
    notes: [
      {
        heading: "Two different questions, don't mix them up",
        body: "A) The true average μ is known: where will a sample average land? Centre on μ: μ ± Z × σ/√n. B) μ is unknown (the usual case): where is the true average? Centre on your sample average x̄: x̄ ± Z × σ/√n. Same width, different centre.",
      },
      {
        heading: "The three levels on the syllabus",
        body: "Level 1: μ and σ are both given, so find where x̄ will land (centre on μ). Level 2: σ is given but μ isn't, so build a range for μ (centre on x̄). Level 3: neither is given, so estimate σ from the data and use T instead of Z (next topic).",
      },
      {
        heading: "How wide? α and the confidence level",
        body: "α (\"alpha\") is the small chance of missing that you accept, and confidence = 1 − α (α = 0.05 gives 95%). The miss is split between the two ends, which is why the formula uses `NORM.S.INV(1-α/2)`: 1.645 for 90%, 1.960 for 95%, 2.576 for 99%. More confidence makes the range wider; a bigger sample makes it narrower.",
      },
      {
        heading: "Saying what it means",
        body: "Say: \"We are 95% confident the true average is between L and U.\" It's not a guarantee. In Lesson 15 the mortar's range was 1.784 to 1.900 miles, and the true average could still have been 2.",
      },
    ],
    formulas: [
      { label: "Critical value", math: "Z_α/2", excel: "=NORM.S.INV(1-α/2)" },
      { label: "Where is μ? (μ unknown)", math: "x̄ ± Z_α/2 · σ/√n", excel: "=x̄-NORM.S.INV(1-α/2)*σ/SQRT(n)" },
      { label: "Where will x̄ land? (μ known)", math: "μ ± Z_α/2 · σ/√n", excel: "=μ+NORM.S.INV(1-α/2)*σ/SQRT(n)" },
    ],
    example: {
      title: "Daily online orders",
      source: "Lesson 14, Confidence int 2",
      setup: "Ten days of orders were sampled. σ = 156 orders a day is known; the true mean is not. Build a 95% interval for μ.",
      data: L14_ORDERS,
      steps: [
        { label: "Sample mean x̄", formula: `=AVERAGE(${list(L14_ORDERS)})`, note: "orders" },
        { label: "Standard error", formula: "=156/SQRT(10)" },
        { label: "Z_α/2 for 95%", formula: "=NORM.S.INV(0.975)" },
        { label: "Lower limit", formula: `=AVERAGE(${list(L14_ORDERS)})-NORM.S.INV(0.975)*156/SQRT(10)` },
        { label: "Upper limit", formula: `=AVERAGE(${list(L14_ORDERS)})+NORM.S.INV(0.975)*156/SQRT(10)` },
      ],
      conclusion: "Point estimate 692 orders; we are 95% confident the true daily average is between about 595 and 789 orders.",
    },
    pitfalls: [
      "Using NORM.S.INV(1-α) for an interval. Intervals have two ends, so use 1-α/2.",
      "Centring on μ when the question says μ is unknown.",
    ],
  },
  {
    id: "t",
    title: "Unknown σ: s, n − 1 and the t-distribution",
    lesson: "Lesson 15",
    summary: "Don't know σ? Estimate it from your data with STDEV.S, and swap Z for T, which leaves a bit more room for error.",
    plain: {
      idea: "When you don't know how spread out the population is, you estimate the spread from your sample. That adds a little uncertainty, so you use the t-curve: a slightly wider bell.",
      like: "You're guessing with less information, so you give yourself a bigger margin.",
      doThis: ["s = `STDEV.S(data)`", "Use `T.INV(1-α/2, n-1)` instead of NORM.S.INV", "Interval: x̄ ± T × s/√n"],
    },
    notes: [
      {
        heading: "Why not knowing σ is a problem",
        body: "The margin of error needs σ, and in real life you rarely know it. So estimate it from your data: s = `STDEV.S(data)`.",
      },
      {
        heading: "Why divide by n − 1",
        body: "Dividing by n makes the spread come out a little too small on average (statisticians call that \"biased\"). Dividing by n − 1 fixes it. `STDEV.S` and `VAR.S` already divide by n − 1, so just use them.",
      },
      {
        heading: "The t-curve",
        body: "T looks like the normal bell but with fatter tails: it leaves more room for extreme values. How fat depends on the degrees of freedom, ν (\"nu\") = n − 1. The bigger the sample, the closer T gets to the normal curve. `T.DIST(t, ν, TRUE)` and `T.INV(p, ν)` work just like NORM.S.DIST and NORM.S.INV, with ν added.",
      },
    ],
    formulas: [
      { label: "Sample standard deviation", math: "s (divides by n − 1)", excel: "=STDEV.S(range)" },
      { label: "Degrees of freedom", math: "ν = n − 1", excel: "=COUNT(range)-1" },
      { label: "Critical value", math: "T_α/2", excel: "=T.INV(1-α/2, n-1)" },
      { label: "Interval for μ", math: "x̄ ± T_α/2 · s/√n", excel: "=x̄-T.INV(1-α/2,n-1)*s/SQRT(n)" },
    ],
    example: {
      title: "Seven observations, 90% interval",
      source: "Lesson 15, T distribution sheet",
      setup: "A random variable is sampled 7 times. σ is unknown. Build a 90% interval for μ.",
      data: L15_T,
      steps: [
        { label: "x̄", formula: `=AVERAGE(${list(L15_T)})` },
        { label: "s", formula: `=STDEV.S(${list(L15_T)})` },
        { label: "T_α/2 with ν = 6", formula: "=T.INV(1-0.1/2,7-1)" },
        { label: "Lower limit", formula: `=AVERAGE(${list(L15_T)})-T.INV(0.95,6)*STDEV.S(${list(L15_T)})/SQRT(7)` },
        { label: "Upper limit", formula: `=AVERAGE(${list(L15_T)})+T.INV(0.95,6)*STDEV.S(${list(L15_T)})/SQRT(7)` },
      ],
      conclusion: "T_α/2 = 1.943 is larger than Z's 1.645, so the interval is wider: the price of not knowing σ.",
    },
    pitfalls: [
      "Using STDEV.P (or dividing by n) instead of STDEV.S.",
      "Using n instead of n − 1 for the degrees of freedom.",
    ],
  },
  {
    id: "ht-logic",
    title: "Hypothesis testing: the logic and the four steps",
    lesson: "Lesson 16",
    summary: "A hypothesis test asks: if nothing special were going on, how surprising would my data be? Very surprising means you stop believing \"nothing special\".",
    plain: {
      idea: "Start by assuming nothing special is going on: that's H₀, the null hypothesis. Work out how likely data like yours would be if H₀ were true: that's the p-value. If it's tiny (below α), you reject H₀.",
      like: "A courtroom: assume innocent (H₀) until the evidence makes that hard to believe. \"Not guilty\" isn't the same as \"proven innocent\", which is why we say \"do not reject\", never \"accept\".",
      doThis: ["Write H₀ (it always has =, ≤ or ≥) and H_A (the claim you want to show)", "Work out the test statistic and the p-value in Excel", "p-value < α → reject H₀ (R); otherwise do not reject (DR)"],
    },
    notes: [
      {
        heading: "The big idea",
        body: "Assume the boring explanation (H₀) is true. Ask: how likely is a result this extreme or more? That chance is the p-value. If it's smaller than α, the result is too surprising to keep believing H₀, so you reject it.",
      },
      {
        heading: "The four steps from class",
        body: "Step 0: pick α (usually 5% or 1%). Step 1: write H₀ and H_A; H₀ always holds the equals sign. Step 2: work out the test statistic and its p-value. Step 3: if p-value < α, reject H₀; otherwise, do not reject H₀.",
      },
      {
        heading: "Which tail? Read the wording",
        body: "\"Different from\", \"changed\": two tails. H₀: μ = μ₀, H_A: μ ≠ μ₀. \"More than\", \"increased\": right tail. H₀: μ ≤ μ₀, H_A: μ > μ₀. \"Less than\", \"decreased\": left tail. H₀: μ ≥ μ₀, H_A: μ < μ₀. The claim you want evidence for goes in H_A. (μ₀, \"mu-nought\", is the number being claimed.)",
      },
      {
        heading: "Z or T?",
        body: "σ given in the question? Use Z = (x̄ − μ₀)/(σ/√n) and the NORM.S functions. Only the data? Work out s and use T = (x̄ − μ₀)/(s/√n) with ν = n − 1 and the T functions.",
      },
      {
        heading: "Saying the decision",
        body: "Say \"reject H₀\" or \"do not reject H₀\", never \"accept H₀\" or \"prove\". Then say it in plain words: \"At the 5% level, there is enough evidence that the average cost is less than $50.\"",
      },
      {
        heading: "No calculators on the exam",
        body: "Every number has to come from Excel. Type formulas that point at the data cells (`=AVERAGE(B2:B11)`), and build later steps from earlier cells, never from rounded numbers you copied by hand.",
      },
    ],
    formulas: [
      { label: "Z-statistic (σ known)", math: "Z = (x̄ − μ₀) / (σ/√n)", excel: "=(x̄-μ₀)/(σ/SQRT(n))" },
      { label: "T-statistic (σ unknown)", math: "T = (x̄ − μ₀) / (s/√n)", excel: "=(x̄-μ₀)/(s/SQRT(n))" },
      { label: "Decision", math: "p-value < α → reject H₀", excel: "compare the p-value cell with α" },
    ],
    example: {
      title: "Is the student's random number generator honest?",
      source: "Lesson 16, Hypothesis testing sheet",
      setup: "A student says these 8 numbers came from N(100, 15²). Test H₀: μ = 100 against H_A: μ ≠ 100 at α = 1%.",
      data: L16_RNG,
      steps: [
        { label: "x̄", formula: `=AVERAGE(${list(L16_RNG)})` },
        { label: "SE = σ/√n", formula: "=15/SQRT(8)" },
        { label: "Z-statistic", formula: `=(AVERAGE(${list(L16_RNG)})-100)/(15/SQRT(8))` },
        { label: "p-value (two tails)", formula: `=2*NORM.S.DIST((AVERAGE(${list(L16_RNG)})-100)/(15/SQRT(8)),TRUE)`, format: "prob", note: "Z is negative, so 2 × the left tail" },
      ],
      conclusion: "p ≈ 0.0002 < 0.01, so we reject H₀. If the student were telling the truth, a sample this extreme would happen about 0.02% of the time.",
    },
    pitfalls: [
      "Forgetting to double the tail on a two-tailed test.",
      "Putting the claim you want to show in H₀. It belongs in H_A.",
      "Writing \"we accept H₀\". Say \"do not reject H₀\".",
    ],
  },
  {
    id: "twelve",
    title: "The 12 hypothesis test questions",
    lesson: "Lessons 16–17 · whiteboard",
    summary: "Every test on the exam is one of 12 combinations: which direction × Z or T × p-value or cut-off. Learn the pattern, not 12 formulas.",
    plain: {
      idea: "Three questions decide the formula. Which direction is the claim (more, less, different)? Is σ given (Z) or not (T)? Do they want a p-value or a critical value (the cut-off)?",
      like: "A menu with three columns: pick one from each and the grid below gives you the exact Excel formula.",
      doThis: ["Direction from the wording: more → right tail, less → left tail, different → two tails", "σ given → NORM.S functions; not given → T functions with n − 1", "Reject when the statistic is past the cut-off, or when p < α: both give the same answer"],
    },
    notes: [
      {
        heading: "Where the twelve come from",
        body: "Pick the null (μ ≤ μ₀ for a right tail, μ = μ₀ for two tails, μ ≥ μ₀ for a left tail). Pick the curve (σ given: Z; not given: T with ν = n − 1). Then answer with either a p-value or a critical value. 3 × 2 × 2 = 12, and the grid gives the formula for each.",
      },
      {
        heading: "The cut-off (critical value) method",
        body: "Instead of a p-value, find where the \"reject\" zone starts and check whether your statistic is past it. Right tail: reject if the statistic is above `NORM.S.INV(1-α)` (or `T.INV(1-α, ν)`). Left tail: reject if it's below `NORM.S.INV(α)` (or `T.INV(α, ν)`), a negative number. Two tails: reject if it's beyond ± `NORM.S.INV(1-α/2)` (or the T version). This always agrees with the p-value method.",
      },
      {
        heading: "The two-tailed p-value depends on the sign",
        body: "The class only uses the left-area functions, so look at the statistic's sign first. Left tail: p = .DIST(stat). Right tail: p = 1 − .DIST(stat). Two tails: if the statistic is negative, p = 2 × .DIST(stat); if positive, p = 2 × (1 − .DIST(stat)). You're doubling the smaller tail, so the answer can never be above 1.",
      },
    ],
    formulas: [
      { label: "Right tail p-value", math: "H₀: μ ≤ μ₀", excel: "=1-NORM.S.DIST(Z,TRUE)  ·  =1-T.DIST(T,ν,TRUE)" },
      { label: "Two tails, statistic < 0", math: "H₀: μ = μ₀", excel: "=2*NORM.S.DIST(Z,TRUE)  ·  =2*T.DIST(T,ν,TRUE)" },
      { label: "Two tails, statistic > 0", math: "H₀: μ = μ₀", excel: "=2*(1-NORM.S.DIST(Z,TRUE))  ·  =2*(1-T.DIST(T,ν,TRUE))" },
      { label: "Left tail p-value", math: "H₀: μ ≥ μ₀", excel: "=NORM.S.DIST(Z,TRUE)  ·  =T.DIST(T,ν,TRUE)" },
    ],
    example: {
      title: "How old is Dr Phil? A critical-value test",
      source: "Lesson 16, Critical values sheet",
      setup: "93 age guesses from the trivia quiz (two outliers removed): x̄ = 46.356, s = 18.2295. Test H₀: μ = 34 at α = 5% with a critical value.",
      steps: [
        { label: "SE = s/√n", formula: "=18.2295/SQRT(93)" },
        { label: "T-statistic", formula: "=(46.356-34)/(18.2295/SQRT(93))" },
        { label: "Critical value T_α/2, ν = 92", formula: "=T.INV(1-0.05/2,93-1)" },
        { label: "Same test as a p-value (T > 0)", formula: "=2*(1-T.DIST((46.356-34)/(18.2295/SQRT(93)),92,TRUE))", format: "prob" },
      ],
      conclusion: "T ≈ 6.54 is far beyond +1.986, so we reject H₀; the p-value agrees (essentially 0).",
    },
    pitfalls: [
      "Using α/2 on a one-tailed test, or α on a two-tailed one.",
      "Comparing a negative statistic to a positive cut-off on a left-tailed test.",
    ],
  },
  {
    id: "sigma-n",
    title: "What σ and n do to a test",
    lesson: "Lesson 17",
    summary: "How surprising a result is depends on how much variation you expected. Less spread, or more data, makes the same gap look more surprising.",
    plain: {
      idea: "A gap of 0.2 is huge if things usually vary by 0.1, and nothing if they usually vary by 5. The test judges this by dividing the gap by the standard error.",
      like: "A train 2 minutes late is news where trains are always on time, and normal where they never are.",
      doThis: ["Smaller σ or bigger n → smaller standard error", "→ bigger test statistic → smaller p-value", "Cut-offs depend only on α, the tail and n − 1"],
    },
    notes: [
      {
        heading: "The standard error decides everything",
        body: "The test statistic is the gap (x̄ − μ₀) divided by the standard error. A smaller σ, or a bigger sample, makes the standard error smaller, so the statistic gets bigger and the p-value smaller. A bigger σ makes the same gap look like ordinary noise.",
      },
      {
        heading: "You can find the cut-offs before seeing the data",
        body: "Critical values depend only on α, the tail and ν = n − 1. For a two-tailed test at α = 1% with n = 10 boxes: ±T.INV(1 − 0.01/2, 9) = ±3.250.",
      },
    ],
    formulas: [
      { label: "Effect of σ", math: "SE = σ/√n ↓ ⇒ |Z| ↑ ⇒ p ↓", excel: "=(x̄-μ₀)/(σ/SQRT(n))" },
      { label: "Two-tailed critical T", math: "±T_α/2, ν = n − 1", excel: "=T.INV(1-α/2,n-1)" },
    ],
    example: {
      title: "Five cereal boxes, three assumptions",
      source: "Lesson 17, Exercises",
      setup: "Five boxes weigh 10.1, 9.8, 9.7, 9.1 and 10.2. Test H₀: μ = 10 (two-tailed, α = 5%).",
      data: L17_CEREAL,
      steps: [
        { label: "x̄", formula: `=AVERAGE(${list(L17_CEREAL)})` },
        { label: "σ unknown: T-statistic", formula: `=(AVERAGE(${list(L17_CEREAL)})-10)/(STDEV.S(${list(L17_CEREAL)})/SQRT(5))` },
        { label: "σ unknown: p-value (T < 0)", formula: `=2*T.DIST((AVERAGE(${list(L17_CEREAL)})-10)/(STDEV.S(${list(L17_CEREAL)})/SQRT(5)),4,TRUE)`, format: "prob" },
        { label: "σ = 0.3: p-value", formula: `=2*NORM.S.DIST((AVERAGE(${list(L17_CEREAL)})-10)/(0.3/SQRT(5)),TRUE)`, format: "prob" },
        { label: "σ = 2: p-value", formula: `=2*NORM.S.DIST((AVERAGE(${list(L17_CEREAL)})-10)/(2/SQRT(5)),TRUE)`, format: "prob" },
        { label: "n = 10, α = 1%: critical T", formula: "=T.INV(1-0.01/2,10-1)" },
      ],
      conclusion: "None of the three p-values is below 5%, so H₀ stands each time, but σ = 0.3 gives p ≈ 0.10 while σ = 2 gives p ≈ 0.81: the smaller the expected spread, the more surprising the same 0.22 oz shortfall.",
    },
    pitfalls: [
      "Thinking a bigger σ makes a result more significant. It does the opposite.",
    ],
  },
  {
    id: "variance",
    title: "Testing a variance (chi-squared)",
    lesson: "Lesson 18",
    summary: "Testing a claim about spread instead of the average: use VAR.S and the chi-squared curve.",
    plain: {
      idea: "Sometimes the question is \"is it too variable?\", not \"is the average off?\". You turn your sample's variance into a chi-squared (χ²) number and test it the usual way.",
      like: "A coffee machine that's right on average but sometimes overfills and sometimes underfills. The average is fine; the spread isn't.",
      doThis: ["S² = `VAR.S(data)`; if they give a standard deviation σ₀, square it", "χ² = (n − 1) × S² / σ₀²", "Right tail: p = `1-CHISQ.DIST(χ², n-1, TRUE)`; left tail: p = `CHISQ.DIST(χ², n-1, TRUE)`"],
    },
    notes: [
      {
        heading: "Variance is spread, squared",
        body: "The variance is the standard deviation squared. Your sample's variance S² = `VAR.S(data)` divides by n − 1, which makes it right on average (\"unbiased\"). Dividing by n would make it come out too small on average.",
      },
      {
        heading: "The fact from class",
        body: "If the data come from a normal curve, (n − 1) × S² / σ² follows a chi-squared (χ²) curve with n − 1 degrees of freedom. Unlike the bell, chi-squared is lopsided and never negative, so its two cut-offs are two different numbers, not ± the same one.",
      },
      {
        heading: "The steps",
        body: "Step 0: pick α. Step 1: H₀: σ² ≤ σ₀² (right tail), H₀: σ² ≥ σ₀² (left tail) or H₀: σ² = σ₀² (two tails). Step 2: χ² = (n − 1)S²/σ₀². Step 3: reject H₀ if p-value < α, or if χ² is past the cut-off. If the question gives a standard deviation, square it first.",
      },
      {
        heading: "p-values and cut-offs",
        body: "Same left-area rule as before: `CHISQ.DIST(stat, n-1, TRUE)` is the area to the left. Right tail: p = `1-CHISQ.DIST(stat, n-1, TRUE)`, cut-off `CHISQ.INV(1-α, n-1)`. Left tail: p = `CHISQ.DIST(stat, n-1, TRUE)`, cut-off `CHISQ.INV(α, n-1)`. Two tails: double the smaller side; cut-offs `CHISQ.INV(α/2, n-1)` and `CHISQ.INV(1-α/2, n-1)`.",
      },
    ],
    formulas: [
      { label: "Sample variance", math: "S² (divides by n − 1)", excel: "=VAR.S(range)" },
      { label: "Test statistic", math: "χ² = (n − 1)S² / σ₀², ν = n − 1", excel: "=(n-1)*VAR.S(range)/σ₀^2" },
      { label: "Right tail (H₀: σ² ≤ σ₀²)", math: "p and critical value", excel: "=1-CHISQ.DIST(χ²,n-1,TRUE)  ·  =CHISQ.INV(1-α,n-1)" },
      { label: "Left tail (H₀: σ² ≥ σ₀²)", math: "p and critical value", excel: "=CHISQ.DIST(χ²,n-1,TRUE)  ·  =CHISQ.INV(α,n-1)" },
      { label: "Two tails (H₀: σ² = σ₀²)", math: "two different cut-offs", excel: "=CHISQ.INV(α/2,n-1)  ·  =CHISQ.INV(1-α/2,n-1)" },
    ],
    example: {
      title: "Is the variance at most 1?",
      source: "Lesson 18, Exercise",
      setup: "Ten values were drawn from N(0, 1). Test H₀: σ² ≤ 1 against H_A: σ² > 1 (right tail) at α = 0.2.",
      data: L18_VAR,
      steps: [
        { label: "S²", formula: `=VAR.S(${list(L18_VAR)})` },
        { label: "χ² = (n − 1)S²/σ₀²", formula: `=((10-1)/1)*VAR.S(${list(L18_VAR)})` },
        { label: "p-value (right tail)", formula: `=1-CHISQ.DIST(((10-1)/1)*VAR.S(${list(L18_VAR)}),9,TRUE)`, format: "prob" },
        { label: "Critical value, ν = 9", formula: "=CHISQ.INV(1-0.2,9)" },
      ],
      conclusion: "p ≈ 0.646 > 0.2 and χ² ≈ 6.92 is left of the critical value 12.242, so we do not reject H₀: no evidence the variance is above 1.",
    },
    pitfalls: [
      "Using σ₀ where the formula needs σ₀². Square a given standard deviation.",
      "Using ± one cut-off on a two-tailed test. Chi-squared is lopsided: work out CHISQ.INV(α/2, …) and CHISQ.INV(1-α/2, …) separately.",
      "Using n instead of n − 1 for the degrees of freedom.",
    ],
  },
  {
    id: "two-sample",
    title: "Comparing two means (Toolpak)",
    lesson: "Lesson 18",
    summary: "Are two groups' averages really different? Excel's Toolpak runs the test; you pick the right one and read the output.",
    plain: {
      idea: "You compare two separate groups (two classes, two machines). The test checks whether the gap between their averages is bigger than luck alone would explain.",
      like: "Two classes take the same exam. Is one really better, or is the gap just luck?",
      doThis: ["σ's given → Toolpak \"z-Test: Two Sample for Means\" (type the variances, σ²)", "Not given → \"t-Test: Two-Sample Assuming Equal Variances\"", "Read the p-value line and reject H₀ if p < α"],
    },
    notes: [
      {
        heading: "The hypotheses",
        body: "Two tails: H₀: μ₁ = μ₂ (\"the averages are the same\"). Right tail: H₀: μ₁ − μ₂ ≤ 0. Left tail: H₀: μ₁ − μ₂ ≥ 0. The statistic measures how far apart the two sample averages are, in standard errors.",
      },
      {
        heading: "Which Toolpak test",
        body: "σ's given: \"z-Test: Two Sample for Means\". Enter the variances (σ², the sd squared), not the standard deviations. σ's not given but assumed equal: \"t-Test: Two-Sample Assuming Equal Variances\", which combines (\"pools\") the two samples' spreads and uses ν = n₁ + n₂ − 2.",
      },
      {
        heading: "Turning on the Toolpak",
        body: "Windows: File › Options › Add-ins › Manage Excel Add-ins › Go › tick Analysis ToolPak. Mac: Tools › Excel Add-ins › tick Analysis ToolPak. Then Data › Data Analysis. Set Hypothesized Mean Difference to 0 and Alpha to α. Tick Labels only if your ranges include the header cells.",
      },
      {
        heading: "Reading the output",
        body: "The Toolpak's \"one-tail\" p-value is always the SMALLER tail, whatever your H_A says. For a one-tailed test, check that the statistic points the way H_A does; if it doesn't, the p-value is 1 − that number. The \"two-tail\" line is right for H₀: μ₁ = μ₂.",
      },
    ],
    formulas: [
      { label: "Z (σ's known)", math: "Z = (x̄₁ − x̄₂) / √(σ₁²/n₁ + σ₂²/n₂)", excel: "=(x̄₁-x̄₂)/SQRT(σ₁^2/n₁+σ₂^2/n₂)" },
      { label: "Pooled variance", math: "S_p² = ((n₁−1)S₁² + (n₂−1)S₂²) / (n₁+n₂−2)", excel: "=((n₁-1)*VAR.S(r1)+(n₂-1)*VAR.S(r2))/(n₁+n₂-2)" },
      { label: "T (σ's unknown, equal)", math: "T = (x̄₁ − x̄₂) / √(S_p²(1/n₁ + 1/n₂)), ν = n₁+n₂−2", excel: "=(x̄₁-x̄₂)/SQRT(Sp2*(1/n₁+1/n₂))" },
      { label: "Two-tail p, statistic > 0", math: "H₀: μ₁ = μ₂", excel: "=2*(1-NORM.S.DIST(Z,TRUE))  ·  =2*(1-T.DIST(T,ν,TRUE))" },
    ],
    example: {
      title: "Do X and Y have the same mean?",
      source: "Lesson 18, Two-sample sheet",
      setup: `Two samples of 10, both with known σ = 1. Test H₀: μ₁ = μ₂ at α = 0.2. X (shown to 3 decimals): ${short(L18_X)}. Y: ${short(L18_Y)}. The formulas use the full values; in Excel, point them at the data cells.`,
      steps: [
        { label: "x̄₁", formula: `=AVERAGE(${list(L18_X)})` },
        { label: "x̄₂", formula: `=AVERAGE(${list(L18_Y)})` },
        { label: "Z = (x̄₁ − x̄₂)/√(1/10 + 1/10)", formula: `=(AVERAGE(${list(L18_X)})-AVERAGE(${list(L18_Y)}))/SQRT(1/10+1/10)` },
        { label: "p-value (two tails, Z > 0)", formula: `=2*(1-NORM.S.DIST((AVERAGE(${list(L18_X)})-AVERAGE(${list(L18_Y)}))/SQRT(1/10+1/10),TRUE))`, format: "prob" },
        { label: "Critical value Z_α/2", formula: "=NORM.S.INV(1-0.2/2)" },
      ],
      conclusion: "Z ≈ 3.16 is beyond 1.28 and p ≈ 0.0016 < 0.2, so we reject H₀: the two means differ. The Toolpak's z-Test (variances 1 and 1) gives the same z and two-tail p.",
    },
    pitfalls: [
      "Typing σ instead of σ² into \"Variable 1 Variance (known)\".",
      "Copying the one-tail p without checking the statistic points the way H_A does.",
      "Forgetting Hypothesized Mean Difference = 0, or ticking Labels when you didn't select the headers.",
    ],
  },
  {
    id: "paired",
    title: "Paired data (before/after)",
    lesson: "Lesson 18",
    summary: "Same people measured twice (before and after)? Subtract to get one column of differences, then do an ordinary one-sample t-test on it.",
    plain: {
      idea: "When each person has two scores, look at each person's change. Then ask: is the average change really different from 0?",
      like: "Instead of comparing two classes, you track how much each student improved on their own.",
      doThis: ["New column: D = second − first (after − before)", "T = `AVERAGE(D) / (STDEV.S(D)/SQRT(n))`, with n = the number of pairs", "p-value from `T.DIST` with n − 1; pick the tail from H₀"],
    },
    notes: [
      {
        heading: "When data are paired",
        body: "Each person is measured twice: Exam 1 and Exam 2 for the same student, or before and after for the same patient. The two columns belong together, so don't use the two-group test. Make one column of differences, D = second − first.",
      },
      {
        heading: "Then it's a one-sample t-test",
        body: "Test whether the average difference is 0: T = (average of D − 0) / (s_D/√n), with ν = n − 1, where n is the number of pairs and s_D = `STDEV.S` of the D column. Then use T.DIST and T.INV exactly as in the twelve questions.",
      },
      {
        heading: "Pick the tail from H₀",
        body: "\"Scores have improved\" means the claim is D > 0, so H₀: μ_D ≤ 0 (right tail). If the question writes H₀: μ_D ≥ 0, it's a left-tail test. Flipping D (first − second) flips every sign, so stick with second − first.",
      },
    ],
    formulas: [
      { label: "Difference column", math: "D = second − first", excel: "=C2-B2  (fill down)" },
      { label: "T-statistic", math: "T = d̄ / (s_D/√n), ν = n − 1", excel: "=AVERAGE(D)/(STDEV.S(D)/SQRT(n))" },
      { label: "Right tail (H₀: μ_D ≤ 0)", math: "p and critical value", excel: "=1-T.DIST(T,n-1,TRUE)  ·  =T.INV(1-α,n-1)" },
    ],
    example: {
      title: "Did exam scores improve?",
      source: "Practice numbers",
      setup: `Seven students. Exam 1: ${PAIRED_E1.join(", ")}. Exam 2: ${PAIRED_E2.join(", ")}. Test whether scores improved, H₀: μ_D ≤ 0, at α = 5%. The data below are the differences D = Exam 2 − Exam 1.`,
      data: PAIRED_D,
      steps: [
        { label: "d̄", formula: `=AVERAGE(${list(PAIRED_D)})` },
        { label: "s_D", formula: `=STDEV.S(${list(PAIRED_D)})` },
        { label: "T-statistic", formula: `=AVERAGE(${list(PAIRED_D)})/(STDEV.S(${list(PAIRED_D)})/SQRT(7))` },
        { label: "p-value (right tail)", formula: `=1-T.DIST(AVERAGE(${list(PAIRED_D)})/(STDEV.S(${list(PAIRED_D)})/SQRT(7)),6,TRUE)`, format: "prob" },
        { label: "Critical value T_α, ν = 6", formula: "=T.INV(1-0.05,6)" },
      ],
      conclusion: "T ≈ 3.87 is beyond 1.943 and p ≈ 0.004 < 0.05, so we reject H₀: at the 5% level, scores improved.",
    },
    pitfalls: [
      "Running a two-group test on paired data.",
      "Using 2n − 2 degrees of freedom. There are n pairs, so ν = n − 1.",
      "Mixing up D = second − first with first − second, which flips the tail.",
    ],
  },
  {
    id: "dictionary",
    title: "Dictionary: symbols, functions and definitions",
    lesson: "Whiteboard",
    summary: "Every symbol from the board in plain words, the Excel functions the class uses, and the words the written questions ask you to define.",
    plain: {
      idea: "Most of the confusion in stats is vocabulary. Here's every symbol and word, said the way you'd explain it to a friend.",
      like: "A phrasebook for the exam.",
      doThis: ["Greek letters (μ, σ) are about the whole population; plain letters (x̄, s) come from your sample", "\"0\" after a letter (μ₀) means the value being claimed", "If a definition question comes up, use the plain-words versions below"],
    },
    notes: [
      {
        heading: "Symbols",
        body: "H₀: the null hypothesis, \"nothing special is going on\". H_A: the alternative, the claim you want to show. μ (\"mu\"): the true average of everyone. μ₀ (\"mu-nought\"): the average H₀ claims. σ (\"sigma\"): the true spread of everyone. x̄ (\"x-bar\"): your sample's average. s: your sample's spread. n: how many you measured. SE: standard error, how much a sample average wobbles, σ/√n or s/√n. N(μ, σ²): a normal curve with average μ and variance σ². α (\"alpha\"): how small a chance counts as \"too surprising\". ν (\"nu\"): degrees of freedom, usually n − 1.",
      },
      {
        heading: "Excel functions",
        body: "`NORM.DIST(x, μ, σ, TRUE)`: chance of being below x. `NORM.INV(p, μ, σ)`: the value with p below it. `NORM.S.DIST(z, TRUE)` and `NORM.S.INV(p)`: the same for z-scores. `T.DIST(t, ν, TRUE)` and `T.INV(p, ν)`: the same for the t-curve. For spread: `VAR.S(range)`, `CHISQ.DIST(x, ν, TRUE)` and `CHISQ.INV(p, ν)`. Plus `AVERAGE`, `STDEV.S`, `COUNT` and `SQRT`. Every right-tail or two-tail answer is built from these with 1 − … and 2 × ….",
      },
      {
        heading: "Words the written questions ask you to define",
        body: "Type I error: rejecting H₀ when it's actually true (a false alarm); its chance is α. Type II error: not rejecting H₀ when it's actually false (a missed alarm). With the same sample size, a smaller α means more Type II errors. p-value: if H₀ were true, the chance of a result at least as extreme as yours; it is NOT the chance that H₀ is true. Significance level α: the false-alarm rate you decide to accept before looking at the data. Unbiased: right on average over many samples; x̄ is unbiased for μ, and S² (dividing by n − 1) is unbiased for σ², while dividing by n comes out too small. Shapes: the normal is a symmetric bell; t is a bell with fatter tails that gets closer to the normal as ν grows; χ² is never negative and lopsided to the right, getting more symmetric as ν grows.",
      },
    ],
    formulas: [
      { label: "value → probability", math: ".DIST", excel: "NORM.DIST · NORM.S.DIST · T.DIST · CHISQ.DIST" },
      { label: "probability → value", math: ".INV", excel: "NORM.INV · NORM.S.INV · T.INV · CHISQ.INV" },
    ],
    pitfalls: [
      "σ and s are different: σ is the whole population's spread (given to you), s is worked out from your sample.",
    ],
  },
];

export const topicById = (id: string) => TOPICS.find((t) => t.id === id);

/** Plain-text course notes for the tutor's system prompt. Stable text: it is prompt-cached. */
export function courseNotesText(): string {
  return TOPICS.map((t) => {
    const plain = t.plain ? `In plain English: ${t.plain.idea} Like: ${t.plain.like} What you do: ${t.plain.doThis.join("; ")}.\n` : "";
    const notes = plain + t.notes.map((n) => `${n.heading}: ${n.body}`).join("\n");
    const f = t.formulas.map((x) => `- ${x.label}: ${x.math} | Excel ${x.excel}`).join("\n");
    const ex = t.example
      ? `Class example (${t.example.source}), ${t.example.title}: ${t.example.setup}${t.example.data ? ` Data: ${t.example.data.join(", ")}.` : ""} Steps: ${t.example.steps.map((s) => `${s.label} ${s.formula}`).join("; ")}. ${t.example.conclusion}`
      : "";
    const p = t.pitfalls.map((x) => `- ${x}`).join("\n");
    return `## ${t.title} (${t.lesson})\n${notes}\nFormulas:\n${f}\n${ex}\nCommon mistakes:\n${p}`;
  }).join("\n\n");
}
