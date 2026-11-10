# Generates SciPy reference values for src/lib/stats.test.ts
import json, sys
from scipy import stats
zs = [-8, -5, -3.29, -2.5758, -1.96, -1.33, -1, -0.5, 0, 0.25, 0.8416, 1.2816, 1.645, 2, 3, 4.5, 6]
ps = [1e-6, 0.0005, 0.005, 0.01, 0.025, 0.05, 0.1, 0.2, 0.25, 0.5, 0.75, 0.8, 0.9, 0.95, 0.975, 0.99, 0.995, 0.9995]
dfs = [1, 2, 4, 7, 9, 19, 31, 94, 99, 300]
ts = [-12, -3.5, -2.1, -1, -0.3, 0, 0.7, 1.833, 2.262, 4.8, 15]
out = {
  "normCdf": [[z, stats.norm.cdf(z)] for z in zs],
  "normInv": [[p, stats.norm.ppf(p)] for p in ps],
  "tCdf": [[t, d, stats.t.cdf(t, d)] for t in ts for d in dfs],
  "tInv": [[p, d, stats.t.ppf(p, d)] for p in ps for d in dfs],
  "class": {"normInv_09_18_5": stats.norm.ppf(0.9, 18, 5), "normDist_15_18_5": stats.norm.cdf(15, 18, 5)},
}
json.dump(out, open(sys.argv[1], "w"))
