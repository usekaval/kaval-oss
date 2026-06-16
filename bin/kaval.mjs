#!/usr/bin/env node
// The thin client. The engine — which executes your code in a sandbox — runs
// on Kaval's servers; this just drives it and streams the result. The offline
// pieces (examples/replay.mjs, bin/render.mjs) need none of this.
//
//   KAVAL_TOKEN=... npx @usekaval/kaval dubinc/dub
//
// Running a repo requires a free GitHub sign-in (that's how leads/quota work).
// Grab your token from https://usekaval.com (Account → API token) and set
// KAVAL_TOKEN. Viewing finished reports needs nothing — they live at a URL.
const API = (process.env.KAVAL_API || "https://app.usekaval.com").replace(/\/$/, "");
const TOKEN = process.env.KAVAL_TOKEN || "";
const c = (code, s) => `\x1b[${code}m${s}\x1b[0m`;

const repo = (process.argv[2] || "").replace(/^https?:\/\/github\.com\//i, "").replace(/\.git$/i, "");
if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) {
  console.error(`Usage: kaval <owner/repo>\n  e.g. kaval dubinc/dub`);
  process.exit(1);
}

const auth = TOKEN ? { authorization: `Bearer ${TOKEN}` } : {};

async function main() {
  const start = await fetch(`${API}/api/deep-scout`, {
    method: "POST",
    headers: { "content-type": "application/json", ...auth },
    body: JSON.stringify({ repo }),
  }).then((r) => r.json()).catch(() => ({ ok: false }));

  if (start?.error?.code === "auth_required") {
    console.error(`Running a repo needs a free GitHub sign-in. Two options:`);
    console.error(`  • paste ${repo} at ${c(36, "https://usekaval.com")} (no setup), or`);
    console.error(`  • set KAVAL_TOKEN (Account → API token) and re-run.`);
    process.exit(1);
  }
  if (start?.ok === false) {
    console.error(start?.error?.message || "Could not start the run.");
    process.exit(1);
  }

  console.log(`\n${c(1, "kaval")} · running on ${c(36, repo)}  ${c(90, "(executing both versions of each change)")}\n`);
  const seen = new Set();
  for (let i = 0; i < 720; i += 1) {
    const poll = await fetch(`${API}/api/deep-scout?repo=${encodeURIComponent(repo)}`).then((r) => r.json()).catch(() => ({}));
    for (const ev of poll.events || []) {
      const key = JSON.stringify(ev);
      if (seen.has(key)) continue;
      seen.add(key);
      if (ev.phase === "clone") console.log(`  ${c(32, "✓")} cloned ${ev.repo}`);
      else if (ev.phase === "screen") console.log(`  ${c(32, "✓")} screened ${ev.commits} commits (${ev.fixLike} fix-like)`);
      else if (ev.phase === "incidents") console.log(`  ${c(32, "✓")} found ${ev.total} changes that later needed a fix — replaying each\n`);
      else if (ev.phase === "incident") {
        const tag = ev.decision === "block" ? c(31, "would block") : ev.decision === "escalate" ? c(33, "worth a look") : ev.status === "hit" ? c(36, "caught") : c(90, ev.status);
        console.log(`     [${tag}] ${ev.subject}`);
      }
    }
    if (poll.status === "done") {
      const s = poll.summary || {};
      console.log(`\n${c(1, `${s.hits}/${s.analyzed}`)} flagged pre-merge` + (s.strongHits ? c(90, `  (${s.strongHits} with executed proof)`) : ""));
      console.log(`Full report → ${c(36, `${API}/run/${repo}`)}\n`);
      return;
    }
    if (poll.status === "error") {
      console.error(`\nRun failed: ${poll.error || "unknown error"}`);
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  console.error("Timed out waiting for the run.");
  process.exit(1);
}

main().catch((error) => { console.error(error.message); process.exit(1); });
