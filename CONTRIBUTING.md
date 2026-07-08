# Contributing Guide

## Workflow Overview

We use a **branch-per-issue** strategy. `main` is always stable and represents what is (or is ready to be) in production.

---

## Branch Naming

| Type | Pattern | Example |
|------|---------|---------|
| Bug fix | `fix/<issue-number>-short-description` | `fix/11-signout-on-init` |
| New feature | `feat/<issue-number>-short-description` | `feat/1-push-notifications` |
| Tech debt / refactor | `chore/<issue-number>-short-description` | `chore/23-extract-box-colors` |

---

## Step-by-Step Flow

### 1. Pick an issue
Go to [GitHub Issues](https://github.com/jersonjim/lexevo/issues) and pick one to work on.

### 2. Create a branch
```bash
git checkout -b fix/11-signout-on-init
```

### 3. Make changes and commit
```bash
git add <files>
git commit -m "fix: remove signOut() call on app init (#11)"
```

Commit message prefixes:
- `fix:` — bug fix
- `feat:` — new feature
- `chore:` — refactor, cleanup, tech debt
- `docs:` — documentation only

### 4. Push and open a Pull Request
```bash
git push -u origin fix/11-signout-on-init
gh pr create --title "fix: remove signOut() on init" --body "Closes #11"
```

Adding `Closes #<number>` in the PR body automatically closes the issue when the PR is merged.

### 5. Review and merge
Review the PR on GitHub. Once approved, merge into `main`. Delete the branch after merging.

---

## Priority Order

Address issues in this order:

1. 🔴 **Critical** — security and data integrity (issues #10–#13)
2. 🟠 **High** — bugs that affect users noticeably (issues #14–#16)
3. 🟡 **Medium** — correctness and code quality (issues #17–#22)
4. 🔵 **Low** — tech debt and performance (issues #23–#25)

---

## Releases

When a meaningful set of fixes or features has been merged into `main`, create a version tag:

```bash
git tag v1.0.1
git push origin v1.0.1
```

Versioning follows [Semantic Versioning](https://semver.org/):
- `v1.0.x` — bug fixes only
- `v1.x.0` — new features added
- `vx.0.0` — breaking changes

---

## Rules

- **Never commit directly to `main`**
- One issue per branch — keep PRs focused
- Delete branches after merging
- All critical and high issues must be fixed before a new feature release
