#!/usr/bin/env bash
#
# drop_learning_system_collections.sh
# ===================================
#
# One-shot script to drop the three AI Learning system collections after
# the dormant feature has been removed from the codebase.
#
# Status: DESIGNED — DO NOT RUN UNTIL:
#   1. The code-removal PR ("Removes dormant AI Learning system") has been
#      merged and deployed to production.
#   2. You have personally confirmed that `/api/learning/*` returns 404 on
#      production (no caller will be orphaned by the drop).
#   3. You have read the mongodump output below and have a viable restore
#      path if a future feature decision requires the data back.
#
# What this script does:
#   1. mongodump backup of the three target collections (full BSON + metadata)
#      to /tmp/learning_system_backup_<timestamp>/
#   2. db.safety_patterns.drop()
#   3. db.conversation_learnings.drop()
#   4. db.response_feedback.drop()
#   5. Verifies all three are gone via getCollectionNames()
#
# Safety notes:
#   - The script REFUSES to run without MONGO_URL and DB_NAME set
#     (sourced from backend/.env via the calling shell).
#   - The mongodump runs FIRST. If it fails, the script aborts before
#     dropping anything.
#   - Idempotent: if a collection is already absent, `drop()` returns
#     false but the script continues to the next.
#
# Usage:
#   set -a; source /app/backend/.env; set +a
#   bash /app/backend/scripts/drop_learning_system_collections.sh
#
# To rehearse without dropping (mongodump only):
#   DRY_RUN=1 bash drop_learning_system_collections.sh

set -euo pipefail

# ---------- Pre-flight checks ----------
: "${MONGO_URL:?MONGO_URL not set — source backend/.env first}"
: "${DB_NAME:?DB_NAME not set — source backend/.env first}"

TS="$(date -u +%Y%m%dT%H%M%SZ)"
BACKUP_DIR="/tmp/learning_system_backup_${TS}"
DRY_RUN="${DRY_RUN:-0}"

echo "================================================================"
echo "AI Learning System collection drop — ${TS}"
echo "================================================================"
echo "MONGO_URL  : ${MONGO_URL%%@*}@<redacted>"
echo "DB_NAME    : ${DB_NAME}"
echo "Backup dir : ${BACKUP_DIR}"
echo "DRY_RUN    : ${DRY_RUN}"
echo "----------------------------------------------------------------"

# ---------- Step 1: mongodump backup ----------
mkdir -p "${BACKUP_DIR}"

for COLL in safety_patterns conversation_learnings response_feedback; do
    echo "Backing up ${DB_NAME}.${COLL} → ${BACKUP_DIR}/"
    mongodump \
        --uri="${MONGO_URL}" \
        --db="${DB_NAME}" \
        --collection="${COLL}" \
        --out="${BACKUP_DIR}" \
        --quiet
done

echo ""
echo "Backup complete. Contents:"
find "${BACKUP_DIR}" -type f | sed 's|^|  |'
echo ""

if [[ "${DRY_RUN}" == "1" ]]; then
    echo "DRY_RUN=1 — stopping after backup. No collections were dropped."
    exit 0
fi

# ---------- Step 2: confirm before destructive operations ----------
read -r -p "Drop the three collections now? Type DROP to confirm: " CONFIRM
if [[ "${CONFIRM}" != "DROP" ]]; then
    echo "Aborted by user. Backup retained at ${BACKUP_DIR}."
    exit 1
fi

# ---------- Step 3: drop collections ----------
mongosh --quiet "${MONGO_URL}" <<EOF
const targetDb = db.getSiblingDB("${DB_NAME}");

print("--- Pre-drop counts ---");
["safety_patterns", "conversation_learnings", "response_feedback"].forEach(c => {
    const count = targetDb.getCollection(c).countDocuments({});
    print("  " + c + ": " + count + " rows");
});

print("\n--- Dropping ---");
["safety_patterns", "conversation_learnings", "response_feedback"].forEach(c => {
    const result = targetDb.getCollection(c).drop();
    print("  " + c + ": " + (result ? "dropped" : "absent / no-op"));
});

print("\n--- Post-drop verification (collection list filtered) ---");
const remaining = targetDb.getCollectionNames().filter(n =>
    ["safety_patterns", "conversation_learnings", "response_feedback"].includes(n)
);
if (remaining.length === 0) {
    print("  All three collections confirmed absent ✓");
} else {
    print("  WARNING — still present: " + remaining.join(", "));
}
EOF

echo ""
echo "================================================================"
echo "Done. Backup retained at ${BACKUP_DIR}."
echo "Restore command (if ever needed):"
echo "  mongorestore --uri=\"\${MONGO_URL}\" --db=\"\${DB_NAME}\" ${BACKUP_DIR}/${DB_NAME}/"
echo "================================================================"
