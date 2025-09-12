/*
  Waits for the most recent GitHub Actions workflow run on a branch (or a specific run)
  and prints the final status. Exits non-zero on failure.

  Env vars required:
    - GITHUB_TOKEN (repo + workflow scopes)
    - GITHUB_OWNER
    - GITHUB_REPO
  Optional:
    - BRANCH (defaults to master)
    - RUN_ID (if provided, polls this run directly)
    - INTERVAL_MS (default 10000)
*/

const axios = require('axios');

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const branch = process.env.BRANCH || 'master';
const runId = process.env.RUN_ID;
const interval = Number(process.env.INTERVAL_MS || 10000);

if (!token || !owner || !repo) {
  console.error('Missing env. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
  process.exit(2);
}

const api = axios.create({
  baseURL: `https://api.github.com`,
  headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
});

async function getLatestRunId(br) {
  const { data } = await api.get(`/repos/${owner}/${repo}/actions/runs`, {
    params: { branch: br, per_page: 1 }
  });
  if (!data.workflow_runs || data.workflow_runs.length === 0) {
    throw new Error(`No workflow runs found on branch ${br}`);
  }
  return data.workflow_runs[0].id;
}

async function getRun(id) {
  const { data } = await api.get(`/repos/${owner}/${repo}/actions/runs/${id}`);
  return data;
}

(async () => {
  try {
    const id = runId || await getLatestRunId(branch);
    console.log(`Polling workflow run ${id} on ${owner}/${repo}...`);

    // poll loop
    for (;;) {
      const run = await getRun(id);
      console.log(`Status: ${run.status}  Conclusion: ${run.conclusion || '-'}  Updated: ${run.updated_at}`);
      if (run.status !== 'in_progress' && run.status !== 'queued' && run.status !== 'requested' && run.status !== 'waiting') {
        if (run.conclusion === 'success') {
          console.log('Workflow succeeded');
          process.exit(0);
        } else {
          console.error(`Workflow finished with conclusion: ${run.conclusion}`);
          process.exit(1);
        }
      }
      await new Promise(r => setTimeout(r, interval));
    }
  } catch (e) {
    console.error('Error while checking workflow run:', e.message);
    process.exit(3);
  }
})();

