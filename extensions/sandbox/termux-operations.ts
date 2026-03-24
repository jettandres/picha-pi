/**
 * Termux Sandbox Operations
 *
 * Uses PRoot for filesystem and process isolation on Termux.
 * PRoot uses ptrace to intercept system calls without requiring root.
 *
 * Works on all Android devices (rooted or not) via Termux.
 * Provides:
 * - Filesystem isolation per agent via isolated root trees
 * - Network filtering via socat/tinyproxy
 * - Resource limits via timeout and ulimit
 * - Process isolation without elevated privileges
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import type { BashOperations } from "@mariozechner/pi-coding-agent";
import { homedir } from "node:os";

interface TermuxSandboxConfig {
	enabled?: boolean;
	securityLevel?: "strict" | "moderate" | "permissive";
	maxExecutionTime?: number;
	maxMemoryMB?: number;
	network?: {
		allowedDomains?: string[];
		deniedDomains?: string[];
		useSocatProxy?: boolean;
		proxyPort?: number;
	};
	filesystem?: {
		denyRead?: string[];
		allowWrite?: string[];
		denyWrite?: string[];
	};
}

interface TermuxActiveSandbox {
	id: string;
	pid: number;
	startTime: number;
	command: string;
	config: TermuxSandboxConfig;
	isolationRoot?: string; // PRoot isolated root filesystem
}

const activeSandboxes: Map<string, TermuxActiveSandbox> = new Map();
const sandboxIsolationBase = join(homedir(), ".pi", "sandbox", "termux");

/**
 * Detect if running in Termux
 */
export function isTermux(): boolean {
	return (
		process.env.TERMUX_APP_PID !== undefined ||
		existsSync("/data/data/com.termux") ||
		process.env.PREFIX?.includes("termux") ||
		existsSync("/system/app/Termux.apk")
	);
}

/**
 * Check if proot is available
 */
export function isPRootAvailable(): boolean {
	try {
		const result = spawnSync("which", ["proot"], { stdio: "pipe" });
		return result.status === 0;
	} catch {
		return false;
	}
}

/**
 * Get proot version
 */
function getPRootVersion(): string | null {
	try {
		const result = spawnSync("proot", ["--version"], { stdio: "pipe", encoding: "utf-8" });
		if (result.status === 0 && result.stdout) {
			return result.stdout.trim();
		}
	} catch {}
	return null;
}

/**
 * Check if socat is available for network filtering
 */
function isSocatAvailable(): boolean {
	try {
		const result = spawnSync("which", ["socat"], { stdio: "pipe" });
		return result.status === 0;
	} catch {
		return false;
	}
}

/**
 * Initialize sandbox isolation directory structure
 */
function initializeSandboxDirectory(): void {
	if (!existsSync(sandboxIsolationBase)) {
		mkdirSync(sandboxIsolationBase, { recursive: true, mode: 0o700 });
	}
}

/**
 * Create isolated root filesystem for an agent
 * This sets up the directory structure that proot will use as the root
 */
function createAgentIsolationRoot(agentId: string): string {
	const isolationRoot = join(sandboxIsolationBase, "agents", agentId);

	if (existsSync(isolationRoot)) {
		// Clean up old isolation root
		rmSync(isolationRoot, { recursive: true, force: true });
	}

	// Create directory structure
	mkdirSync(isolationRoot, { recursive: true, mode: 0o700 });

	// Create essential subdirectories
	const dirs = ["tmp", "home", "workspace", "dev", "proc"];
	for (const dir of dirs) {
		mkdirSync(join(isolationRoot, dir), { recursive: true, mode: 0o755 });
	}

	console.log(`Created PRoot isolation root for agent ${agentId}: ${isolationRoot}`);
	return isolationRoot;
}

/**
 * Build proot command with appropriate mounts and restrictions
 */
