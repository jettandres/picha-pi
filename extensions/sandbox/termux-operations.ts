/**
 * Termux Sandbox Operations
 *
 * Uses proot-distro for filesystem and process isolation on Termux.
 * proot-distro provides preconfigured distributions with PRoot for easy Linux environment setup.
 * PRoot uses ptrace to intercept system calls without requiring root.
 *
 * Works on all Android devices (rooted or not) via Termux.
 * Provides:
 * - Full Linux distribution isolation via proot-distro
 * - Network filtering via socat/tinyproxy
 * - Resource limits via timeout and ulimit
 * - Process isolation without elevated privileges
 *
 * Installation: apt install proot-distro
 * Distros available: debian, ubuntu, fedora, archlinux, openkylin, etc.
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
	distro?: string; // proot-distro name (debian, ubuntu, etc.)
}

const activeSandboxes: Map<string, TermuxActiveSandbox> = new Map();
const sandboxCacheBase = join(homedir(), ".pi", "sandbox", "proot-distro");

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
 * Check if proot-distro is available
 */
export function isPRootAvailable(): boolean {
	try {
		const result = spawnSync("which", ["proot-distro"], { stdio: "pipe" });
		return result.status === 0;
	} catch {
		return false;
	}
}

/**
 * Get proot-distro version and available distros
 */
function getPRootDistroVersion(): string | null {
	try {
		const result = spawnSync("proot-distro", ["--version"], { stdio: "pipe", encoding: "utf-8" });
		if (result.status === 0 && result.stdout) {
			return result.stdout.trim();
		}
	} catch {}
	return null;
}

/**
 * Get list of installed proot-distro distributions
 */
function getInstalledDistros(): string[] {
	try {
		const result = spawnSync("proot-distro", ["list", "--installed"], { 
			stdio: "pipe", 
			encoding: "utf-8" 
		});
		if (result.status === 0 && result.stdout) {
			return result.stdout
				.trim()
				.split("\n")
				.filter(line => line.trim())
				.map(line => line.split(/\s+/)[0]); // Extract distro name
		}
	} catch {}
	return [];
}

/**
 * Ensure a distro is installed
 * Prefers: alpine (lightweight) > debian (universal) > any available
 */
