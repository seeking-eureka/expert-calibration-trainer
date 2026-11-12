# Expert Calibration Trainer

An interactive app for training and measuring expert calibration. It asks the question behind every risk quantification program: "When our experts say they're 90% sure, are they right 90% of the time?" You answer true/false and range questions in batches, get feedback after each batch, and see your calibration curve, proper scores, range hit rate, and what your level of overconfidence would do to a loss estimate.

The app is a teaching tool, not a validated psychometric assessment. It favors clear, visible math over production features.

**Live app:** https://seeking-eureka.com/expert-calibration-trainer/

**User guide:** click **User Guide** in the app, or go straight to it at https://seeking-eureka.com/expert-calibration-trainer/#guide

## What the App Shows

A session runs through four screens: setup, questions, a review after each batch, and results. The results screen shows:

1. **Brier score**, compared with 0.250 for always answering 50%.
2. **Overconfidence gap**: stated confidence minus results, split into true/false and range parts.
3. **Range hit rate** with a 95% Beta range.
4. **Winkler score**, split into a width part and a miss-penalty part.
5. **Log score**, compared with ln 2 ≈ 0.693.
6. **Improvement trend**: the change in the overconfidence gap from the first batch to the last.
7. **Cost of overconfidence**: how the hit rate would stretch the 1-in-20 and 1-in-100-year losses of a lognormal fitted to a $1M to $10M range.

Charts include a calibration curve, the Murphy decomposition of the Brier score, results by batch, and every range plotted against the truth on a common scale. A question log lists every answer with its lesson and source.

Simulated mode answers a full session as a well-calibrated, overconfident, or underconfident expert and skips straight to the results. The Guide & Math tab walks through every formula and fills in a callout with your latest numbers.

## The Model

| Piece | Specification |
|---|---|
| True/false answer | Choice plus confidence c ∈ {0.5, 0.6, 0.7, 0.8, 0.9, 0.99}; p(true) = c or 1 − c |
| Brier score | (1/N) Σ (pᵢ − oᵢ)², with Murphy's (1973) reliability − resolution + uncertainty split, grouped by stated p |
| Log score | (1/N) Σ −ln(probability given to the actual outcome); the 99% cap keeps it finite |
| Calibration curve | Folded view: accuracy of the chosen answer at each confidence level |
| Range hit rate | Share of ranges [L, U] containing the answer; 95% range from Beta(1 + h, 1 + m) |
| Winkler score | (U − L) + (2/α)·(L − y) if y < L, + (2/α)·(y − U) if y > U, with α = 1 − target |
| Common scale | log₁₀ for `scale = log` items, decades for years, otherwise relative to \|answer\|; `score_scale` overrides the divisor |
| Overconfidence gap | Stated minus actual, pooled over all answers: confidence vs. accuracy for true/false, target vs. hit for ranges |
| Cost of overconfidence | Stated σ = ln(U/L)/(2·1.645); actual σ = ln(U/L)/(2·z₍₁₊ₕ₎/₂), with h floored at 0.2; quantiles √(LU)·exp(z·σ) at z = 1.645 and 2.326 |
| Session draw | Stratified by category and difficulty so every batch has the same mix; at most one question per `event_group` per session |

**Simulated experts.** Over 200 default sessions (4 × 10, 40% true/false, 90% target), the well-calibrated persona averaged a 90.0% range hit rate and a gap of −0.2 points. The overconfident persona averaged a 57.9% hit rate, a +25.4-point gap that narrows from +36.7 in batch 1 to +14.0 in batch 4, and a Winkler score of 2.34 (width 0.57, penalty 1.77). The underconfident persona caught 98.6% of answers with a Winkler score of 1.75, worse than the calibrated persona's 1.47.

**Check.** At a 60% hit rate on a 90% range of $1M to $10M, the 1-in-20-year loss moves from $10M to $30.0M (3.0×) and the 1-in-100-year loss from $16.1M to $76.2M (4.7×).

## Using the App

- Choose a mode, 1 to 6 batches of 5 to 15 questions, a true/false share from 0% to 100% in steps of 10%, an 80% or 90% range target, and any mix of the five categories.
- The setup screen checks that the bank holds enough distinct questions of each type for the session and says how many it has if not.
- Range answers accept shorthand (4.4M, 1.2B, 38K), currency symbols, percents, commas, and negatives. Each box shows how the value was read.
- Press Enter to move to the next question. Quitting asks for confirmation inline.
- Download your answers and a summary as CSV files. Nothing is stored outside the open page.

