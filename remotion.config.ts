import { existsSync } from "node:fs";
import { join } from "node:path";
import { Config } from "@remotion/cli/config";

// Reuse an installed Windows browser; elsewhere Remotion manages Headless Shell.
const windowsBrowsers = process.platform === "win32" ? [
  join(process.env.PROGRAMFILES ?? "C:\\Program Files", "Google/Chrome/Application/chrome.exe"),
  join(process.env["PROGRAMFILES(X86)"] ?? "C:\\Program Files (x86)", "Microsoft/Edge/Application/msedge.exe"),
] : [];
const browser = process.env.REMOTION_BROWSER_EXECUTABLE ?? windowsBrowsers.find(existsSync);
if (browser) Config.setBrowserExecutable(browser);
