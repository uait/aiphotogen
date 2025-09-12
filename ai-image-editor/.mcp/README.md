GitHub MCP Setup

Overview
- This project includes a ready-to-use MCP server config for GitHub under `.mcp/servers.json`.
- With a supported MCP client (e.g., Claude Desktop or any IDE MCP client), you can:
  - List and switch branches
  - Create commits and PRs
  - Merge PRs to `master`
  - Inspect GitHub Actions runs and deployment status

Prerequisites
- Personal Access Token (PAT) with scopes: `repo`, `workflow`.
- Environment variables set in your MCP client runtime:
  - `GITHUB_TOKEN`: your PAT
  - `GITHUB_OWNER`: your GitHub org/user
  - `GITHUB_REPO`: this repository name (e.g., `aiphotogen`)

Client Configuration (example: Claude Desktop)
- Add to Claude Desktop `settings.json` (mcpServers section):
```
"mcpServers": {
  "github": {
    "command": "npx",
    "args": ["-y", "@modelcontextprotocol/server-github"],
    "env": {
      "GITHUB_TOKEN": "${GITHUB_TOKEN}",
      "GITHUB_REPO": "${GITHUB_OWNER}/${GITHUB_REPO}",
      "GITHUB_DEFAULT_BRANCH": "master"
    }
  }
}
```

Usage
- From your MCP client, connect to the `github` server.
- Tools typically available:
  - `list_repos`, `get_repo`, `list_branches`, `get_branch`
  - `create_branch`, `commit_files`, `create_pull_request`, `merge_pull_request`
  - `list_workflow_runs`, `get_workflow_run`

Security
- Keep your `GITHUB_TOKEN` private. Do not commit it to the repository.
- Limit scopes to required actions.

