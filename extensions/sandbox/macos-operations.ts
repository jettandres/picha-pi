/**
 * macOS Sandbox Operations
 * 
 * Uses sandbox-exec to enforce filesystem and network restrictions
 * on macOS using Apple's native sandboxing mechanism.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname, resolve } from "node:path";
import type { BashOperations } from "@mariozechner/pi-coding-agent";

interface MacOSSandboxConfig {
	enabled?: boolean;
	securityLevel?: "strict" | "moderate" | "permissive";
	maxExecutionTime?: number;
	maxMemoryMB?: number;
	network?: {
		allowedDomains?: string[];
		deniedDomains?: string[];
	};
	filesystem?: {
		denyRead?: string[];
		allowWrite?: string[];
		denyWrite?: string[];
	};
}

interface MacOSActiveSandbox {
	id: string;
	pid: number;
	startTime: number;
	command: string;
	config: MacOSSandboxConfig;
}

const activeSandboxes: Map<string, MacOSActiveSandbox> = new Map();

function expandHome(path: string): string {
	if (path.startsWith("~/")) {
		return join(process.env.HOME || "/", path.slice(2));
	}
	return path;
}

function sanitizePath(path: string): string {
	// Prevent directory traversal attacks
	if (path.includes("../") || path.includes("..\\")) {
		throw new Error(`Access to path '${path}' denied for security reasons`);
	}
	
	// Expand home directory
	return expandHome(path);
}

function validateCommand(command: string): { valid: boolean; error?: string } {
	// Check for potentially dangerous patterns
	const dangerousPatterns = [
		/(\|\||&&)/, // Command chaining
		/;[\s\S]*;/, // Multiple commands
		/\$\(/, // Command substitution
		/`[^`]*`/, // Command substitution
		/\b(killall)\b/, // Process killing
		/\b(rm|unlink)\s+-rf\b/, // Recursive force delete
		/\b(dd\s+if=\/dev\/(zero|random))\b/, // Disk destruction
	];

	for (const pattern of dangerousPatterns) {
		if (pattern.test(command)) {
			return { 
				valid: false, 
				error: `Potentially dangerous command pattern detected: ${pattern.toString()}` 
			};
		}
	}

	// Check command length
	if (command.length > 10000) {
		return { 
			valid: false, 
			error: "Command too long (potential abuse)" 
		};
	}

	return { valid: true };
}

function loadSandboxProfile(profileDir: string, securityLevel: string): string {
	const profilePath = join(profileDir, "osx-profiles", `${securityLevel}.sb`);
	
	if (!existsSync(profilePath)) {
		throw new Error(`Sandbox profile not found: ${profilePath}`);
	}
	
	return readFileSync(profilePath, "utf-8");
}

function createDynamicProfile(
	baseProfile: string,
	config: MacOSSandboxConfig,
	cwd: string
): string {
	const safeCwd = sanitizePath(cwd);
	
	// Add working directory access to the profile
	let dynamicProfile = baseProfile;
	
	// Add working directory read and write access before the first deny
	const workdirRule = `(allow file-read* (regex #"^${safeCwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/.*)?$"))\n`;
	const workdirWriteRule = `(allow file-write* (regex #"^${safeCwd.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/.*)?$"))\n`;
	
	// Insert before the first (deny ...) rule
	const denyIndex = dynamicProfile.indexOf("(deny ");
	if (denyIndex !== -1) {
		dynamicProfile = dynamicProfile.slice(0, denyIndex) + workdirRule + workdirWriteRule + dynamicProfile.slice(denyIndex);
	} else {
		// If no deny rules, just append
		dynamicProfile += "\n" + workdirRule + workdirWriteRule;
	}
	
	// Add filesystem config rules
	if (config.filesystem) {
		if (config.filesystem.allowWrite) {
			for (const path of config.filesystem.allowWrite) {
				const safePath = sanitizePath(path);
				const allowRule = `(allow file-write* (regex #"^${safePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/.*)?$"))\n`;
				dynamicProfile += allowRule;
			}
		}
		
		if (config.filesystem.denyRead) {
			for (const path of config.filesystem.denyRead) {
				const safePath = sanitizePath(path);
				const denyRule = `(deny file-read* (regex #"^${safePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/.*)?$"))\n`;
				dynamicProfile += denyRule;
			}
		}
		
		if (config.filesystem.denyWrite) {
			for (const path of config.filesystem.denyWrite) {
				const safePath = sanitizePath(path);
				const denyRule = `(deny file-write* (regex #"^${safePath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(/.*)?$"))\n`;
				dynamicProfile += denyRule;
			}
		}
	}
	
	// For moderate security with network filtering, add proxy env var hint
	if (config.securityLevel === "moderate" && config.network?.allowedDomains) {
		dynamicProfile += "\n;; Network traffic should be filtered via HTTP_PROXY env var\n";
	}
	
	return dynamicProfile;
}

function writeTempProfile(profileContent: string): string {
	const tmpDir = "/tmp";
	const profilePath = join(tmpDir, `pi-sandbox-${Date.now()}-${Math.random().toString(36).substring(2, 10)}.sb`);
	writeFileSync(profilePath, profileContent, { mode: 0o600 });
	return profilePath;
}

function createSandboxExecCommand(command: string, profilePath: string): string {
	return `sandbox-exec -f "${profilePath}" bash -c '${command.replace(/'/g, "'\\''")}'`;
}

export function createMacOSSandboxedBashOps(
	config: MacOSSandboxConfig,
	profileDir: string
): BashOperations {
	return {
		async exec(commandInput, cwd, { onData, signal, timeout }) {
			try {
				// Validate command
				const validation = validateCommand(commandInput);
				if (!validation.valid) {
					throw new Error(validation.error);
				}
				
				if (!existsSync(cwd)) {
					throw new Error(`Working directory does not exist: ${cwd}`);
				}

				const safeCwd = sanitizePath(cwd);
				const securityLevel = config.securityLevel || "moderate";
				
				// Load base profile
				const baseProfile = loadSandboxProfile(profileDir, securityLevel);
				
				// Create dynamic profile with working directory and config rules
				const dynamicProfile = createDynamicProfile(baseProfile, config, safeCwd);
				
				// Write temporary profile
				const profilePath = writeTempProfile(dynamicProfile);
				
				// Create the sandbox-exec command
				const wrappedCommand = createSandboxExecCommand(commandInput, profilePath);
				
				const effectiveTimeout = timeout || config.maxExecutionTime || 30;

				return new Promise((resolve, reject) => {
					const child = spawn("bash", ["-c", wrappedCommand], {
						cwd: safeCwd,
						detached: true,
						stdio: ["ignore", "pipe", "pipe"],
						env: {
							...process.env,
							// Set up HTTP proxy if configured for moderate security
							...(config.securityLevel === "moderate" && config.network?.allowedDomains ? {
								HTTP_PROXY: "http://localhost:8080",
								HTTPS_PROXY: "http://localhost:8080",
								http_proxy: "http://localhost:8080",
								https_proxy: "http://localhost:8080"
							} : {})
						}
					});

					// Track active sandbox
					const sandboxId = `sandbox-${Date.now()}`;
					activeSandboxes.set(sandboxId, {
						id: sandboxId,
						pid: child.pid || 0,
						startTime: Date.now(),
						command: commandInput,
						config
					});

					let timedOut = false;
					let timeoutHandle: NodeJS.Timeout | undefined;

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
						}, effectiveTimeout * 1000);
					}

					// Capture output
					let outputBuffer = "";
					const logOutput = (data: Buffer) => {
						const chunk = data.toString();
						outputBuffer += chunk;
						onData(data);
						
						// Detect sandbox violations
						if (chunk.includes("Sandbox violation") || chunk.includes("Operation not permitted")) {
							console.warn(`Sandbox alert: Potential sandbox violation in ${sandboxId}`);
						}
					};

					child.stdout?.on("data", logOutput);
					child.stderr?.on("data", logOutput);

					child.on("error", (err) => {
						activeSandboxes.delete(sandboxId);
						if (timeoutHandle) clearTimeout(timeoutHandle);
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
					};

					signal?.addEventListener("abort", onAbort, { once: true });

					child.on("close", (code) => {
						activeSandboxes.delete(sandboxId);
						if (timeoutHandle) clearTimeout(timeoutHandle);
						signal?.removeEventListener("abort", onAbort);

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
				return Promise.reject(new Error(`Sandbox setup failed: ${error instanceof Error ? error.message : String(error)}`));
			}
		},
	};
}

export function getActiveSandboxes(): MacOSActiveSandbox[] {
	return Array.from(activeSandboxes.values());
}

export function clearActiveSandboxes(): void {
	activeSandboxes.clear();
}

export function isSandboxExecAvailable(): boolean {
	try {
		const result = spawnSync("which", ["sandbox-exec"], { stdio: "pipe" });
		return result.status === 0;
	} catch {
		return false;
	}
}
