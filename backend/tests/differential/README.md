# Session 3 — differential harness

Measures how the safeguarding path's components disagree. **Makes no fixes and
changes no production behaviour.** Nothing in `backend/` outside this directory
imports it (pinned by a test).

## What it produces

| File | Contents |
|---|---|
| `results/differential_results.csv` | one row per scenario turn, four verdict columns plus per-detector columns |
| `results/differential_results.json` | the same rows plus run metadata, environment probe, fidelity and reachability proofs, and the classified findings |
| `results/experiment_tables.md` | experiments A, B and C as measurement tables |
| `results/test_inventory.json` | all 67 test files classified per Ant's point 7 |

No raw message text is written to any results file — scenario IDs and sha256
prefixes only.

## The four verdict columns

Never collapsed, because three different inputs contend for the outcome:

1. `legacy_*` — `calculate_safeguarding_score` (`server.py:1440–1694`)
2. `unified_*` — `analyze_message_unified` raw output
3. `reconciled_*` — `reconcile_verdicts`
4. `runtime_*` — what the client actually receives

## Running it

From `backend/`. Environment setup is in the Session 3 handover; in short:

```bash
grep -v -E "emergentintegrations|agora[-_]token[-_]builder" requirements.txt > /tmp/reqs.txt
pip install -r /tmp/reqs.txt --break-system-packages -q --ignore-installed PyJWT
```

Offline half (no OpenAI needed):

```bash
JWT_SECRET_KEY=x ADMIN_SEED_PASSWORD=y MONGO_URL=mongodb://localhost:27017 \
OPENAI_API_KEY=sk-test-dummy GEMINI_API_KEY=dummy TEST_ADMIN_PASSWORD=dummy \
python3 -m tests.differential.harness --out tests/differential/results
python3 -m tests.differential.analyse --results tests/differential/results
```

Live half — **needs a real key, so it runs on Andrew's machine, not in a sandbox**:

```bash
JWT_SECRET_KEY=x ADMIN_SEED_PASSWORD=y MONGO_URL=mongodb://localhost:27017 \
OPENAI_API_KEY=<real key> GEMINI_API_KEY=dummy TEST_ADMIN_PASSWORD=dummy \
python3 -m tests.differential.harness --live --force-classifier \
    --out tests/differential/results-live
python3 -m tests.differential.analyse --results tests/differential/results-live
```

Estimated cost of the live run: 76 turns × (1 classifier call + up to 1
normaliser call + embeddings) on gpt-4o-mini — under £0.10.

`--force-classifier` calls the classifier **directly**, bypassing
`should_invoke_ai_classifier()` for the harness only. The production gate is not
edited, not monkeypatched, and not affected.

Test-file inventory (slow, ~6 min — one pytest process per file):

```bash
python3 -m tests.differential.inventory --out tests/differential/results
```

## Windows

`python3`, `grep` and `VAR=value command` are all bash/Linux-only. Two working
routes on Windows:

**Docker (recommended — no Python install at all).** From the repo root:

```
docker build -t radiocheck-probe -f backend/tests/differential/Dockerfile .
docker run --rm -it -v "%cd%:/repo" radiocheck-probe
```

Your working tree is mounted, so edits apply without rebuilding.

**Native Python.** Install real Python from python.org (the "Microsoft Store"
message means you have the stub, not Python), ticking *Add python.exe to PATH*.
Then, once:

```
cd C:\path\to\Radiocheck\backend
python -m tests.differential.setup_env
```

and after that:

```
tests\differential\probe.bat
```

`probe.bat` sets the environment variables, finds `py` or `python`, and forwards
any arguments to the CLI. `setup_env.py` replaces the grep/heredoc pipeline and
works on every platform.

## Hand-testing a message (the CLI probe)

```bash
JWT_SECRET_KEY=x ADMIN_SEED_PASSWORD=y MONGO_URL=mongodb://localhost:27017 \
OPENAI_API_KEY=sk-test-dummy GEMINI_API_KEY=dummy TEST_ADMIN_PASSWORD=dummy \
python3 -m tests.differential.cli
```

Type a message, get all four verdict columns, the detector outputs, the gate
state, the normaliser triggers, the protocol files, every override applied, and
the classified disagreements. Session state persists between lines, so grief
persistence and `crisis_override` clearing can be walked through by hand.

One-shot: `python3 -m tests.differential.cli -m "your message here"`.
Add `--live` (real key) to light up the classifier, embeddings and normaliser;
the banner says which layers are dark. `--json` dumps the raw row.

In-prompt commands: `:reset` `:state` `:json` `:under18 on|off` `:force`
`:help` `:quit`.

Read-only. No writes, no database, no production behaviour touched.

## Modules

- `corpus.json` — scenarios. All existing test material or synthetic controls; no live user conversations.
- `harness.py` — the runner.
- `runtime_chain.py` — **transcription** of the inline decision logic in `buddy_chat`, which cannot be imported. Hash-guarded against its source; see below.
- `reachability.py` — AST proof of which corrective branches can execute.
- `classify.py` — sorts each disagreement into Ant's five categories.
- `analyse.py` — markdown tables.
- `inventory.py` — the test-file classification (68 files: 67 on main plus this PR's guard test).
- `cli.py` — interactive probe, above.
- `setup_env.py` — cross-platform dependency install + agora stub.
- `probe.bat`, `Dockerfile` — Windows launchers.

## Why there is a transcription, and how it is kept honest

The authoritative `risk_level` is produced by ~370 lines inside the
`/api/ai-buddies/chat` handler, not by any importable function. To report it as
its own column, `runtime_chain.py` transcribes it.

Two guards, both in `backend/tests/test_differential_harness.py`:

1. **Region hashes.** The transcribed regions of `server.py` are located by
   anchor comments (not line numbers, which drift) and hashed. Any edit fails
   the test.
2. **Reachability premise.** The proof that five corrective branches are dead
   depends on the failsafe block returning unconditionally. That is re-asserted
   from the AST every run.

If either fails, the Session 3 numbers describe code that has changed. Re-run
the harness, re-pin with `python3 -m tests.differential.runtime_chain --repin`,
and say so in the PR.
