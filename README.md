# Thinka's AQM Prep

A study site for Babson AQM 1000 Midterm 2 (Lessons 12–18: the normal distribution, the CLT, confidence intervals, the 12 hypothesis-test cases, chi-squared tests for a variance, and two-sample and paired tests), built by a student for classmates. The exam is answered in Excel with no calculator, so all practice happens in Excel.

**Live:** https://thinka-aqm-prep.vercel.app

## What's in it

- **Learn:** notes for each topic, with the class's Excel conventions and worked examples that calculate live. Only the one-tail functions are used (`NORM.S.DIST`, `T.DIST(…,TRUE)`, `CHISQ.DIST`, `.INV`), and the two-tailed p-value formula is chosen by the side the statistic is on.
- **Practice, all in Excel:** download a workbook, solve it in Excel, upload it.
  - Topic sets (3 versions each), mixed sets and 60-minute exam-style mocks laid out like last spring's Exam 3. Every workbook ends with an **Answer key** tab giving each answer, the formula that gets it and why.
  - Uploading marks every yellow cell on its full value. Each wrong number is checked against the common slips (wrong tail, σ instead of σ/√n, Z instead of T, α instead of α/2, σ₀ instead of σ₀², unpooled variances, …) and the review names the one it matches. It then lists what went well and what to redo.
  - Written parts (Type I/II errors, p-values, bias, distribution shapes, …) are marked by Claude on your key, or by you against the model answer.
  - **Build your own:** pick question types for a fresh set, or describe what you want and Claude designs it. Claude only picks the mix and the stories; every number and the answer key come from the verified engine.
- **Diagnostic and study plan:** nine questions in an Excel workbook become a day-by-day plan up to the exam, with Lesson 18 and the written parts scheduled too.
- **Tutor:** Claude Sonnet, running on each student's own API key. It checks numbers with the same verified Excel engine.

## Your API key

Babson gives students Claude credit through an API key, so the tutor runs on that key with no download and no account. The key is encrypted on your device and only ever sent to Babson's Claude gateway; there's no Thinka server. The details, and how to check them in the code, are in [SECURITY.md](SECURITY.md).

Everything except the tutor works without a key.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # stats engine vs SciPy, practice generator, grading
npm run build    # static site in dist/
```

The workbook round-trip tests need a Python with `openpyxl`. Point `THINKA_PYTHON` at it; without it, those tests are skipped.

## Accuracy

The stats functions are checked against SciPy, with a worst relative error of about 4e-11 (`scripts/ref.py`). The chi-squared functions are checked against exact closed forms and Lesson 18's own Excel sheet. Every practice answer is proven by evaluating its own Excel formula through the site's formula engine, and every named slip is confirmed to be graded wrong. The test suite runs about 350,000 checks. Exam-style workbooks were also filled in by Microsoft Excel itself using the answer key's formulas, then uploaded: every computed answer was marked right.

## License

MIT. Not affiliated with or endorsed by Babson College.
