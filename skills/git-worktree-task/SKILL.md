---
name: git-worktree-task
description: Git worktree workflow for isolated task development. Use when starting a new task/feature that should be developed in isolation - creates a worktree + branch, works inside it, then cleans up after merging.
---

# Git Worktree Task Workflow

**⚠️ Commit Often, Merge Later**: Development workflow:
1. **Make small, atomic commits** as you work - one logical change per commit
2. **Each commit should be reviewable** on its own with a clear purpose
3. **Present all commits** to the user for review when complete
4. **Wait for approval** before merging to main

---

**Important**: Always create worktrees **outside** the main repository directory to avoid nested git repositories and keep the main repo clean.

## Start a Task

Create a worktree and branch before touching any code:

```bash
# From the main repository root, create worktree in parent directory
git worktree add ../<worktree-name> -b <branch-name>
cd ../<worktree-name>
```

The worktree will be created as a sibling directory to your main repository:
```
parent/
├── main-repo/          # Your main repository
└── worktree-name/      # Isolated worktree (outside main repo)
```

Naming conventions vary by project. Check the project's agent or KANBAN docs for the expected format.

## During Work

- Do **all** work inside the worktree directory.
- Touch only files relevant to the task. No unrelated refactors.
- **Commit early and often** with small, focused commits.

### Commit Strategy

Make **atomic commits** - each commit should represent one logical change:

✅ **Good examples**:
- `git commit -m "Add User struct with validation"`
- `git commit -m "Implement repository interface for User"`
- `git commit -m "Add integration tests for User repository"`
- `git commit -m "Update documentation for User API"`

❌ **Avoid**:
- One massive commit with all changes
- Mixing unrelated changes (e.g., "Add feature and fix typo and refactor")
- Vague messages (e.g., "WIP", "updates", "fixes")

### When to Commit

Commit after completing each discrete piece of work:
1. Added a new function/struct/module → commit
2. Implemented a test suite → commit
3. Updated documentation → commit
4. Fixed a related issue → commit
5. Refactored for clarity → commit (separate from feature changes)

```bash
# After each logical change:
git add <relevant-files>
git commit -m "<specific, descriptive message>"
```

## Final Check (When Task is Complete)

Before presenting for review, ensure nothing is left uncommitted:

```bash
# Check for uncommitted changes
git status

# If there are uncommitted changes, commit them now
git add <remaining-files>
git commit -m "<descriptive message>"
```

## Present for Review

Once all work is committed, present a complete summary:

```bash
# Show all commits made in this branch
git log --oneline --graph main..<branch-name>

# Show detailed summary of all changes
git log --stat main..<branch-name>

# Or show each commit's diff (for detailed review)
git log -p main..<branch-name>
```

Inform the user with:
- 📍 **Worktree location**: `../<worktree-name>`
- 🌿 **Branch name**: `<branch-name>`
- 📝 **Commits made**: (show output from `git log --oneline --graph main..<branch-name>`)
- 📊 **Summary**: (show output from `git log --stat main..<branch-name>`)
- 💬 **Request**: "Please review the commits above. Each commit represents a logical change. If approved, I'll merge to main and cleanup the worktree."

**🛑 STOP HERE and wait for user approval. Do not merge yet.**

## Merge and Cleanup (After User Approval)

Once the user approves, merge and cleanup:

```bash
# Return to main repository
cd ../main-repo

# Merge the branch
git merge <branch-name>

# Remove the worktree
git worktree remove ../<worktree-name>

# Delete the branch
git branch -d <branch-name>
```

Confirm completion:
- ✅ Merged to main
- ✅ Worktree removed
- ✅ Branch deleted