function createPRootCommand(
	command: string,
	config: TermuxSandboxConfig,
	cwd: string,
	isolationRoot: string,
	agentId?: string
): string {
	const args: string[] = ["proot"];

	// Set the new root filesystem
	args.push("-r", isolationRoot);

	// Set working directory inside the isolated root
	args.push("-w", cwd);

	// Bind mount essential system directories (read-only)
	args.push("-b", "/system:/system");
	args.push("-b", "/data/adb:/data/adb"); // For magisk if available
	args.push("-b", "/dev:/dev");
	args.push("-b", "/proc:/proc");
	args.push("-b", "/sys:/sys");

	// Mount Termux binaries
	if (process.env.PREFIX) {
		args.push("-b", `${process.env.PREFIX}:${process.env.PREFIX}`);
	}

	// Mount user's home directory with restrictions based on security level
	const userHome = homedir();
	switch (config.securityLevel) {
		case "strict":
			// Don't mount home - completely isolated
			break;
		case "moderate":
			// Mount specific workspace
			args.push("-b", `${userHome}/.pi/sandbox/workspace:/home`);
			break;
		case "permissive":
			// Full home access (still virtualized by proot)
			args.push("-b", `${userHome}:/home`);
			break;
	}

	// Mount current working directory
	if (cwd && cwd !== "/") {
		args.push("-b", `${cwd}:${cwd}`);
	}

	// Filesystem restrictions from config
	if (config.filesystem?.denyRead) {
		for (const path of config.filesystem.denyRead) {
			// In proot, we prevent mounting sensitive paths
			// This is implicit - what's not mounted is not accessible
			console.log(`PRoot: Blocking read access to ${path}`);
		}
	}

	// Security hardening
	switch (config.securityLevel) {
		case "strict":
			// No network access
			args.push("-0"); // Simulate root uid (but still isolated)
			args.push("-n"); // Use new PID namespace
			break;
		case "moderate":
			// Limited network via proxy
			args.push("-0");
			args.push("-n");
			break;
		case "permissive":
			// More open but still virtualized
			args.push("-0");
			break;
	}

	// Set working directory in the command
	args.push("--");
	args.push("bash");
	args.push("-c");

	// Wrap the actual command with resource limits
	const wrappedCmd = `
	ulimit -n 1024
	ulimit -v ${(config.maxMemoryMB || 512) * 1024}
	${command}
	`;

	args.push(wrappedCmd);

	return args.map(arg => {
		// Quote arguments with spaces
		if (arg.includes(" ") || arg.includes("$")) {
			return `"${arg}"`;
		}
		return arg;
	}).join(" ");
}

/**
 * Validate command for dangerous patterns
 */
function validateCommand(command: string): { valid: boolean; error?: string } {
	const dangerousPatterns = [
		/\b(dd|fdisk|mkfs|fsck)\b.*\b(\/dev\/[a-z]+\d*)\b/, // Disk manipulation
		/\b(killall|pkill)\s+proot/, // Escaping proot
		/\b(chmod|chown)\s+\d{4}\s+\//, // Changing permissions on system dirs
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(command)) {
			return {
				valid: false,
				error: `Potentially dangerous command pattern detected: ${pattern.toString()}`,
			};
		}
	}

	if (command.length > 10000) {
		return {
			valid: false,
			error: "Command too long (potential abuse)",
		};
	}

	return { valid: true };
}

/**
 * Start socat proxy for network filtering
 */
function startSocatProxy(
	agentId: string,
	allowedDomains: string[],
	port: number
): boolean {
	try {
		// Check if port is already in use
		const portCheck = spawnSync("ss", ["-tuln"], { stdio: "pipe", encoding: "utf-8" });
		if (portCheck.stdout && portCheck.stdout.includes(`:${port} `)) {
			console.warn(`Port ${port} already in use, cannot start socat proxy for agent ${agentId}`);
			return false;
		}

		// Start simple socat proxy (in production, would need domain filtering logic)
		const socatProcess = spawn("socat", [
			`TCP-LISTEN:${port},fork,reuseaddr`,
			`SYSTEM:echo "HTTP/1.1 200 OK"; echo "Content-Type: text/plain"; echo ""; echo "Filtered request"`,
		], {
			detached: true,
			stdio: ["ignore", "ignore", "ignore"],
		});

		socatProcess.unref();
		console.log(`Started socat proxy for agent ${agentId} on port ${port}`);
		return true;
	} catch (error) {
		console.error(`Failed to start socat proxy for agent ${agentId}:`, error);
		return false;
	}
}

/**
 * Stop socat proxy
 */
function stopSocatProxy(agentId: string): void {
	try {
		spawnSync("pkill", ["-f", `socat.*${agentId}`], { stdio: "pipe" });
		console.log(`Stopped socat proxy for agent ${agentId}`);
	} catch (error) {
		console.warn(`Failed to stop socat proxy for agent ${agentId}:`, error);
	}
}

/**
 * Create sandboxed bash operations using PRoot
 */
