const fs = require("fs");
const esbuild = require("esbuild");
const config = require("./config.cjs");

const watch = process.argv.includes("--watch");
const serve = process.argv.includes("--serve");
const isDev = watch || serve || process.argv.includes("--dev");
// Set via `--set-build-env-vars=DEPLOY_TARGET=staging` on the staging Cloud Run
// deploy (see package.json's deploy:staging) so the buildpack's `gcp-build` step
// bakes in the staging API base instead of prod's, without needing a CLI flag.
const isStaging = !isDev && process.env.DEPLOY_TARGET === "staging";
const apiBase = isDev
  ? config.devApiBase
  : isStaging
    ? config.stagingApiBase
    : config.prodApiBase;
const target = isDev ? "dev" : isStaging ? "staging" : "prod";

// Opt-in: obscures the payload actually served to the client
// (dist/grass-touchers.js) so casually copying and repurposing it takes
// real effort — not the installable shell (grass-touchers.user.js), which
// is trivial by design and not worth obfuscating. This isn't real security
// (it's still JS running in the user's own browser — devtools breakpoints
// and the Network tab see the same DOM operations regardless of how the
// source looks), just a deterrent against casual copying.
//
// Not tied to isDev on purpose: combine with --dev for a one-shot build
// that's obfuscated but still points at the local API, so the obfuscated
// output can be smoke-tested against a local server before it ever ships —
// e.g. `node build.cjs --dev --obfuscate`. Has no effect combined with
// --serve/--watch (see below) since those live-rebuild paths don't run the
// obfuscation step.
const obfuscate = process.argv.includes("--obfuscate");

const OBFUSCATOR_OPTIONS = {
  compact: true,
  identifierNamesGenerator: "hexadecimal",
  stringArray: true,
  stringArrayEncoding: ["base64"],
  stringArrayThreshold: 0.75,
  // Deliberately off: control-flow flattening / dead code injection / self
  // defending / debug protection meaningfully bloat the bundle and add
  // runtime overhead, and self-defending code in particular risks visibly
  // breaking under devtools inspection — not worth it against a determined
  // reader when the goal is raising the bar on casual copying, not defeating
  // reverse engineering outright.
  controlFlowFlattening: false,
  deadCodeInjection: false,
  selfDefending: false,
  debugProtection: false,
  disableConsoleOutput: false,
};

async function build() {
  const ctx = await esbuild.context({
    entryPoints: ["src/index.js"],
    bundle: true,
    outfile: "dist/grass-touchers.js",
    format: "iife",
    target: "es2020",
    loader: { ".png": "dataurl" },
    banner: {
      js: "/* Privacy policy: https://magiceye.grasstouchers.gg/privacy */",
    },
    define: {
      __API_BASE__: JSON.stringify(apiBase),
      __STALE_AFTER_DAYS__: JSON.stringify(config.staleAfterDays),
    },
  });

  console.log(`Building for ${target} (API_BASE=${apiBase})`);

  if (serve) {
    if (obfuscate)
      console.warn(
        "--obfuscate has no effect with --serve; use a one-shot build (e.g. --dev --obfuscate) instead.",
      );
    // esbuild only binds loopback by default, which isn't reachable from
    // Windows over the WSL2 IP. Bind all interfaces instead.
    await ctx.serve({ servedir: "dist", port: 8000, host: "0.0.0.0" });
    console.log(`Serving payload at ${config.devBaseUrl}/grass-touchers.js`);
  } else if (watch) {
    if (obfuscate)
      console.warn(
        "--obfuscate has no effect with --watch; use a one-shot build (e.g. --dev --obfuscate) instead.",
      );
    await ctx.watch();
    console.log("Watching for changes...");
  } else {
    await ctx.rebuild();
    await ctx.dispose();
    console.log("Build complete: dist/grass-touchers.js");

    if (obfuscate) {
      const JavaScriptObfuscator = require("javascript-obfuscator");
      const source = fs.readFileSync("dist/grass-touchers.js", "utf8");
      const before = source.length;
      const result = JavaScriptObfuscator.obfuscate(
        source,
        OBFUSCATOR_OPTIONS,
      ).getObfuscatedCode();
      fs.writeFileSync("dist/grass-touchers.js", result);
      console.log(`Obfuscated: ${before} -> ${result.length} bytes`);
    }
  }
}

build();
