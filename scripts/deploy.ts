// Deploys Kanakku Pulla: Cloud Run (scales to zero) behind Firebase Hosting (free URL and CDN).
//   npm run deploy       deploy, safe to re-run
//   npm run deploy:dry   print the commands, change nothing
// The project id comes from `.env`. The whole `.env` goes to Secret Manager, never into the upload or the image.
import { spawnSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";
import { getConfig } from "../lib/config";

const SERVICE = "kanakku-pulla"; // also in firebase.json
const REGION = "asia-south1"; // also in firebase.json
const SECRET = `${SERVICE}-env`;
const RUNTIME_SA = `${SERVICE}-run`;
const IMAGE_REPO = "cloud-run-source-deploy"; // created by the first source deploy

const DRY_RUN = process.argv.includes("--dry-run");
const project = getConfig().gcpProjectId;

const gcloud = (...args: string[]) => ["gcloud", ...args, `--project=${project}`, "--quiet"];

// A single quoted line, not an args array: gcloud and firebase are .cmd files on Windows and need a shell.
const toLine = (args: string[]) => args.map((a) => (/^[\w./:@=-]+$/.test(a) ? a : `"${a}"`)).join(" ");

/** Changes something. Echoed, and skipped on a dry run. Returns false on failure. */
function run(args: string[]): boolean {
  const line = toLine(args);
  console.log(`\n$ ${line}`);
  return DRY_RUN || spawnSync(line, { shell: true, stdio: "inherit" }).status === 0;
}

/** Reads something. Returns stdout, or null on failure (and always on a dry run). */
function read(args: string[]): string | null {
  const line = toLine(args);
  if (DRY_RUN) {
    console.log(`\n$ ${line}`);
    return null;
  }
  const res = spawnSync(line, { shell: true, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return res.status === 0 ? res.stdout.trim() : null;
}

function fail(message: string): never {
  console.error(`\nDeploy stopped: ${message}`);
  process.exit(1);
}

function must(args: string[]) {
  if (!run(args)) fail(`this command failed: ${toLine(args)}`);
}

/** Uploads `.env` as the newest secret version and destroys older ones, so one active version is ever billed. */
function uploadEnv() {
  if (read(gcloud("secrets", "describe", SECRET)) === null) {
    must(gcloud("secrets", "create", SECRET, "--replication-policy=automatic"));
  }
  must(gcloud("secrets", "versions", "add", SECRET, "--data-file=.env"));
  const names = read(gcloud("secrets", "versions", "list", SECRET, "--filter=state:ENABLED", "--format=value(name)")) ?? "";
  const versions = names.split(/\s+/).map((n) => Number(n.split("/").pop())).filter((n) => n > 0);
  for (const old of versions.sort((a, b) => b - a).slice(1)) {
    run(gcloud("secrets", "versions", "destroy", String(old), `--secret=${SECRET}`));
  }
}

/** The app calls no GCP APIs, so its identity gets read access to this one secret and nothing else. */
async function ensureRuntimeAccount(email: string) {
  if (read(gcloud("iam", "service-accounts", "describe", email)) === null) {
    must(gcloud("iam", "service-accounts", "create", RUNTIME_SA, "--display-name=Kanakku Pulla runtime"));
  }
  const bind = gcloud(
    "secrets", "add-iam-policy-binding", SECRET,
    `--member=serviceAccount:${email}`, "--role=roles/secretmanager.secretAccessor", "--format=none",
  );
  // A brand-new service account can take a few seconds to become visible to IAM.
  for (let attempt = 0; attempt < 4; attempt++) {
    if (run(bind)) return;
    await sleep(5000);
  }
  fail("could not give the runtime service account access to the secret.");
}

/** Calls the live API once, so a broken secret mount or bad AI key shows up here and not during a demo. */
async function smokeTest(url: string) {
  try {
    const res = await fetch(`${url}/api/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "Never pay more than ₹5000 in a single payment." }),
      signal: AbortSignal.timeout(30_000),
    });
    const body = (await res.json()) as { mode?: string; store?: string };
    console.log(`\nSmoke test: HTTP ${res.status}, mode=${body.mode}, store=${body.store}`);
    if (body.mode === "fallback") {
      console.warn("The app works, but no AI provider answered. Check the keys and credits in .env, then re-deploy.");
    }
  } catch (err) {
    console.warn(`\nSmoke test could not reach ${url}: ${err instanceof Error ? err.message : "unknown error"}`);
  }
}

async function main() {
  if (!project) fail("GCP_PROJECT_ID is empty. Set it in .env.");
  if (!DRY_RUN) {
    if (read(["gcloud", "--version"]) === null) fail("gcloud is not installed or not on PATH.");
    const account = read(["gcloud", "auth", "list", "--filter=status:ACTIVE", "--format=value(account)"]);
    if (!account) fail("gcloud is not logged in. Run: gcloud auth login");
  }

  // Checked up front so a Firebase problem is known before the build, not after it. Not fatal: Cloud Run still deploys.
  const hosting = DRY_RUN || read(["firebase", "hosting:sites:list", `--project=${project}`, "--non-interactive"]) !== null;
  if (!hosting) {
    console.warn(`\nFirebase Hosting will be skipped. Run "firebase login", and "firebase projects:addfirebase ${project}" if this project isn't on Firebase yet.`);
  }

  must(gcloud(
    "services", "enable", "run.googleapis.com", "cloudbuild.googleapis.com", "artifactregistry.googleapis.com",
    "secretmanager.googleapis.com", "firebasehosting.googleapis.com",
  ));

  // Source deploys build as the default compute service account, which needs this role.
  const projectNumber = read(gcloud("projects", "describe", project, "--format=value(projectNumber)")) ?? (DRY_RUN ? "PROJECT_NUMBER" : null);
  if (!projectNumber) fail(`could not read project "${project}". Check GCP_PROJECT_ID and your gcloud account.`);
  must(gcloud(
    "projects", "add-iam-policy-binding", project,
    `--member=serviceAccount:${projectNumber}-compute@developer.gserviceaccount.com`,
    "--role=roles/run.builder", "--condition=None", "--format=none",
  ));

  uploadEnv();
  const runtimeEmail = `${RUNTIME_SA}@${project}.iam.gserviceaccount.com`;
  await ensureRuntimeAccount(runtimeEmail);

  const deployed = run(gcloud(
    "run", "deploy", SERVICE, "--source=.", `--region=${REGION}`,
    `--service-account=${runtimeEmail}`, `--set-secrets=/secrets/.env=${SECRET}:latest`,
    "--allow-unauthenticated", // Firebase Hosting rewrites need a public service
    "--min-instances=0", "--max-instances=2", "--cpu-throttling", // scale to zero, cap spend, bill only during requests
    "--cpu=1", "--memory=512Mi", "--concurrency=40", "--timeout=60",
  ));
  if (!deployed) fail("the Cloud Run deploy failed. On a first deploy the build role can take a couple of minutes to apply, so wait and re-run.");

  // Each deploy stores a new image. Not fatal if this fails: it only affects storage cost.
  run(gcloud(
    "artifacts", "repositories", "set-cleanup-policies", IMAGE_REPO, `--location=${REGION}`,
    "--policy=scripts/ar-cleanup-policy.json", "--no-dry-run",
  ));

  // Always after Cloud Run: this also clears the CDN, which could otherwise serve pages from the previous build.
  const hostingLive = hosting && run(["firebase", "deploy", "--only", "hosting", `--project=${project}`, "--non-interactive"]);
  if (!hostingLive && !DRY_RUN) {
    console.warn("\nFirebase Hosting was not updated, so its URL may serve the previous build. The Cloud Run URL below is current.");
  }

  if (DRY_RUN) return console.log("\nDry run: nothing was changed.");
  const url = read(gcloud("run", "services", "describe", SERVICE, `--region=${REGION}`, "--format=value(status.url)"));
  if (url) await smokeTest(url);
  console.log(`\nCloud Run URL: ${url ?? "(could not read it, see the Cloud Run console)"}`);
  if (hostingLive) console.log('Firebase URL:  see "Hosting URL" above');
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : "Deploy failed.");
  process.exit(1);
});
