#!/bin/bash
# Code validation script - run before deploying

echo "========================================="
echo "Code Validation Check"
echo "========================================="

ERRORS=0

# Check JavaScript syntax
echo ""
echo "1. Checking JavaScript syntax..."
for file in /app/admin-site/app.js /app/staff-portal/app.js; do
    if [ -f "$file" ]; then
        if node --check "$file" 2>&1; then
            echo "   ✅ $file - OK"
        else
            echo "   ❌ $file - SYNTAX ERROR"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

# Check for duplicate function definitions
echo ""
echo "2. Checking for duplicate functions..."
for file in /app/admin-site/app.js /app/staff-portal/app.js; do
    if [ -f "$file" ]; then
        DUPES=$(grep -oE "^function [a-zA-Z_]+|^async function [a-zA-Z_]+" "$file" | sort | uniq -d)
        if [ -n "$DUPES" ]; then
            echo "   ❌ $file has duplicate functions:"
            echo "$DUPES" | sed 's/^/      /'
            ERRORS=$((ERRORS + 1))
        else
            echo "   ✅ $file - No duplicate functions"
        fi
    fi
done

# Check for undefined functions being called
echo ""
echo "3. Checking for common undefined function calls..."
for file in /app/admin-site/app.js /app/staff-portal/app.js; do
    if [ -f "$file" ]; then
        # Check if fetchWithAuth is used but not defined
        if grep -q "fetchWithAuth" "$file" && ! grep -q "function fetchWithAuth" "$file"; then
            echo "   ❌ $file uses 'fetchWithAuth' but it's not defined (use 'apiCall' instead)"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

# Check Python syntax
echo ""
echo "4. Checking Python syntax..."
for file in /app/backend/routers/*.py /app/backend/server.py; do
    if [ -f "$file" ]; then
        if python3 -m py_compile "$file" 2>&1; then
            echo "   ✅ $file - OK"
        else
            echo "   ❌ $file - SYNTAX ERROR"
            ERRORS=$((ERRORS + 1))
        fi
    fi
done

# Check for hardcoded /app paths in Python (Render compatibility)
echo ""
echo "5. Checking for hardcoded /app paths (Render compatibility)..."
HARDCODED=$(grep -rn '"/app/' /app/backend/routers/*.py 2>/dev/null | grep -v "__pycache__")
if [ -n "$HARDCODED" ]; then
    echo "   ⚠️  Found hardcoded /app paths (may fail on Render):"
    echo "$HARDCODED" | sed 's/^/      /'
else
    echo "   ✅ No hardcoded /app paths found"
fi

# Check HTML has required script tags
echo ""
echo "6. Checking HTML script references..."
if grep -q 'src="app.js"' /app/staff-portal/index.html; then
    echo "   ✅ staff-portal/index.html loads app.js"
else
    echo "   ⚠️  staff-portal/index.html may not load app.js"
fi

echo ""
echo "========================================="
if [ $ERRORS -eq 0 ]; then
    echo "✅ All checks passed!"
else
    echo "❌ Found $ERRORS error(s) - fix before deploying"
fi
echo "========================================="

exit $ERRORS
