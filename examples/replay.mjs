#!/usr/bin/env node
// A toy of the idea behind Kaval: run BOTH versions of a change on the same
// inputs and report where the behavior differs.
//
// This is deliberately a spark, not the engine. The real Kaval sandboxes
// untrusted code with no network, mocks your dependencies, generates the
// edge-case inputs from your schemas, executes Python too, and classifies
// every flip into a verdict (pass / worth-a-look / would-block) against the
// change's stated intent. That part runs on our servers. But the core move —
// execute old and new, diff the behavior — is just this:

// Pretend this is one function, before and after a diff.
const before = (req) => {
  if (!Array.isArray(req.itemIds)) throw new Error("itemIds is not iterable");
  return req.itemIds.map((id) => ({ id }));
};
const after = (req) => {
  const ids = req.itemIds ?? [];
  return [...ids].map((id) => ({ id }));
};

// The same inputs, run against both versions.
const inputs = [
  { name: "empty request", value: {} },
  { name: "object body", value: { itemIds: { id: "x" } } },
  { name: "normal list", value: { itemIds: ["a", "b"] } },
];

function run(fn, input) {
  try {
    return JSON.stringify(fn(input));
  } catch (error) {
    return `threw: ${error.message}`;
  }
}

const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;
console.log(`\n${c(1, "kaval")} · reference replay  ${c(90, "(a toy — the real engine runs on our servers)")}\n`);

let flips = 0;
for (const { name, value } of inputs) {
  const b = run(before, value);
  const a = run(after, value);
  const changed = b !== a;
  if (changed) flips += 1;
  console.log(`  ${changed ? c(33, "⚠ CHANGED") : c(90, "  same   ")}  ${name}`);
  console.log(`     before  ${c(changed ? 31 : 90, b)}`);
  console.log(`     after   ${c(changed ? 32 : 90, a)}\n`);
}

console.log(
  `${c(1, `${flips} of ${inputs.length}`)} inputs behave differently between the two versions.`,
);
console.log(
  `Reading the diff, you'd never know. Running it, you can't miss it.\n`,
);
console.log(`Run the real thing on any public repo → ${c(36, "https://usekaval.com")}\n`);