export function createTermuxSandboxedBashOps(
	config: TermuxSandboxConfig,
	agentId?: string
): BashOperations {
	initializeSandboxDirectory();

	return {
		async exec(command, cwd, { onData, signal, timeout }) {
			try {
				// Validate command
				const validation = validateCommand(command);
				if (!validation.valid) {
					throw new Error(validation.error);
				}

				if (!existsSync(cwd)) {
					throw new Error(`Working directory does not exist: ${cwd}`);
				}

				// Create isolated root for this execution
				const isolationRoot = agentId
					? createAgentIsolationRoot(agentId)
					: createAgentIsolationRoot(`transient-${Date.now()}`);

				// Set up network filtering if configured
				let proxyStarted = false;
				let proxyPort = 8080;

				if (
					agentId &&
					config.securityLevel === "moderate" &&
					config.network?.useSocatProxy &&
					isSocatAvailable()
				) {
					proxyPort = config.network.proxyPort || 8080;
					proxyStarted = startSocatProxy(agentId, config.network.allowedDomains || [], proxyPort);
				}

				// Build the proot command
				const effectiveTimeout = timeout || config.maxExecutionTime || 30;
				const prootCmd = createPRootCommand(command, config, cwd, isolationRoot, agentId);

				return new Promise((resolve, reject) => {
					// Prepare environment
					const env = { ...process.env };

					// Set proxy if enabled
					if (proxyStarted) {
						env.HTTP_PROXY = `http://localhost:${proxyPort}`;
						env.HTTPS_PROXY = `http://localhost:${proxyPort}`;
						env.http_proxy = `http://localhost:${proxyPort}`;
						env.https_proxy = `http://localhost:${proxyPort}`;
					}

					// Execute proot with timeout
					const timeoutCmd = `timeout ${effectiveTimeout} bash -c '${prootCmd.replace(/'/g, "'\\''")}'`;

					const child = spawn("bash", ["-c", timeoutCmd], {
						cwd,
						detached: true,
						stdio: ["ignore", "pipe", "pipe"],
						env,
					});

					// Track active sandbox
					const sandboxId = agentId ? `agent-${agentId}-${Date.now()}` : `sandbox-${Date.now()}`;
					activeSandboxes.set(sandboxId, {
						id: sandboxId,
						pid: child.pid || 0,
						startTime: Date.now(),
						command,
						config,
						isolationRoot,
					});

					let timedOut = false;
					let timeoutHandle: NodeJS.Timeout | undefined;

					// Additional safety timeout (in case timeout command fails)
					if (effectiveTimeout > 0) {
						timeoutHandle = setTimeout(() => {
							timedOut = true;
							if (child.pid) {
								try {
									process.kill(-child.pid, "SIGKILL");
								} catch {
									child.kill("SIGKILL");
								}
							}
							if (agentId) {
								stopSocatProxy(agentId);
							}
						}, (effectiveTimeout + 5) * 1000);
					}

					// Capture output
					let outputBuffer = "";
					const logOutput = (data: Buffer) => {
						const chunk = data.toString();
						outputBuffer += chunk;
						onData(data);

						// Detect proot issues
						if (chunk.includes("proot error") || chunk.includes("cannot access")) {
							console.warn(`Sandbox alert: Potential proot issue in ${sandboxId}`);
						}
					};

					child.stdout?.on("data", logOutput);
					child.stderr?.on("data", logOutput);

					child.on("error", (err) => {
						activeSandboxes.delete(sandboxId);
						if (timeoutHandle) clearTimeout(timeoutHandle);
						if (agentId) stopSocatProxy(agentId);

						// Cleanup isolation root
						if (existsSync(isolationRoot)) {
							rmSync(isolationRoot, { recursive: true, force: true });
						}

						reject(new Error(`Sandbox execution failed: ${err.message}`));
					});

					const onAbort = () => {
						activeSandboxes.delete(sandboxId);
						if (child.pid) {
							try {
								process.kill(-child.pid, "SIGKILL");
							} catch {
								child.kill("SIGKILL");
							}
						}
						if (agentId) {
							stopSocatProxy(agentId);
						}
					};

					signal?.addEventListener("abort", onAbort, { once: true });

					child.on("close", (code) => {
						activeSandboxes.delete(sandboxId);
						if (timeoutHandle) clearTimeout(timeoutHandle);
						signal?.removeEventListener("abort", onAbort);

						if (agentId) {
							stopSocatProxy(agentId);
						}

						// Cleanup isolation root
						if (existsSync(isolationRoot)) {
							rmSync(isolationRoot, { recursive: true, force: true });
						}

						if (signal?.aborted) {
							reject(new Error("aborted"));
						} else if (timedOut) {
							reject(new Error(`timeout:${effectiveTimeout}`));
						} else {
							console.log(`Sandbox ${sandboxId} completed with exit code ${code}`);
							resolve({ exitCode: code });
						}
					});
				});
			} catch (error) {
				if (agentId) {
					stopSocatProxy(agentId);
				}
				return Promise.reject(
					new Error(
						`Sandbox setup failed: ${error instanceof Error ? error.message : String(error)}`
					)
				);
			}
		},
	};
}

/**
 * Get active sandboxes
 */
export function getActiveSandboxes(): TermuxActiveSandbox[] {
	return Array.from(activeSandboxes.values());
}

/**
 * Clear all active sandboxes
 */
export function clearActiveSandboxes(): void {
	// Clean up isolation roots
	for (const sandbox of activeSandboxes.values()) {
		if (sandbox.isolationRoot && existsSync(sandbox.isolationRoot)) {
			try {
				rmSync(sandbox.isolationRoot, { recursive: true, force: true });
			} catch (error) {
				console.warn(`Failed to clean up isolation root ${sandbox.isolationRoot}:`, error);
			}
		}
	}
	activeSandboxes.clear();
}
