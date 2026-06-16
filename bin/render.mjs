#!/usr/bin/env node
// Render a Kaval report (the format in SPEC.md) to the terminal. Offline,
// zero-dependency: pass a path or pipe JSON in.
//
//   node bin/render.mjs examples/report.sample.json
//   cat report.json | node bin/render.mjs
import { readFileSync } from "node:fs";

const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
const bold = (s) => c(1, s);
const dim = (s) => c(90, s);

const VERDICTS = {
  blocked: { color: 31, label: "WOULD BLOCK" },
  escalated: { color: 33, label: "worth a look" },
  flagged: { color: 36, label: "flagged" },
  missed: { color: 90, label: "missed" },
  "set-aside": { color: 90, label: "set aside" },
};

function readInput() {
  const arg = process.argv[2];
  if (arg && arg !== "-") return readFileSync(arg, "utf8");
  return readFileSync(0, "utf8"); // stdin
}

let report;
try {
  report = JSON.parse(readInput());
} catch (error) {
  console.error(`Could not read a Kaval report: ${error.message}`);
  console.error(`Usage: node bin/render.mjs <report.json>  (or pipe JSON on stdin)`);
  process.exit(1);
}

const s = report.scoreboard || {};
console.log(`\n${bold(`Kaval — ${report.repo || "report"}`)}`);
if (report.scope) console.log(dim(`${report.scope.commitsScanned} commits scanned · ${report.scope.fixLike} fix-like`));
console.log("");

// Scoreboard. The denominator and the misses are the point — we don't claim
// completeness, we show what was caught against what actually happened.
if (Number.isFinite(s.analyzed)) {
  console.log(`  ${bold(`${s.flagged}/${s.analyzed}`)} changes that later needed a fix were flagged pre-merge` + (s.strong ? dim(`  (${s.strong} with executed proof)`) : ""));
  const parts = [];
  if (s.blocked) parts.push(c(31, `${s.blocked} would block`));
  if (s.escalated) parts.push(c(33, `${s.escalated} worth a look`));
  if (s.missed) parts.push(dim(`${s.missed} missed`));
  if (parts.length) console.log(`  ${parts.join(dim(" · "))}`);
  if (s.control) console.log(dim(`  ${s.control.falseBlocks} false blocks on ${s.control.clean} clean commits`));
  console.log("");
}

for (const inc of report.incidents || []) {
  const v = VERDICTS[inc.verdict] || { color: 37, label: inc.verdict || "?" };
  const where = [inc.file, inc.func].filter(Boolean).join(" · ");
  console.log(`  ${c(v.color, `[${v.label}]`)}${inc.strong ? c(v.color, " ★") : ""}  ${where || inc.title || ""}`);
  if (inc.title && where) console.log(`     ${inc.title}`);
  const e = inc.evidence || {};
  if (e.kind === "executed") {
    console.log(`     ${dim("input")}   ${e.input}`);
    console.log(`     ${dim("before")}  ${c(31, e.before)}`);
    console.log(`     ${dim("after")}   ${c(32, e.after)}`);
  } else if (e.kind === "calls") {
    for (const r of e.removed || []) console.log(`     ${c(31, "−")} ${r}`);
    for (const a of e.added || []) console.log(`     ${c(32, "+")} ${a}`);
  }
  if (inc.culprit?.sha) {
    console.log(dim(`     culprit ${inc.culprit.sha} "${inc.culprit.subject || ""}"  →  fix ${inc.fix?.sha || "?"} "${inc.fix?.subject || ""}"`));
  }
  console.log("");
}

if (report.url) console.log(dim(`Full report: ${report.url}\n`));
