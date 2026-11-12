# Expert Calibration Trainer: A Plain-English Guide

## The Big Idea

Every risk model runs on expert estimates. How often will a vendor have an outage? What would a breach cost? If the experts behind those numbers are overconfident, the model looks precise and is wrong.

An expert is **calibrated** when their confidence matches their results. Across everything they're 70% sure of, they're right about 70% of the time. Their 90% ranges catch the true answer about 90% of the time.

Most people aren't calibrated at first. Their 90% ranges often catch the answer only half the time. The good news is that calibration can be measured, and it improves with practice and feedback. This app gives you both.

## How a Session Works

1. **Set up.** Pick "Take the test" or "Simulated expert," the number of batches, questions per batch, the true/false share, a 90% or 80% range target, and the categories. The default is 4 batches of 10 questions, 40% true/false, with a 90% target.
2. **Answer a batch.** True/false questions get an answer and a confidence: 50%, 60%, 70%, 80%, 90% or 99%. Range questions get a low and a high value you're 90% sure contains the answer.
3. **Review it.** After each batch, you see every answer, the truth, a one-line lesson, and a source. You also get one coaching tip based on how you did.
4. **Repeat, then read your results.** Each batch has the same mix of topics and difficulty, so a change in your results reflects you, not easier questions.

The app draws questions at random each time, so no two sessions are the same. Two questions about the same event never appear in one session.

## Typing Range Answers

You can type numbers the way you'd say them:

- **Shorthand:** 4.4M, 1.2B, 38K, 2T
- **Money and percents:** $460M, 9.1%
- **Commas and negatives:** 1,200, -37.63

The app shows what it read under each box, such as "= $4.4B," so you can catch typos before moving on. The low end must be below the high end. Money and count questions need values above 0.

## Reading Your Results

- **Brier score:** How far your true/false confidence was from what happened. Lower is better. Saying 50% every time scores 0.25.
- **Overconfidence gap:** Your stated confidence minus your actual results, in percentage points. Positive means overconfident. Near zero is the goal.
- **Range hit rate:** The share of your ranges that caught the answer, with a 95% range, since 24 ranges is a small sample. If even the top of that range is below your target, you're very likely overconfident, not unlucky.
- **Winkler score:** Charges you for the width of each range, plus a penalty for each miss. It stops you from gaming the hit rate with silly ranges like "1 to a trillion." Lower is better.
- **Log score:** Like the Brier score, but much harsher on confident mistakes. Saying 50% every time scores 0.693.
- **Improvement trend:** How your overconfidence gap changed from the first batch to the last.
- **Cost of overconfidence:** What your hit rate would do to a real loss estimate. See below.

The **calibration curve** plots your confidence against how often you were right. Points on the dashed diagonal are perfect. Points below it mean you were right less often than you claimed. The gold diamond shows your ranges.

## Why Confidence Stops at 99%

You can't choose 100%, and that's on purpose.

The log score charges you the negative log of the chance you gave to what happened. Being wrong at 90% costs 2.30. Being wrong at 99% costs 4.61. Being wrong at 100% would cost infinity. One slip would wipe out every other answer in the session.

There's a practical reason too. Even experts misremember well-known facts and misread questions. If you're tempted to say 100%, 99% says almost the same thing while leaving room for the mistake you haven't spotted.

## The Cost of Overconfidence

Suppose you gave a 90% range of $1M to $10M for a yearly cyber loss. Loss models, such as FAIR-style tools, fit a curve to that range and read off the tail. If your 90% ranges actually catch the answer only 60% of the time, your real uncertainty is much wider than you said.

At a 60% hit rate, the 1-in-20-year loss is about $30M, not $10M. That's three times higher. The 1-in-100-year loss is nearly five times higher. Your overconfidence doesn't just make a quiz score worse. It hides the losses a board most needs to see.

## Simulated Experts

Simulated mode answers a whole session for you as one of three personas:

- **Well-calibrated:** Its confidence matches its real chances, and its 90% ranges catch about 90% of answers.
- **Overconfident:** Starts out far too sure of itself, with ranges that catch less than half of answers in batch 1. It improves each batch, to show what training looks like. Across many runs, its ranges catch about 58% of answers.
- **Underconfident:** Claims too little confidence and gives ranges so wide they almost never miss. The Winkler score still charges it for all that width.

Results carry a banner so you won't mistake them for your own. Each run draws new questions, so results vary.

## Loading Your Own Questions

Open **Load your own questions** under Question Bank:

1. Click **Download built-in bank as a template** to get the CSV with every column.
2. Edit it or start fresh. Only four columns are required: `id`, `type` (binary or interval), `question`, and `answer` (TRUE or FALSE for binary, a number for interval).
3. Choose **Add to built-in bank** or **Replace built-in bank**, then click **Load file**.

Rows with problems are skipped and listed. If one of your ids matches a built-in id, it gets a "U-" prefix. **Restore built-in bank only** undoes the upload.

Your file stays in your browser. Nothing is uploaded anywhere, and it's gone when you close the tab.

## Things to Try

- Run the **Overconfident** expert, then the **Well-calibrated** one. Compare the curves and the cost card.
- Take the test at a 90% target, then try 80% next time. Many people find 80% ranges easier to set honestly.
- On a range question, try the **equivalent-bet test**. Would you rather win $1,000 if the answer is in your range, or on a spin that pays 90% of the time? If you'd take the spin, widen your range.
- Download your answers and summary as CSV files to track your progress across sessions.

## Fine Print

This is a training tool, not a validated assessment of anyone's judgment, and not investment or regulatory advice. Built-in answers were checked against the linked sources on the dates shown in the question bank. The math is explained step by step in the Guide & Math tab.