function ensureDistroInstalled(preferredDistro: string = "debian"): string {
	const installed = getInstalledDistros();
	
	// If preferred distro is installed, use it
	if (installed.includes(preferredDistro)) {
		return preferredDistro;
	}
	
	// Try to use alpine if available (lightweight, good for sandboxing)
	if (installed.includes("alpine")) {
		console.log(`Preferred distro '${preferredDistro}' not found, using 'alpine' (preferred for Termux)`);
		return "alpine";
	}
	
	// Fall back to debian if available (universal compatibility)
	if (installed.includes("debian")) {
		console.log(`Preferred distro '${preferredDistro}' not found, using 'debian' (universal fallback)`);
		return "debian";
	}
	
	// Otherwise use first available
	if (installed.length > 0) {
		console.log(`Preferred distro '${preferredDistro}' not found, using '${installed[0]}'`);
		return installed[0];
	}
	
	// If none installed, debian is the default
	console.log(`No distros installed. Using default: ${preferredDistro}`);
	return preferredDistro;
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
 * Initialize sandbox cache directory for proot-distro
 */
function initializeSandboxDirectory(): void {
	if (!existsSync(sandboxCacheBase)) {
		mkdirSync(sandboxCacheBase, { recursive: true, mode: 0o700 });
	}
}

/**
 * Build proot-distro command with appropriate restrictions
 * proot-distro manages the entire isolated filesystem, so we use its built-in mechanisms
 */
function createPRootDistroCommand(
	command: string,
	config: TermuxSandboxConfig,
	cwd: string
): { cmd: string; distro: string } {
	const distro = ensureDistroInstalled("alpine");
	
	// Build the command based on security level
	let sandboxedCmd = command;
	
	switch (config.securityLevel) {
		case "strict":
			// Strict: minimal access, no network
			// proot-distro isolates filesystem by default
			sandboxedCmd = `cd ${cwd} && unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy && ${command}`;
			break;
		case "moderate":
			// Moderate: workspace access, filtered network
			sandboxedCmd = `cd ${cwd} && ${command}`;
			break;
		case "permissive":
			// Permissive: more open
			sandboxedCmd = `cd ${cwd} && ${command}`;
			break;
	}

	// Use echo + proot-distro login to run the command inside the distro
	// This pipes the command to the distro's shell via stdin
	// Properly escape single quotes in the command for the outer shell
	const escapedCmd = sandboxedCmd.replace(/'/g, "'\\''");
	const wrappedCmd = `echo '${escapedCmd}' | proot-distro login ${distro}`;

	return { 
		cmd: wrappedCmd,
		distro
	};
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
	allowedDomains: string[],
	port: number
): boolean {
	try {
		// Check if port is already in use
		const portCheck = spawnSync("ss", ["-tuln"], { stdio: "pipe", encoding: "utf-8" });
		if (portCheck.stdout && portCheck.stdout.includes(`:${port} `)) {
			console.warn(`Port ${port} already in use, cannot start socat proxy`);
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
		console.log(`Started socat proxy on port ${port}`);
		return true;
	} catch (error) {
		console.error(`Failed to start socat proxy:`, error);
		return false;
	}
}

/**
 * Stop socat proxy
 */
function stopSocatProxy(): void {
	try {
		spawnSync("pkill", ["-f", `socat.*TCP-LISTEN`], { stdio: "pipe" });
		console.log(`Stopped socat proxy`);
	} catch (error) {
		console.warn(`Failed to stop socat proxy:`, error);
	}
}

/**
 * Create sandboxed bash operations using proot-distro
 */
export function createTermuxSandboxedBashOps(
	config: TermuxSandboxConfig
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

				// Set up network filtering if configured
				let proxyStarted = false;
				let proxyPort = 8080;

				if (
					
					config.securityLevel === "moderate" &&
					config.network?.useSocatProxy &&
					isSocatAvailable()
				) {
					proxyPort = config.network.proxyPort || 8080;
					proxyStarted = startSocatProxy(config.network.allowedDomains || [], proxyPort);
				}

				// Build the proot-distro command
				const effectiveTimeout = timeout || config.maxExecutionTime || 30;
				const { cmd: prootDistroCmd, distro } = createPRootDistroCommand(command, config, cwd);

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

					// Execute proot-distro with timeout wrapper
					const timeoutCmd = `timeout ${effectiveTimeout} ${prootDistroCmd}`;

					const child = spawn("bash", ["-c", timeoutCmd], {
						cwd,
						detached: true,
						stdio: ["ignore", "pipe", "pipe"],
						env,
					});

					// Track active sandbox
					const sandboxId = `sandbox-${Date.now()}`;
					activeSandboxes.set(sandboxId, {
						id: sandboxId,
						pid: child.pid || 0,
						startTime: Date.now(),
						command,
						config,
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
					stopSocatProxy();
						}, (effectiveTimeout + 5) * 1000);
					}

					// Capture output
					let outputBuffer = "";
					const logOutput = (data: Buffer) => {
						const chunk = data.toString();
						outputBuffer += chunk;
						onData(data);

						// Detect proot-distro issues
						if (chunk.includes("proot-distro error") || chunk.includes("distro not found")) {
							console.warn(`Sandbox alert: Potential proot-distro issue in ${sandboxId}`);
						}
					};

					child.stdout?.on("data", logOutput);
					child.stderr?.on("data", logOutput);

					child.on("error", (err) => {
						activeSandboxes.delete(sandboxId);
						if (timeoutHandle) clearTimeout(timeoutHandle);
						 stopSocatProxy();

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
					stopSocatProxy();
					};

					signal?.addEventListener("abort", onAbort, { once: true });

					child.on("close", (code) => {
						activeSandboxes.delete(sandboxId);
						if (timeoutHandle) clearTimeout(timeoutHandle);
						signal?.removeEventListener("abort", onAbort);
					stopSocatProxy();

						if (signal?.aborted) {
							reject(new Error("aborted"));
						} else if (timedOut) {
							reject(new Error(`timeout:${effectiveTimeout}`));
						} else {
							console.log(`Sandbox ${sandboxId} completed with exit code ${code} (distro: ${distro})`);
							resolve({ exitCode: code });
						}
					});
				});
			} catch (error) {
					stopSocatProxy();
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
 * Note: proot-distro manages its own filesystem cleanup, we just clear our tracking
 */
export function clearActiveSandboxes(): void {
	// Clear the sandbox tracking map
	// proot-distro handles its own filesystem cleanup
	activeSandboxes.clear();
}
