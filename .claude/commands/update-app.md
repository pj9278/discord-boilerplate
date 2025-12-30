---
name: update-app
description: Update dependencies, fix deprecations and warnings
---

# Dependency Update & Deprecation Fix

## Step 1: Check for Updates

```bash
npm outdated
```

## Step 2: Update Dependencies

```bash
npm update
npm audit fix
```

## Step 3: Check for Deprecations & Warnings

```bash
rm -rf node_modules package-lock.json
npm install
```

Read ALL output. Look for deprecation warnings, security vulnerabilities, peer dependency warnings.

## Step 4: Fix Issues

For each warning/deprecation:
1. Research the recommended replacement
2. Update code/dependencies
3. Re-run install and verify no warnings

## Step 5: Run Quality Checks

```bash
npm run check
```

Fix all errors before completing.

## Step 6: Verify Clean Install

```bash
rm -rf node_modules package-lock.json
npm install
```

Confirm ZERO warnings/errors.
