# Thinka's AQM Prep

A study site for Babson AQM 1000 Midterm 2 (Lessons 12–17: the normal distribution, the CLT, confidence intervals and the 12 hypothesis-test cases), built by a student for classmates.

**Live:** https://thinka-aqm-prep.vercel.app

## What's in it

- **Learn:** notes for each topic, with the class's Excel conventions. Only the one-tail functions are used (`NORM.S.DIST`, `T.DIST(…,TRUE)`, `.INV`), and the two-tailed p-value formula is chosen by the sign of the statistic.
- **Practice:** unlimited exam-style questions with exact grading, solved in a built-in mini Excel. It has AutoComplete, argument tips and range selection.
- **Problem sets and mock exams:** download them as `.xlsx`, solve them in real Excel, then upload them to be graded.
- **Diagnostic and study plan:** nine questions, taken on the site or in Excel, become a day-by-day plan up to the exam.
- **Tutor:** Claude Sonnet, running on each student's own API key. It checks numbers with the same verified Excel engine.

Grading follows class: the underlying value counts, so students should enter formulas or full values, not rounded numbers.

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

The stats functions are checked against SciPy, with a worst relative error of about 4e-11 (`scripts/ref.py`). Every practice answer is proven by evaluating its own Excel formula through the site's formula engine, and the test suite runs over 200,000 checks.

## License

MIT. Not affiliated with or endorsed by Babson College.
