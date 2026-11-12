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
    summary: "Turn any less-than, more-than or between question into NORM.DIST, and any top-or-bottom percent into NORM.INV.",
    notes: [
      {
        heading: "Area is probability",
        body: "X ~ N(μ, σ²) is a bell curve centred on μ, with σ setting the spread. The total area under it is 1, and the area over an interval is the probability X lands there. Because the curve is continuous, P(X < a) and P(X ≤ a) are the same number.",
      },
      {
        heading: "Two machines, two directions",
        body: "The whiteboard rule: a value goes into a .DIST function and a probability comes out; a probability goes into a .INV function and a value comes out. Every .DIST gives the area to the LEFT of the value, and every .INV expects the area to the LEFT of the answer.",
      },
      {
        heading: "Reading the question",
        body: "Less than a: `NORM.DIST(a, μ, σ, TRUE)`. More than a: `1 - NORM.DIST(a, μ, σ, TRUE)`. Between a and b: `NORM.DIST(b, …) - NORM.DIST(a, …)`. Top 10%: the value with 90% to its left, `NORM.INV(0.9, μ, σ)`. Bottom 10%: `NORM.INV(0.1, μ, σ)`. Middle 50%: `NORM.INV(0.25, …)` and `NORM.INV(0.75, …)`. Q1 is the 25th percentile.",
      },
      {
        heading: "Z-scores",
        body: "z = (x − μ) / σ counts how many standard deviations x sits from the mean; a negative z is below the mean. Going back: x = μ + z·σ. The standard normal Z ~ N(0, 1) has its own functions, `NORM.S.DIST(z, TRUE)` and `NORM.S.INV(p)`. About 68% of values fall within 1σ, 95% within 2σ and 99.7% within 3σ.",
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
      "Using FALSE as the last argument returns the height of the curve, not a probability. Exam answers need TRUE.",
      "\"Top 10%\" means 0.9 goes into NORM.INV, not 0.1.",
      "For \"more than\", don't forget the 1 − ….",
    ],
  },
  {
    id: "clt",
    title: "Sampling distributions and the CLT",
    lesson: "Lessons 12–14",
    summary: "The sample mean is itself a random variable, with mean μ and standard error σ/√n.",
    notes: [
      {
        heading: "Parameters and statistics",
        body: "A population is all the data you care about; a parameter is a true number about it (μ, σ), which you almost never know. A sample is what you collect; a statistic is a number computed from it (x̄, s). An estimate is a statistic meant to approximate a parameter. A point estimate is one number; a confidence interval is a range that contains the parameter with a stated probability.",
      },
      {
        heading: "X̄ has its own distribution",
        body: "Take a sample of n values and average them: X̄ changes from sample to sample, so it is a random variable. If each X is N(μ, σ²) then X̄ ~ N(μ, (σ/√n)²). Its spread, σ/√n, is the standard error (SE). Bigger samples give a smaller SE, so x̄ lands closer to μ.",
      },
      {
        heading: "Central Limit Theorem",
        body: "Even when X is not normal (dice sums, trivia scores), for large n the sample mean is approximately normal with mean μ and SE σ/√n, and its Z-score is approximately N(0, 1). The Lesson 12 simulation showed this: histograms of averages turn into a bell.",
      },
      {
        heading: "One box versus five boxes",
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
      "Using σ instead of σ/√n for a question about a sample mean.",
      "Calling x̄ a parameter: it comes from the sample, so it is a statistic.",
    ],
  },
  {
    id: "ci-z",
    title: "Confidence intervals with σ known",
    lesson: "Lessons 13–15",
    summary: "Two different questions share one formula: where will x̄ land, and where is μ.",
    notes: [
      {
        heading: "Two questions, don't mix them up",
        body: "Question A, μ is known: inside what range will the sample mean land? μ ± Z_α/2 · σ/√n (Lesson 14 heights, Lesson 15 IQ). Question B, μ is unknown: inside what range is the true mean? x̄ ± Z_α/2 · σ/√n (Lesson 14 orders, Lesson 15 mortar). Same width, different centre.",
      },
      {
        heading: "The three levels on the syllabus",
        body: "Level 1: μ and σ both known, so find where x̄ will land, μ ± Z_α/2 · σ/√n. Level 2: σ known, μ unknown, so x̄ ± Z_α/2 · σ/√n. Level 3: both unknown, so replace σ with s and Z with T on n − 1 degrees of freedom (next topic).",
      },
      {
        heading: "α and the critical value",
        body: "α is the small probability you find suspicious; confidence is 1 − α. The critical value Z_α/2 = `NORM.S.INV(1-α/2)` leaves α/2 in each tail: 1.645 for 90%, 1.960 for 95%, 2.576 for 99%. More confidence means a wider interval; a larger n means a narrower one.",
      },
      {
        heading: "Saying what it means",
        body: "\"We are 95% confident the true mean is between L and U.\" The procedure captures μ in 95% of samples. It is not proof: in Lesson 15 the bumped mortar's interval was 1.784 to 1.900 miles, yet the true mean could still be 2.",
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
      "Using NORM.S.INV(1-α) for a two-sided interval. Intervals split α into two tails.",
      "Centering on μ when the question says μ is unknown.",
    ],
  },
  {
    id: "t",
    title: "Unknown σ: s, n − 1 and the t-distribution",
    lesson: "Lesson 15",
    summary: "Replace σ with the sample standard deviation s, and Z with T on n − 1 degrees of freedom.",
    notes: [
      {
        heading: "Why σ is a problem",
        body: "In practice you rarely know σ. Without it you can't compute the standard error, so you can't compute the Z-score. Estimate σ with the sample standard deviation s = `STDEV.S(data)`.",
      },
      {
        heading: "Why divide by n − 1",
        body: "The \"dumb variance\" divides by n and is biased: on average it comes out smaller than the true variance (Lesson 15 simulation, n = 2). The sample variance `VAR.S` divides by n − 1 and is unbiased: its average matches σ².",
      },
      {
        heading: "The t-distribution",
        body: "T = (x̄ − μ) / (s/√n) follows a t-distribution with ν = n − 1 degrees of freedom (ν is \"nu\"). It is symmetric and bell-shaped with mean 0, but has fatter tails than N(0, 1); as ν grows it approaches N(0, 1). `T.DIST(t, ν, TRUE)` and `T.INV(p, ν)` work exactly like NORM.S.DIST and NORM.S.INV, with the degrees of freedom added.",
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
      "Using STDEV.P or the divide-by-n variance instead of STDEV.S.",
      "Using n instead of n − 1 for the degrees of freedom.",
    ],
  },
  {
    id: "ht-logic",
    title: "Hypothesis testing: the logic and the four steps",
    lesson: "Lesson 16",
    summary: "Assume H₀ is true, ask how surprising your sample is, and reject only if that probability is below α.",
    notes: [
      {
        heading: "The big idea",
        body: "Assume the claim you doubt (H₀) is true. Compute the probability of getting a sample result this extreme or worse. That probability is the p-value. If it is smaller than α, the result is too surprising to believe H₀, so you reject it.",
      },
      {
        heading: "The four steps from class",
        body: "Step 0: choose the significance α (often 5% or 1%). Step 1: write H₀ and H_A; H₀ always holds the equality. Step 2: compute the test statistic and its p-value. Step 3: if p-value < α, reject H₀; otherwise do not reject H₀.",
      },
      {
        heading: "Which tail? Read the wording",
        body: "\"Different from, not equal to, has it changed\": two-tailed, H₀: μ = μ₀, H_A: μ ≠ μ₀. \"More than, exceeds, increased\": right tail, H₀: μ ≤ μ₀, H_A: μ > μ₀. \"Less than, below, decreased\": left tail, H₀: μ ≥ μ₀, H_A: μ < μ₀. The claim you want evidence for goes in H_A.",
      },
      {
        heading: "Z-test or t-test?",
        body: "If the population σ is given, use Z = (x̄ − μ₀)/(σ/√n) and the normal. If you only have the sample, compute s and use T = (x̄ − μ₀)/(s/√n) with ν = n − 1.",
      },
      {
        heading: "Saying the decision",
        body: "Say \"reject H₀\" or \"do not reject (fail to reject) H₀\", never \"accept H₀\" or \"prove\". Then translate: \"At the 5% significance level, there is enough evidence that the average cost is less than $50.\" Rejecting does not prove H₀ false: extremely unlikely samples do happen.",
      },
      {
        heading: "No calculators on Exam 2",
        body: "Every number must come from Excel. Type formulas that point at the data cells (`=AVERAGE(B2:B11)`), and chain later steps off earlier cells, never off rounded numbers you copied by hand.",
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
      "Forgetting to double the tail for a two-tailed test.",
      "Writing the claim you want to show as H₀. It belongs in H_A.",
      "Concluding \"we accept H₀\".",
    ],
  },
  {
    id: "twelve",
    title: "The 12 hypothesis test questions",
    lesson: "Lessons 16–17 · whiteboard",
    summary: "Three null hypotheses × σ known or unknown × p-value or critical value: every test on the exam is one of these twelve.",
    notes: [
      {
        heading: "How the twelve come about",
        body: "Pick the null (μ ≤ μ₀ right tail, μ = μ₀ two tails, μ ≥ μ₀ left tail), pick the distribution (σ known: Z; σ unknown: T with ν = n − 1), then answer with either a p-value or a critical value. The grid below gives the exact Excel formula for each.",
      },
      {
        heading: "The critical-value method",
        body: "Instead of a p-value, find the cut-off where the rejection region starts and compare the test statistic to it. Right tail: reject if stat > Z_α (`NORM.S.INV(1-α)`) or T_α (`T.INV(1-α, ν)`). Left tail: reject if stat < `NORM.S.INV(α)` or `T.INV(α, ν)`, both negative. Two tails: reject if |stat| > Z_α/2 or T_α/2. The two methods always agree.",
      },
      {
        heading: "The p-value formula depends on the sign of the statistic",
        body: "Class uses only the one-tail functions (.DIST with TRUE gives the area to the left), so look at the sign first. Left tail: p = .DIST(stat). Right tail: p = 1 − .DIST(stat). Two tails: if the statistic is negative, p = 2 × .DIST(stat); if it is positive, p = 2 × (1 − .DIST(stat)). Either way you are doubling the smaller tail, so a two-tailed p-value can never be above 1.",
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
      "Comparing a negative statistic to a positive critical value on a left-tailed test.",
    ],
  },
  {
    id: "sigma-n",
    title: "What σ and n do to a test",
    lesson: "Lesson 17",
    summary: "The same sample can be shocking or ordinary depending on how much spread you expect.",
    notes: [
      {
        heading: "The standard error drives everything",
        body: "The test statistic divides the gap x̄ − μ₀ by the standard error. A smaller σ (or a bigger n) means a smaller SE, a larger |statistic| and a smaller p-value. A larger σ makes the same gap look like ordinary noise.",
      },
      {
        heading: "Critical values for a t-test before you see the data",
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
    pitfalls: ["Thinking a bigger σ makes a result more significant. It does the opposite."],
  },
  {
    id: "variance",
    title: "Testing a variance (chi-squared)",
    lesson: "Lesson 18",
    summary: "To test a claim about σ², scale the sample variance into a chi-squared statistic with n − 1 degrees of freedom.",
    notes: [
      {
        heading: "S² estimates σ² without bias",
        body: "The sample variance S² = `VAR.S(data)` divides by n − 1 and is an unbiased estimate of σ². The \"dumb variance\" that divides by n is biased. An estimate is biased if, on average, it isn't equal to the true parameter.",
      },
      {
        heading: "The FACT from class",
        body: "If X₁, …, Xₙ are iid normal, then (n − 1)S²/σ² follows a chi-squared distribution (χ²) with n − 1 degrees of freedom. Chi-squared is only positive, right-skewed and not symmetric, so the left and right critical values are two different numbers, not ± the same one.",
      },
      {
        heading: "The steps",
        body: "Step 0: choose α. Step 1: H₀: σ² ≤ σ₀² (right tail), H₀: σ² ≥ σ₀² (left tail) or H₀: σ² = σ₀² (two tails). Step 2: χ² = (n − 1)S²/σ₀². Step 3: reject H₀ if p-value < α, or if the statistic is beyond the critical value. If the question gives a standard deviation σ₀, square it first.",
      },
      {
        heading: "p-values and critical values",
        body: "Same one-tail rule as before: `CHISQ.DIST(stat, n-1, TRUE)` is the area to the left. Right tail: p = `1-CHISQ.DIST(stat, n-1, TRUE)`, critical value `CHISQ.INV(1-α, n-1)`. Left tail: p = `CHISQ.DIST(stat, n-1, TRUE)`, critical value `CHISQ.INV(α, n-1)`. Two tails: double the smaller side (2 × DIST if the stat is in the left tail, 2 × (1 − DIST) if in the right); critical values `CHISQ.INV(α/2, n-1)` and `CHISQ.INV(1-α/2, n-1)`.",
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
      "Plugging in σ₀ when the formula needs σ₀². Square a given standard deviation.",
      "Using ± one critical value on a two-tailed test. Chi-squared isn't symmetric: compute CHISQ.INV(α/2, …) and CHISQ.INV(1-α/2, …) separately.",
      "Using n instead of n − 1 for the degrees of freedom.",
    ],
  },
  {
    id: "two-sample",
    title: "Comparing two means (Toolpak)",
    lesson: "Lesson 18",
    summary: "Test whether two populations have the same mean with the Analysis Toolpak, then read its p-value correctly.",
    notes: [
      {
        heading: "The hypotheses",
        body: "H₀: μ₁ = μ₂ (two tails), or H₀: μ₁ − μ₂ ≤ 0 (right tail) / H₀: μ₁ − μ₂ ≥ 0 (left tail). The statistic measures how far apart the two sample means are, in standard errors.",
      },
      {
        heading: "Two cases on the syllabus",
        body: "σ's known: Toolpak \"z-Test: Two Sample for Means\", Z = (x̄₁ − x̄₂)/√(σ₁²/n₁ + σ₂²/n₂). Enter variances, not standard deviations, in \"Variable 1 Variance (known)\" and \"Variable 2 Variance (known)\". σ's unknown but assumed equal: Toolpak \"t-Test: Two-Sample Assuming Equal Variances\", which pools the two sample variances and uses T with ν = n₁ + n₂ − 2.",
      },
      {
        heading: "Turning on the Toolpak",
        body: "Windows: File › Options › Add-ins › Manage Excel Add-ins › Go › tick Analysis ToolPak. Mac: Tools › Excel Add-ins › tick Analysis ToolPak. Then Data › Data Analysis. Set Hypothesized Mean Difference to 0 and Alpha to α; tick Labels if your ranges include the header cells.",
      },
      {
        heading: "Reading the output",
        body: "The Toolpak's \"P(Z<=z) one-tail\" or \"P(T<=t) one-tail\" is always the SMALLER tail, whatever your H_A says. For a one-tail test, check the statistic's sign points the way H_A says; if it doesn't, the p-value is 1 − that number. The two-tail line is fine for H₀: μ₁ = μ₂. You can also recompute it the class way: for a positive z, `=(1-NORM.S.DIST(z,TRUE))*2`.",
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
      "Copying the Toolpak's one-tail p without checking the sign of the statistic against H_A.",
      "Forgetting Hypothesized Mean Difference = 0, or ticking Labels when you didn't select the headers.",
    ],
  },
  {
    id: "paired",
    title: "Paired data (before/after)",
    lesson: "Lesson 18",
    summary: "Two measurements on the same subjects become one column of differences, tested with an ordinary one-sample t-test.",
    notes: [
      {
        heading: "When data are paired",
        body: "Each subject is measured twice: Exam 1 and Exam 2 for the same student, before and after for the same patient. The two columns aren't independent samples, so don't use the two-sample test. Make a column of differences D = second − first.",
      },
      {
        heading: "Run a one-sample t-test on D",
        body: "Test μ_D against μ₀ = 0. σ_D is unknown, so T = (d̄ − 0)/(s_D/√n) with ν = n − 1, where n is the number of pairs. Then use T.DIST / T.INV exactly as in the twelve questions.",
      },
      {
        heading: "Pick the tail from H₀",
        body: "\"Scores have improved\" means D > 0 is the claim, so H₀: μ_D ≤ 0 (right tail). If the question writes H₀: μ_D ≥ 0, it's a left-tail test. If you define D the other way (first − second), every sign flips, so stick with second − first.",
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
      "Running a two-sample test on paired data.",
      "Using 2n − 2 degrees of freedom. There are n pairs, so ν = n − 1.",
      "Mixing up D = second − first with first − second, which flips the tail.",
    ],
  },
  {
    id: "dictionary",
    title: "Dictionary: symbols, functions and definitions",
    lesson: "Whiteboard",
    summary: "Every symbol from the board, said out loud, with the Excel function it goes with, and the words the written parts ask you to define.",
    notes: [
      {
        heading: "Symbols",
        body: "H₀: the null hypothesis. H_A: the alternative. μ (\"mu\"): the true population mean. μ₀ (\"mu-nought\"): the value H₀ claims. σ (\"sigma\"): the population standard deviation. x̄ (\"x-bar\"): the sample mean. s: the sample standard deviation. n: the sample size. SE: the standard error, σ/√n or s/√n. N(μ, σ²): normal with mean μ and variance σ². α (\"alpha\"): significance, the tail probability you call too unlikely. Z_α/2: the Z value with α/2 to its right. ν (\"nu\"): degrees of freedom, n − 1.",
      },
      {
        heading: "Excel functions",
        body: "Class keeps the list short. `NORM.DIST(x, μ, σ, TRUE)`: area left of x. `NORM.INV(p, μ, σ)`: value with p to its left. `NORM.S.DIST(z, TRUE)` and `NORM.S.INV(p)`: the same for N(0, 1). `T.DIST(t, ν, TRUE)`: area left of t. `T.INV(p, ν)`: t with p to its left. For variances: `VAR.S(range)`, `CHISQ.DIST(x, ν, TRUE)` and `CHISQ.INV(p, ν)`. Plus `AVERAGE`, `STDEV.S`, `COUNT` and `SQRT`. Every right-tail or two-tail answer is built from these with 1 − … and 2 × ….",
      },
      {
        heading: "Words the written parts ask you to define",
        body: "Type I error: rejecting H₀ when H₀ is true; its probability is α. Type II error: not rejecting H₀ when H₀ is false. For a fixed n, a smaller α means more Type II errors. p-value: the probability, if H₀ were true, of a sample result at least as extreme as the one you got; it is not the probability that H₀ is true. α (significance level): the Type I error rate you decide to accept before looking at the data. Unbiased: an estimator whose average over many samples equals the parameter; x̄ is unbiased for μ and S² (dividing by n − 1) for σ², while dividing by n is biased low. Shapes: the normal is a symmetric bell; t is symmetric with heavier tails than Z and gets closer to Z as ν grows; χ² is only positive, skewed right, and gets more symmetric as ν grows.",
      },
    ],
    formulas: [
      { label: "value → probability", math: ".DIST", excel: "NORM.DIST · NORM.S.DIST · T.DIST · CHISQ.DIST" },
      { label: "probability → value", math: ".INV", excel: "NORM.INV · NORM.S.INV · T.INV · CHISQ.INV" },
    ],
    pitfalls: ["σ and s are different: σ is the population's (given), s is computed from your sample."],
  },
];

export const topicById = (id: string) => TOPICS.find((t) => t.id === id);

/** Plain-text course notes for the tutor's system prompt. Stable text: it is prompt-cached. */
export function courseNotesText(): string {
  return TOPICS.map((t) => {
    const notes = t.notes.map((n) => `${n.heading}: ${n.body}`).join("\n");
    const f = t.formulas.map((x) => `- ${x.label}: ${x.math} | Excel ${x.excel}`).join("\n");
    const ex = t.example
      ? `Class example (${t.example.source}), ${t.example.title}: ${t.example.setup}${t.example.data ? ` Data: ${t.example.data.join(", ")}.` : ""} Steps: ${t.example.steps.map((s) => `${s.label} ${s.formula}`).join("; ")}. ${t.example.conclusion}`
      : "";
    const p = t.pitfalls.map((x) => `- ${x}`).join("\n");
    return `## ${t.title} (${t.lesson})\n${notes}\nFormulas:\n${f}\n${ex}\nCommon mistakes:\n${p}`;
  }).join("\n\n");
}
