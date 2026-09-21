import { spawn, spawnSync } from "node:child_process";
import path from "node:path";

const isWindows = process.platform === "win32";
const supabaseBinary = path.join(
  process.cwd(),
  "node_modules",
  "supabase",
  "bin",
  isWindows ? "supabase.exe" : "supabase",
);
const nextBinary = path.join(
  process.cwd(),
  "node_modules",
  "next",
  "dist",
  "bin",
  "next",
);

const status = spawnSync(supabaseBinary, ["status", "-o", "env"], {
  cwd: process.cwd(),
  encoding: "utf8",
});

if (status.status !== 0) {
  process.stderr.write(status.stderr || status.stdout);
  console.error(
    "\nLocal Supabase is not ready. Start Docker Desktop, run npx supabase start, then retry npm run dev.",
  );
  process.exit(status.status ?? 1);
}

const localEnvironment = Object.fromEntries(
  status.stdout
    .split(/\r?\n/)
    .map((line) => line.match(/^([A-Z_]+)=(?:"(.*)"|(.*))$/))
    .filter(Boolean)
    .map((match) => [match[1], match[2] ?? match[3] ?? ""]),
);

const url = localEnvironment.API_URL;
const publishableKey =
  localEnvironment.PUBLISHABLE_KEY || localEnvironment.ANON_KEY;
const secretKey =
  localEnvironment.SECRET_KEY || localEnvironment.SERVICE_ROLE_KEY;

if (!url || !publishableKey || !secretKey) {
  console.error(
    "Supabase status did not return API_URL, a public key, and a server secret key. Update the Supabase CLI and retry.",
  );
  process.exit(1);
}

console.log(`Starting CFA against local Supabase at ${url}`);

const next = spawn(process.execPath, [nextBinary, "dev", "--webpack"], {
  cwd: process.cwd(),
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: url,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    SUPABASE_SECRET_KEY: secretKey,
  },
  stdio: "inherit",
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => next.kill(signal));
}

next.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 0);
});
