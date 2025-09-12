/*
  Merges a branch (or PR) into master via GitHub API.

  Env vars required:
    - GITHUB_TOKEN (repo + workflow scopes)
    - GITHUB_OWNER
    - GITHUB_REPO
  One of:
    - PR_NUMBER
    - SOURCE_BRANCH (will create PR if missing)
*/

const axios = require('axios');

const token = process.env.GITHUB_TOKEN;
const owner = process.env.GITHUB_OWNER;
const repo = process.env.GITHUB_REPO;
const prNumber = process.env.PR_NUMBER ? Number(process.env.PR_NUMBER) : undefined;
const sourceBranch = process.env.SOURCE_BRANCH;

if (!token || !owner || !repo) {
  console.error('Missing env. Set GITHUB_TOKEN, GITHUB_OWNER, GITHUB_REPO');
  process.exit(2);
}

const api = axios.create({
  baseURL: `https://api.github.com`,
  headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' }
});

async function findOpenPr(head, base) {
  const { data } = await api.get(`/repos/${owner}/${repo}/pulls`, { params: { state: 'open', head: `${owner}:${head}`, base } });
  return data[0];
}

async function createPr(head, base) {
  const title = `Merge ${head} into ${base}`;
  const { data } = await api.post(`/repos/${owner}/${repo}/pulls`, { title, head, base, body: 'Automated PR via script.' });
  return data;
}

async function mergePr(number) {
  const { data } = await api.put(`/repos/${owner}/${repo}/pulls/${number}/merge`, { merge_method: 'squash' });
  return data;
}

(async () => {
  try {
    let pr = null;
    if (prNumber) {
      const { data } = await api.get(`/repos/${owner}/${repo}/pulls/${prNumber}`);
      pr = data;
    } else if (sourceBranch) {
      pr = await findOpenPr(sourceBranch, 'master');
      if (!pr) {
        pr = await createPr(sourceBranch, 'master');
        console.log(`Created PR #${pr.number}`);
      } else {
        console.log(`Found existing PR #${pr.number}`);
      }
    } else {
      console.error('Provide PR_NUMBER or SOURCE_BRANCH');
      process.exit(2);
    }

    const result = await mergePr(pr.number);
    console.log(`Merged PR #${pr.number}: ${result.sha}`);
  } catch (e) {
    console.error('Merge failed:', e.response?.data || e.message);
    process.exit(1);
  }
})();

