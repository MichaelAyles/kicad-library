# CircuitSnips Project Rules

## Commit Requirements

### ✅ Pre-Commit Checklist

Before committing any code, you **MUST** verify:

1. **No Build Errors**
   ```bash
   npm run build
   ```
   - Build must complete successfully
   - Zero TypeScript errors
   - Zero ESLint errors

2. **No Linting Errors**
   ```bash
   npm run lint
   ```
   - All ESLint rules must pass
   - No warnings that should be errors
   - Fix all issues before committing

3. **Development Server Runs**
   ```bash
   npm run dev
   ```
   - Server must start without errors
   - No runtime errors in console
   - Pages must render correctly

4. **TypeScript Type Checking**
   ```bash
   npx tsc --noEmit
   ```
   - No type errors allowed
   - Strict mode must pass

### 🚫 Never Commit If

- `npm run build` fails
- `npm run lint` shows errors
- TypeScript compilation has errors
- Development server crashes on startup
- There are unresolved merge conflicts
- `.env.local` or other sensitive files are staged

### 📝 Commit Message Format

Follow Conventional Commits:
```
<type>: <description>

[optional body]

[optional footer]
```

**Types:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation only
- `style:` - Code style (formatting, missing semi-colons, etc.)
- `refactor:` - Code change that neither fixes a bug nor adds a feature
- `perf:` - Performance improvement
- `test:` - Adding or updating tests
- `chore:` - Build process or auxiliary tool changes

**Examples:**
```bash
git commit -m "feat: add KiCanvas viewer integration"
git commit -m "fix: escape quotes in JSX for ESLint compliance"
git commit -m "docs: update README with deployment instructions"
```

### 🔍 Pre-Push Verification

Before pushing to remote:

1. Run full verification:
   ```bash
   npm run build && npm run lint
   ```

2. Verify the commit message follows conventions

3. Check that no sensitive data is included:
   ```bash
   git diff --cached
   ```

4. Ensure `.env.local` is in `.gitignore` and not staged

### 🛠️ Automated Checks

Consider adding these Git hooks (optional):

**`.git/hooks/pre-commit`**
```bash
#!/bin/bash
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed. Please fix errors before committing."
  exit 1
fi
```

**`.git/hooks/pre-push`**
```bash
#!/bin/bash
npm run build
if [ $? -ne 0 ]; then
  echo "❌ Build failed. Please fix errors before pushing."
  exit 1
fi
```

### 🎯 Best Practices

1. **Commit Frequently**: Small, focused commits are better than large ones
2. **Test Locally First**: Always test changes locally before committing
3. **One Feature Per Commit**: Each commit should represent one logical change
4. **Write Clear Messages**: Future you (and others) will thank you
5. **Review Changes**: Use `git diff` to review what you're committing

### 🚨 Emergency Fixes

If you absolutely must commit with warnings (NOT errors):
1. Document why in the commit message
2. Create an issue to track the fix
3. Fix it in the next commit

**Never commit with errors - only warnings in exceptional cases with justification.**

## Claude Code Specific

When working with Claude Code:

1. **Always run build before committing**:
   - Use `npm run build` to verify
   - Check output for any errors
   - Only proceed if build is successful

2. **Test the application**:
   - Start dev server: `npm run dev`
   - Manually test changed pages/features
   - Verify no console errors

3. **Inform user of issues**:
   - If build fails, fix errors first
   - Never ignore ESLint errors
   - Explain what was fixed in commit message

4. **Database changes**:
   - If Prisma schema changes, run `npx prisma generate`
   - Document schema changes in commit message
   - Provide migration instructions if needed

## Enforcement

These rules are enforced by:
- Manual review (Claude Code checks before committing)
- Vercel build pipeline (will fail if build errors exist)
- ESLint in CI/CD
- TypeScript strict mode

**Breaking these rules will cause deployment failures.**
