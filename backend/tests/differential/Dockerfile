# RadioCheck safeguarding probe — containerised.
#
# The easiest route on Windows: no Python install, no PATH problems, no
# 170-package native build. Build context is the REPO ROOT, not this directory.
#
#   docker build -t radiocheck-probe -f backend/tests/differential/Dockerfile .
#   docker run --rm -it -v "%cd%:/repo" radiocheck-probe          (Windows CMD)
#   docker run --rm -it -v "$PWD:/repo" radiocheck-probe          (bash)
#
# Your working tree is mounted at /repo, so edits take effect immediately
# without rebuilding. Rebuild only when requirements.txt changes.
#
# With a real key, to light up the classifier, embeddings and normaliser:
#   docker run --rm -it -e OPENAI_API_KEY=sk-... -v "%cd%:/repo" \
#       radiocheck-probe python -m tests.differential.cli --live
#
# To run the full harness instead of the interactive probe:
#   docker run --rm -it -v "%cd%:/repo" radiocheck-probe \
#       python -m tests.differential.harness --out tests/differential/results

FROM python:3.12-slim

# build tools for the few packages without wheels
RUN apt-get update \
 && apt-get install -y --no-install-recommends build-essential git \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /repo/backend

# Dependencies are baked into the image so the mounted tree stays clean.
# Copied before the mount exists, hence the explicit path from the repo root.
COPY backend/requirements.txt /tmp/requirements.txt
RUN python - <<'PY'
import re
skip = re.compile(r"emergentintegrations|agora[-_]token[-_]builder", re.I)
lines = open("/tmp/requirements.txt", encoding="utf-8").read().splitlines()
open("/tmp/reqs.txt", "w", encoding="utf-8").write(
    "\n".join(l for l in lines if not skip.search(l)) + "\n")
PY
RUN pip install --no-cache-dir -q -r /tmp/reqs.txt

# agora_token_builder has no installable distribution; stub it in site-packages
# (never in the repo) so imports resolve.
RUN python - <<'PY'
import sysconfig, os
open(os.path.join(sysconfig.get_paths()["purelib"], "agora_token_builder.py"),
     "w", encoding="utf-8").write('''
class RtcTokenBuilder:
    @staticmethod
    def buildTokenWithUid(*a, **k): return "stub-token"
    @staticmethod
    def buildTokenWithAccount(*a, **k): return "stub-token"


class RtmTokenBuilder:
    @staticmethod
    def buildToken(*a, **k): return "stub-token"
'''.lstrip())
PY

# The probe reads no database and sends nothing. These exist only to satisfy
# import-time configuration checks in server.py.
ENV JWT_SECRET_KEY=x \
    ADMIN_SEED_PASSWORD=y \
    MONGO_URL=mongodb://localhost:27017 \
    OPENAI_API_KEY=sk-test-dummy \
    GEMINI_API_KEY=dummy \
    TEST_ADMIN_PASSWORD=dummy \
    PYTHONUNBUFFERED=1

CMD ["python", "-m", "tests.differential.cli"]