## The Question Bank

The built-in bank is `questions.csv`: 60 questions (24 true/false, 36 range) across five categories: General, Cyber, Markets, Operational, and Regulation. Just over half (32) concern U.S. events, and they span the 1860s to the 2020s. Every answer links to a source checked on the date in `verified_on`.

| Column | Required | Notes |
|---|---|---|
| `id` | yes | Unique, such as B01 or I15 |
| `type` | yes | `binary` or `interval` |
| `question` | yes | The statement or question shown |
| `answer` | yes | TRUE/FALSE for binary; a number for interval |
| `category` | | Shown as a filter chip |
| `region`, `era` | | For balancing the bank; not shown |
| `event_group` | | Questions sharing a group never appear in the same session; defaults to the id |
| `difficulty` | | easy, medium, or hard; used to balance batches |
| `unit` | | Shown with range answers, such as USD, percent, year, months |
| `scale` | | `log` for money and counts, else `linear` |
| `explanation` | | One-line lesson shown in the review |
| `source_name`, `source_url`, `source2_name`, `source2_url` | | Shown as links in the review and log |
| `verified_on` | | Date the answer was checked |
| `score_scale` | | Optional custom divisor for the Winkler common scale |

**Updating the built-in bank.** Edit `questions.csv` in the repo, commit, and redeploy. No code changes are needed, since the app reads the file when it loads.

**Loading a bank in the browser.** Under Question Bank, open **Load your own questions**, choose a CSV, pick **Add to built-in bank** or **Replace built-in bank**, and click **Load file**. Bad rows are skipped and listed. Uploaded ids that collide with built-in ids get a `U-` prefix.

## Running Locally

There's no build step and nothing to install, but the app must be served over HTTP, because it fetches `questions.csv` and `UserGuide.md`. Opening `index.html` straight from disk won't load the bank.

```
python3 -m http.server 8000
# then open http://localhost:8000/
```

```
index.html     page structure and static Guide & Math content
styles.css     dark theme and layout
assets/        Seeking Eureka logo and favicon
questions.csv  the built-in question bank
calib.js       engine: CSV parsing, number parsing, session draws, simulated personas, scoring, summaries, cost of overconfidence
app.js         setup, question flow, batch review, SVG charts, uploads, and CSV exports
preview.png    link-preview image
UserGuide.md   plain-English user guide (source for the in-app User Guide panel)
userguide.js   renders UserGuide.md in a slide-over panel; opens on #guide
userguide.css  styles for the User Guide panel
```

## Sources

- Brier, G. W. (1950). Verification of forecasts expressed in terms of probability. *Monthly Weather Review*, 78(1), 1–3. https://doi.org/10.1175/1520-0493(1950)078%3C0001:VOFEIT%3E2.0.CO;2
- Murphy, A. H. (1973). A new vector partition of the probability score. *Journal of Applied Meteorology*, 12(4), 595–600. https://doi.org/10.1175/1520-0450(1973)012%3C0595:ANVPOT%3E2.0.CO;2
- Winkler, R. L. (1972). A decision-theoretic approach to interval estimation. *Journal of the American Statistical Association*, 67(337), 187–191. https://scholars.duke.edu/publication/1259805
- Gneiting, T., & Raftery, A. E. (2007). Strictly proper scoring rules, prediction, and estimation. *Journal of the American Statistical Association*, 102(477), 359–378. https://doi.org/10.1198/016214506000001437
- Lichtenstein, S., Fischhoff, B., & Phillips, L. D. (1982). Calibration of probabilities: The state of the art to 1980. In *Judgment under Uncertainty: Heuristics and Biases*. Cambridge University Press. https://www.cambridge.org/core/books/abs/judgment-under-uncertainty/calibration-of-probabilities-the-state-of-the-art-to-1980/9F0C9EC2997AEEB6DDDB304C2F935A16
- Hubbard, D. W. (2014). *How to Measure Anything* (3rd ed.), Chapter 5, "Calibrated Estimates." Wiley. https://www.oreilly.com/library/view/how-to-measure/9781118836446/c05.xhtml

## License

MIT © 2026 Patrick Lefler. See `LICENSE`.
