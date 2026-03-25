# Sandbox Extension Agent Guidelines

## Key Constraint

**Working directory does not persist across commands.** Each command starts in the project root.

You can use `cd` within a single command (`bash -c "cd src && npm test"`), but not across separate calls. Use relative/absolute paths instead: `npm test --prefix ./src`.

## What Works

Most development tools work normally:
- **Package managers:** npm, yarn, pnpm, pip, cargo, gem
- **Runtimes:** node, python, go, rust, ruby
- **VCS:** git (clone, commit, push, pull, branch, merge, rebase)
- **Build:** make, gcc, go build, cargo build
- **File ops:** ls, find, cat, grep, cp, mv, rm, mkdir, touch
- **Text:** sed, awk, jq, nano, vim
- **Other:** curl, wget, tar, zip, docker exec, diff, patch, time

## What's Blocked

For security:
- Privilege escalation: `sudo`, `su`
- System: `mount`, `modprobe`, `chroot`, `iptables`, `systemctl`
- Disk: `dd`, `mkfs`, `fdisk`, `parted`
- Process: `killall`, `reboot`, `shutdown`
- Sensitive: Access to `~/.ssh`, `~/.aws`, `/etc/passwd`, etc.
- Advanced: `nmap`, `tcpdump`, `strace`, eval/exec with untrusted input

## How It Works

- **Filesystem:** Project directory is read-write; `/usr`, `/bin`, `/etc` are read-only; no access to home directory
- **Tool caches:** Go, Rust, Python cache to `/tmp` (ephemeral, not persisted)
- **Isolation:** Linux bubblewrap provides namespace isolation + capability restrictions
- **Network:** Enabled by default, configurable via security level

## Safe Deletion

Use `safe_delete path/to/file` to delete files in `.gitignore`. Blocks deletion of tracked files.

## Commands

- `/sandbox` - Show current configuration
- `/sandbox-level` - Switch security level (strict/moderate/permissive)
- `/sandbox-agents` - Show active sandboxed agents
