// When the last program deploy, or the last use of the build hook, started, from this workflow's own runs on
// GitHub (.github/workflows/rebuild.yml). A program deploy is a run whose rebuild job is named PROGRAM_DEPLOY_JOB
// (after a program change, or a forced run) and whose HOOK_STEP succeeded, so Netlify accepted the build. A use of
// the hook is any run whose HOOK_STEP succeeded. A run that failed later, while it waited for the live site, still
// counts. The time is the run's start, as the refresh policy compares run starts.
// scripts/rebuild-today.mjs calls these only when the refresh policy needs them (scripts/refresh-policy.mjs). They
// need GH_TOKEN with `actions: read`, and read GITHUB_REPOSITORY and GITHUB_RUN_ID (this run, which they skip).

/** The rebuild job's name when it deploys a program change or a forced run, and its build hook step. */
export const PROGRAM_DEPLOY_JOB = 'Program deploy';
export const HOOK_STEP = 'Start a Netlify production build';

/** Whether one run's jobs (from GitHub's jobs API) include a program deploy that reached Netlify. */
export function deployedIn(jobs) {
  return (jobs ?? []).some((j) => j.name === PROGRAM_DEPLOY_JOB && (j.steps ?? []).some((s) => s.name === HOOK_STEP && s.conclusion === 'success'));
}

/** Whether one run's jobs include any job whose build hook step succeeded. */
export function hookedIn(jobs) {
  return (jobs ?? []).some((j) => (j.steps ?? []).some((s) => s.name === HOOK_STEP && s.conclusion === 'success'));
}

/**
 * The start of the newest run since `since` that made a program deploy, or null if none did.
 * Throws with a reason, never with the token, when GitHub's API can't be read.
 * @param {{ since: Date, repo?: string, token?: string, runId?: string, fetch?: typeof fetch }} input
 */
export const lastProgramDeploy = (input) => newestRun({ ...input, match: deployedIn });

/** The start of the newest run since `since` that got past the build hook, or null if none did. Throws as above. */
export const lastBuildHook = (input) => newestRun({ ...input, match: hookedIn });

async function newestRun({ since, match, repo = process.env.GITHUB_REPOSITORY, token = process.env.GH_TOKEN, runId = process.env.GITHUB_RUN_ID, fetch = globalThis.fetch }) {
  if (!repo || !token) throw new Error('GH_TOKEN or GITHUB_REPOSITORY is not set');
  const api = async (path) => {
    let res;
    try {
      res = await fetch(`https://api.github.com/repos/${repo}/${path}`, { headers: { authorization: `Bearer ${token}`, accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' } });
    } catch {
      throw new Error("GitHub's API didn't answer");
    }
    if (!res.ok) throw new Error(`GitHub's API answered HTTP ${res.status}`);
    return res.json();
  };
  // A run can wait in the queue behind another, so ask for runs created up to an hour earlier too.
  const created = encodeURIComponent(`>=${new Date(since.getTime() - 3600_000).toISOString().slice(0, 19)}Z`);
  const runs = [];
  for (let page = 1; ; page += 1) {
    const got = (await api(`actions/workflows/rebuild.yml/runs?created=${created}&per_page=100&page=${page}`)).workflow_runs;
    if (!Array.isArray(got)) throw new Error("GitHub's API sent no list of runs");
    runs.push(...got);
    if (got.length < 100) break;
    if (page === 5) throw new Error('more than 500 runs to read');
  }
  const done = runs
    .filter((r) => String(r.id) !== String(runId) && r.status === 'completed' && !Number.isNaN(Date.parse(r.run_started_at)))
    .sort((a, b) => Date.parse(b.run_started_at) - Date.parse(a.run_started_at));
  for (const run of done) {
    const { jobs } = await api(`actions/runs/${run.id}/jobs?filter=all&per_page=100`);
    if (!Array.isArray(jobs)) throw new Error("GitHub's API sent no list of jobs");
    if (match(jobs)) return new Date(run.run_started_at);
  }
  return null;
}
