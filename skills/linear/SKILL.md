---
name: linear
description: Manage Linear tickets via GraphQL — read issues, update descriptions, create and manage subtasks. Token-efficient by selecting only the fields you need.
origin: picha-pi
---

# Linear Project Management

Interact with Linear's GraphQL API for lightweight project management: reading tickets, updating descriptions, and managing subtasks.

## Authentication

Set `LINEAR_API_KEY` before running commands:

```bash
export LINEAR_API_KEY="lin_api_your_key_here"
```

All requests go to: `https://api.linear.app/graphql`

## Reading Issues

### Read a single issue

Query only the fields you need to avoid wasting tokens. Replace the selection set for your use case.

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{
    "query": "query { issue(id: \"ISSUE-123\") { id identifier title description state { name } subtasks { nodes { id identifier title description } } } }"
  }' | jq .
```

### Read all issues for a project

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d "{
    \"query\": \"query { issues(filter: { project: { id: { eq: \\\"PROJECT_ID\\\" } } }, first: 50) { nodes { id identifier title description state { name } assignee { name } subtasks { nodes { id identifier title } } } pageInfo { hasNextPage endCursor } } }\"
  }" | jq .
```

- Adjust `first` to paginate. If `hasNextPage` is true, pass `endCursor` as `after` in the next request.

### Read issues by team

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d "{
    \"query\": \"query { issues(filter: { team: { id: { eq: \\\"TEAM_ID\\\" } } }, first: 30) { nodes { id identifier title state { name } } } }\"
  }" | jq .
```

### Search issues

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d "{
    \"query\": \"query { issueSearch(search: \\\"search term\\\", first: 20) { nodes { id identifier title state { name } } } }\"
  }" | jq .
```

## Updating Issues

### Update issue description

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{
    "query": "mutation UpdateIssueDescription($id: String!, $description: String) { issueUpdate(id: $id, input: { description: $description }) { success issue { id identifier description } } }",
    "variables": {
      "id": "ISSUE-123",
      "description": "Updated markdown description here."
    }
  }' | jq .
```

### Update issue title, assignee, labels, or state

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{
    "query": "mutation UpdateIssue($id: String!, $input: IssueUpdateInput!) { issueUpdate(id: $id, input: $input) { success issue { id identifier title description state { name } } } }",
    "variables": {
      "id": "ISSUE-123",
      "input": {
        "title": "New title",
        "description": "New description",
        "stateId": "STATE_UUID",
        "assigneeId": "USER_UUID"
      }
    }
  }' | jq .
```

- Only include fields in `input` that you actually want to change.
- `stateId` — use the workflow state UUID. If unknown, query states first (see below).

## Managing Subtasks

### Create a subtask

Parent the subtask via `parentId`.

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{
    "query": "mutation CreateSubtask($input: IssueCreateInput!) { issueCreate(input: $input) { success issue { id identifier title } } }",
    "variables": {
      "input": {
        "title": "Subtask title",
        "description": "Subtask description (markdown).",
        "parentId": "PARENT_ISSUE_ID",
        "teamId": "TEAM_ID"
      }
    }
  }' | jq .
```

### Update a subtask description

Same mutation as updating any issue — use `issueUpdate`:

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{
    "query": "mutation($id: String!, $description: String) { issueUpdate(id: $id, input: { description: $description }) { success issue { id identifier description } } }",
    "variables": {
      "id": "SUBTASK_ID",
      "description": "Updated subtask markdown."
    }
  }' | jq .
```

### Update subtask state (complete / un-complete)

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{
    "query": "mutation($id: String!, $stateId: String!) { issueUpdate(id: $id, input: { stateId: $stateId }) { success issue { id identifier state { name } } } }",
    "variables": {
      "id": "SUBTASK_ID",
      "stateId": "DONE_STATE_UUID"
    }
  }' | jq .
```

## Helper Queries

### Get team ID and workflow states

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "query { teams { nodes { id name key states { nodes { id name type } } } } }"}' | jq .
```

- Cache the `id` and `states` result — these rarely change.
- `state.type` values: `triage`, `backlog`, `unstarted`, `started`, `completed`, `canceled`.

### List projects

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "query { projects(first: 50) { nodes { id name identifier lead { name } } } }"}' | jq .
```

### Get issue identifier from ID (and vice versa)

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query": "query { issue(id: \"UUID_OR_IDENTIFIER\") { id identifier title } }"}' | jq .
```

## Best Practices for Token Efficiency

- **Always select only the fields you need.** A full Linear issue object has 50+ fields. Most tasks need 5-8.
- **Use variables for mutations** (as shown above) — avoids escaping issues in the query string.
- **Cache team/state/project metadata.** Look up once per session, reuse IDs.
- **Use `jq` to filter responses** before the model reads them if the API returns more than you need.
- **Don't fetch description** in list queries unless you need it — it's the biggest field by far.

## Quick Reference

| Task | Approach |
|------|----------|
| Read tickets | `issues` query, select only needed fields |
| Update description | `issueUpdate` mutation with `description` |
| Create subtask | `issueCreate` with `parentId` set |
| Update subtask | `issueUpdate` on the subtask's `id` |
| Complete subtask | `issueUpdate` with `stateId` of "Done" state |
| Find IDs | Cache from `teams` and `projects` queries |
