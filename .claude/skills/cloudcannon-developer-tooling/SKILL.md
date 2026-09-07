# CloudCannon Developer Tooling — Agent Reference

**Scope:** the developer platform released 20 Aug 2026 — CLI, local dev server, REST API, TypeScript SDK, Visual Editor API, and CloudCannon's own agent skills.
**Compiled:** 5 Sep 2026 from CloudCannon docs and launch posts.
**Stability warning:** the REST API is `v0`. Endpoints and fields may change. The SDK is `v0.0.x`. Treat everything below as accurate-at-time-of-writing and verify with `--help` or the live OpenAPI spec before relying on a flag or field.

---

## 1. Which tool for which job

| Task | Reach for | Notes |
|---|---|---|
| Scaffold `cloudcannon.config.yml` for an existing repo | CLI `configure generate` | No auth needed |
| Check config before committing | CLI `validate` | No auth needed |
| Iterate on `_inputs` / `_structures` with instant feedback | CLI `dev` | No auth needed, no push, no build |
| Create/connect a site, trigger builds, read build logs | CLI `sites` / `builds` | Auth required |
| Structured data for scripts, dashboards, reports | TypeScript SDK | Typed, paginated, filterable |
| Non-JS language, or an endpoint the SDK lacks | REST API + OpenAPI spec | Signing is manual for Access Keys |
| Custom UI inside the Visual Editor | Visual Editor API | Browser-side JS, not the REST API |
| Read/write site content programmatically | CLI `sites files` or SDK editing sessions | Goes through the editing-session commit flow |

**Rule of thumb for an agent:** anything that touches only local files (`configure`, `validate`, `dev`) is safe to run unprompted. Anything under `sites`, `orgs`, `builds`, `inboxes` mutates a live account — confirm before running.

---

## 2. Install and prerequisites

```sh
npm install --global @cloudcannon/cli   # requires Node.js 24+
npm install @cloudcannon/sdk            # requires Node.js 20+, server-side only
```

The SDK signs requests with Node's `crypto`, so it will not run in a browser. Do not bundle it into client-side code.

---

## 3. Authentication

Three credential types. Getting these confused is the most common failure mode.

| Credential | Scope | Used by | Passed as |
|---|---|---|---|
| **Login token** | Your user | CLI, interactive | `cloudcannon login` (opens browser, stores token locally) |
| **Access Key** | Individual user, across all their orgs | CLI, CI; SDK via `userAccessKey` | `CC_ACCESS_KEY_ID` + `CC_ACCESS_KEY_SECRET` |
| **API Key** | One Organization | SDK, direct REST | `CLOUDCANNON_API_KEY` env var; `X-API-KEY` header for raw HTTP |

Docs list the CLI env vars as `CLOUDCANNON_API_KEY` and `CC_ACCESS_KEY_ID` / `CC_ACCESS_KEY_SECRET`. The launch blog's GitHub Actions example instead stores secrets named `CLOUDCANNON_ACCESS_KEY_ID` / `CLOUDCANNON_ACCESS_KEY_SECRET` and passes them explicitly as `cloudcannon login --access-key-id ... --access-key-secret ...`. **Both patterns appear in official material and they disagree.** Prefer the documented env vars; if they don't work, fall back to the explicit flags. Verify with `cloudcannon login --help`.

Access Key requests are cryptographically signed (HMAC-SHA256). The CLI and SDK handle this. For raw HTTP in another language, use an **API Key** instead — or port the `signRequest` implementation from `index.ts` in the SDK repo.

Failure modes: `401` = bad or missing credentials. `403` = valid key, insufficient permission. `429` = rate limited (limits are **per IP**, so several keys on one CI runner share a budget — back off and retry).

Never write keys into config files, commit them, or echo them into logs.

---

## 4. CLI command map

```
cloudcannon
├── login / logout
├── configure
│   ├── generate                  Write cloudcannon.config.yml (+ optional initial-site-settings.json)
│   ├── detect-ssg                Report the detected SSG
│   ├── detect-source             Report the detected source folder
│   ├── detect-collections        List detected collections
│   └── detect-build-commands     Suggest install/build commands
├── validate                      Check config against the CloudCannon schema
├── dev                           Run CloudCannon's editor locally against local files
├── sites
│   ├── list / get / create
│   ├── rebuild
│   ├── update-build-config
│   ├── builds
│   ├── files
│   │   ├── list / get / upload
│   │   ├── move / clone / delete / restore / discard
│   │   ├── list-edits
│   │   └── commit
│   ├── print-last-build
│   ├── print-last-failed-build
│   ├── print-last-sync
│   └── print-last-failed-sync
├── orgs                          Org-scoped equivalents, e.g. orgs sites list --org "<name>"
├── builds
└── inboxes                       Form submissions
```

### `configure generate` — the flags that matter to an agent

```
cloudcannon configure generate [OPTIONS] [PATH]     # PATH defaults to "."
```

| Flag | Why an agent cares |
|---|---|
| `--auto` | **Non-interactive.** Accepts all suggestions. Without this the command blocks on prompts and will hang an automated session. |
| `--dry-run` | Log the config instead of writing it. Use this first, show the user, then write. |
| `--ssg=<name>` | Override detection when the heuristic guesses wrong |
| `--source=<path>` | Override the source folder |
| `--format=<yaml\|json>` | Defaults to `yaml` |
| `--output=<path>` | Write somewhere other than the default |
| `--initial-site-settings` | Also emit `.cloudcannon/initial-site-settings.json` |
| `--initial-site-settings-only` | Emit only that file |
| `--install-command=` / `--build-command=` / `--output-path=` | Override detected build settings |
| `--mode=<hosted\|headless>` | Defaults to `hosted` |

**Critical limitation:** `configure generate` produces `collections_config`, `paths`, `markdown`, `timezone`, and build settings. It does **not** produce `_inputs` or `_structures`. The result is a working CMS, not a finished one. Configuring input types and component schemas is the next task, and it is where most of the real work lives.

### `validate`

```
cloudcannon validate [OPTIONS] [PATH]
```

Checks `cloudcannon.config.yml`, `.cloudcannon/initial-site-settings.json`, and routing/split config files against the CloudCannon schema.

| Flag | Effect |
|---|---|
| `--configuration` | Config file and split config files only |
| `--initial-site-settings` | `initial-site-settings.json` only |
| `--routing` | `.cloudcannon/routing.json` only |
| `--configuration-path=<path>` | Point at a specific config file |
| `--stdin` | Read from stdin instead of disk — useful for validating a candidate config before writing it |

Output shape:

```
✅ valid: cloudcannon.config.yml
❌ invalid: cloudcannon.config.yml
	$.collections_config.content_pages: unexpected property FoobarConfig
```

The error gives a JSONPath to the offending key. Parse that, don't guess.

**Always run `validate` after editing config and before committing.** An agent that writes YAML without validating it is one typo away from a broken client build.

### `sites` — live-account commands

```sh
cloudcannon sites list                                  # every site, all orgs
cloudcannon orgs sites list --org "<org-name-or-uuid>"  # scoped
cloudcannon sites get --site "<name|id|uuid|domain>"
cloudcannon sites create --org "<org>"                  # prompts for name, git remote, branch
cloudcannon sites update-build-config --site "<site>" \
  --install-command "pnpm i" --build-command "pnpm run build" \
  --output-path "dist" --no-building-locked
cloudcannon sites rebuild --site "<site>"
cloudcannon sites print-last-build --site "<site>"
cloudcannon sites print-last-failed-build --site "<site>"
```

New sites start **build-locked**. They will not build until you clear the lock — `--no-building-locked` on `update-build-config` does that and triggers a rebuild as a side effect.

`sites create` is interactive by default (site name, git remote URL, branch). There is no documented `--auto` for it; for fully non-interactive site creation, use the SDK's `org.connectSite()` instead.

---

## 5. Local dev server

```sh
cloudcannon dev [OPTIONS] <OUTPUTPATH>
```

`OUTPUTPATH` is **required** — the path to your built site output (`dist` for Astro, `public` for Hugo, `_site` for Eleventy). Runs CloudCannon's real editing interface on localhost against your local files, reflecting config changes on save. No commit, no push, no build.

| Option | Default | Effect |
|---|---|---|
| `--port=<port>` | `10101` | Port for the dev server |
| `--live-sync` / `--no-live-sync` | on | Push disk changes to the app via SSE; `--no-live-sync` disables the file watcher |
| `--app-sync` / `--no-app-sync` | on | Accept app-initiated writes (uploads, moves, deletes) to disk; `--no-app-sync` makes it read-only |
| `--verbose` | off | Log every request (method, path, status, duration) |

**Agent-relevant:** `--app-sync` is on by default, meaning the browser editor can write to your working tree. If an agent is concurrently editing files, run with `--no-app-sync` to avoid two writers fighting over the same files.

Requires **two processes side by side** — your SSG's dev server and CloudCannon's:

```sh
# Terminal 1
npm run dev
# Terminal 2
cloudcannon dev dist
```

The dev server is a development tool only. Editors never see it. When the config feels right, `validate`, commit, push.

---

## 6. Config schemas (IDE + programmatic validation)

Schemas are registered with SchemaStore, so most IDEs pick them up by filename. To be explicit:

```yaml
# yaml-language-server: $schema=https://raw.githubusercontent.com/CloudCannon/configuration-types/main/cloudcannon-config.schema.json
```

```json
{ "$schema": "https://raw.githubusercontent.com/CloudCannon/configuration-types/main/dist/cloudcannon-routing.schema.json" }
{ "$schema": "https://raw.githubusercontent.com/CloudCannon/configuration-types/main/dist/cloudcannon-initial-site-settings.schema.json" }
```

Types are published as `@cloudcannon/configuration-types`. An agent generating config can validate against these schemas locally before ever shelling out to the CLI. Legacy SSG-specific schemas (Jekyll, Hugo, Eleventy, Reader) exist for non-unified sites but are not in SchemaStore and must be referenced manually.

---

## 7. REST API

- **Base URL:** `https://app.cloudcannon.com/api/v0`
- **OpenAPI spec:** `https://app.cloudcannon.com/api/v0/openapi.json`

```sh
curl https://app.cloudcannon.com/api/v0/openapi.json -o openapi.json
```

Download the spec once at the start of a session rather than reading the reference page by page — it gives every endpoint, parameter, and response shape in a single file, and it's the authoritative source when the docs and the SDK disagree.

**Auth:** `X-API-KEY: <api-key>` header for API Keys. Access Key requests must be HMAC-signed.

**Pagination and sorting:** `page`, `items`, `sort_attribute`, `sort_direction` (`ASC` | `DESC`, defaults `DESC`). Valid `sort_attribute` values vary per endpoint.

```sh
curl "https://app.cloudcannon.com/api/v0/orgs/<org_uuid>/sites?page=2&items=50" \
  -H "X-API-KEY: <your-api-key>"
```

**Resource groups and endpoint counts** (a useful map of surface area):

Organizations (43), Sites (92), Builds (3), Site Archives (1), Syncs (1), Editing Sessions (10), Editing Session Files (12), Site Authentication (2), Site DAMs (3), Site Mountings (2), Outputs (1), Site Inboxes (3), Projects (8), Base Domains (14), Users (11), DAMs (3), Inboxes (8), Inbox Targets (4), Form Hooks (4), Groups (10), Scheduled Builds (2), SSL Certificates (2), Uploads (1).

CloudCannon says it emails you when an endpoint you use changes, and recommends the SDK over raw HTTP because the SDK tracks API changes.

---

## 8. TypeScript SDK

```ts
import CloudCannonClient from '@cloudcannon/sdk';

const client = new CloudCannonClient({ key: process.env.CLOUDCANNON_API_KEY });
// or
const client = new CloudCannonClient({
  userAccessKey: { id: '...', secret: '...' },
});
```

Options: `key`, `userAccessKey`, `apiOrigin` (defaults `app.cloudcannon.com`), `getCustomAuthHeaders`.

### Client shape

Sub-clients are reached by UUID off the root client.

**Root**
- `client.orgs(options?)` — paginated org list
- `client.getUploadData()` — temporary S3 upload credentials
- `client.org(uuid)`, `client.site(uuid)`, `client.inbox(uuid)`, `client.siteInbox(uuid)`, `client.editingSession(uuid)`, `client.editingSessionFile(uuid)`, `client.build(uuid)`, `client.backup(uuid)`, `client.sync(uuid)`

**Org** (`client.org(uuid)`)
`get()`, `sites(options?)`, `createSite(name)`, `connectSite(name, { provider, repository, branch, folder? })`, `getInboxes()`, `createInbox(body)`, `getDams()`, `createDam(body)`, `getRepositories(provider)`

**Site** (`client.site(uuid)`)
`get()`, `update(body)`, `delete()`, `copy(body)`, `updateBuildConfig(options)`, `getBuilds(options?)`, `rebuild()`, `listBackups()`, `createBackup()`, `listFiles()`, `getFile(path)`, `uploadFile(path, content, opts?)`, `getSyncs(options?)`, `getScan()`, `getScreenshotHashes()`, `getScreenshot(device, path)`, `connectSourceProvider()`, `updateSourceProvider()`, `disconnectSourceProvider()`, `connectOutputProvider()`, `disconnectOutputProvider()`, `getInboxConnections()`, `connectInbox(body)`, `getDamConnections()`, `connectDam(body)`, `getEditingSessions()`, `createEditingSession()`, `getLatestEditingSession()`, `triggerPull()`

**Editing session** — `get()`, `getFiles()`, `createFile(body)`, `commit()`
**Editing session file** — `get()`, `getContributions()`, `createContribution(body)`, `unlock(body)`
**Inbox** — `getSubmissions(options?)`
**Build / Backup / Sync** — `build.get()`, `backup.download()`, `sync.get()` (these return a raw `Response`, not parsed JSON)

### Filtering

List methods take `{ page, items, sort_attribute, sort_direction, filters }`. The `filters` object is rich — for `org.sites()` it includes `search`, `site_name`, `ssg`, `storage_provider`, `building_locked`, `sync_error`, `compile_error`, `project_uuid`, plus date-range operators (`created_at_gt`, `updated_at_lte`, `last_synced`, `last_compiled`, etc.). This is how you build a portfolio health report without pulling every site.

Paginated responses return `{ items, current_page, total_items, total_pages }`.

### Errors

```ts
import { ApiError } from '@cloudcannon/sdk';

try {
  await site.update({ site_name: '' });
} catch (err) {
  if (err instanceof ApiError) {
    console.error(err.status);  // 422
    console.error(err.errors);  // validation detail
    console.error(err.url);
  }
}
```

Permission and not-found failures throw plain `Error`. Validation failures (422) throw `ApiError`.

### Escape hatch

```ts
const resp = await client.fetch('/orgs/my-org/sites', {
  method: 'POST',
  body: { site_name: 'My New Site' },
});
```

`client.fetch` is typed against the OpenAPI schema, injects auth headers, sets `Content-Type`, and returns a response typed by status code. Use it for endpoints the sub-clients don't cover yet.

---

## 9. Visual Editor API

Browser-side JavaScript that runs **inside** the Visual Editor. Unrelated to the REST API. This is the channel that has powered CloudCannon's visual editing for years, now openly documented as v1.

```js
const api = window.CloudCannonAPI.useVersion('v1', true);
```

The second argument is `preventGlobalInstall`. **Pass `true`.** It keeps the v1 object off the global `window.CloudCannon`, preventing clashes with other integrations that request a different version — **Bookshop is explicitly named as one of them.** If you build a Bookshop component library, this matters.

`window.CloudCannonAPI` exists whenever a file is open in the Visual Editor. If your script may run earlier, listen for `cloudcannon:load` on `document` first.

**Events:** `change` (file created or updated; `event.detail.isNew` distinguishes) and `delete`. Listener scope depends on what you attach to — the API object covers the whole site, a `Collection` or `Dataset` covers its files, a `File` covers one. Every event carries `event.detail.sourcePath`.

```js
api.collection('posts').addEventListener('change', (event) => {
  console.log('A post changed:', event.detail.sourcePath);
});
```

**Objects:** API Object, `Collection`, `Dataset`, `File`, `FileContent`, `FileData`, `FileMetadata`, `TextEditableRegion`. Editable regions are built on top of this API — when you hit their limits, this is the next layer down.

---

## 10. CloudCannon's own agent skills

Repo: `https://github.com/CloudCannon/agent-skills`

```sh
npx skills add CloudCannon/agent-skills
```

Or as a Claude Code plugin:

```
/plugin marketplace add CloudCannon/agent-skills
/plugin install agent-skills@cloudcannon
```

Skills then resolve as `agent-skills:<skill-name>`.

| Skill | Use when |
|---|---|
| `migrating-to-cloudcannon` | End-to-end migration; orchestrates the others |
| `cloudcannon-configuration` | `cloudcannon.config.yml`, collections, inputs, structures, CLI setup |
| `cloudcannon-snippets` | MDX components / inline HTML for the Content Editor |
| `cloudcannon-visual-editing` | Editable regions for inline editing |
| `brainstorming` | Requirements and tradeoffs before implementation |

Migration runs five phases with a verification checklist each: audit → configuration → content restructuring → visual editing → build and test. Docs are read just-in-time per phase rather than front-loaded, and deterministic steps are scripted to save tokens.

**Astro is currently the only supported SSG.** More are planned, each with SSG-specific subdirectories inside the relevant skills.

If the skills aren't found automatically, the suggested prompt pattern is: *"Migrate this site to CloudCannon using the migrating-to-cloudcannon skill. If the skill is not found, look in `.agents/`, otherwise do not continue."*

---

## 11. Recipes

### Onboard an existing repo, non-interactively

```sh
cloudcannon configure generate --auto --dry-run     # inspect first
cloudcannon configure generate --auto --initial-site-settings
cloudcannon validate
# then hand-write _inputs and _structures — generate does not produce them
```

### Iterate the editing experience

```sh
npm run dev &                # SSG dev server
cloudcannon dev dist         # CloudCannon editor on localhost:10101
# edit cloudcannon.config.yml, save, refresh — no commit, no build
cloudcannon validate
git add cloudcannon.config.yml && git commit -m "Add inputs and structures" && git push
```

### Full local loop

```sh
cloudcannon configure generate   # scaffold
cloudcannon dev dist             # shape the editing experience
cloudcannon validate             # check
cloudcannon sites rebuild        # ship
```

### CI build gate (GitHub Actions)

```yaml
- name: Check CloudCannon build status
  env:
    CLOUDCANNON_ACCESS_KEY_ID: ${{ secrets.CLOUDCANNON_ACCESS_KEY_ID }}
    CLOUDCANNON_ACCESS_KEY_SECRET: ${{ secrets.CLOUDCANNON_ACCESS_KEY_SECRET }}
  run: |
    FAILED=$(cloudcannon sites print-last-failed-build --site ${{ vars.CLOUDCANNON_SITE }} 2>/dev/null)
    if [ -n "$FAILED" ]; then
      echo "Last CloudCannon build failed. Blocking merge."
      exit 1
    fi
```

### Portfolio health sweep (SDK, structured)

```ts
const { items: orgs } = await client.orgs();
for (const org of orgs) {
  const { items: sites } = await client.org(org.uuid).sites({
    items: 100,
    sort_attribute: 'last_compiled',
    sort_direction: 'ASC',
    filters: { compile_error: 'none' },
  });
  // flag sites whose last_compiled is stale, or whose last build failed
}
```

Schedule as a cron or a morning CI run. Route failures into Slack.

### Write content programmatically

Two paths, both going through the editing-session commit flow:

```sh
cloudcannon sites files upload --site "<site>" ...
cloudcannon sites files list-edits --site "<site>"
cloudcannon sites files commit --site "<site>"
```

```ts
await site.uploadFile('content/posts/hello.md', '# Hello World', {
  type: 'text/markdown',
  overwriteExistingFile: true,
});
```

Content is staged in an editing session, then committed to the connected repository. `list-edits` before `commit` lets an agent show a diff for approval.

---

## 12. Gotchas

1. **`cloudcannon dev` needs the output path as a positional argument.** `cloudcannon dev` alone will fail. It's `cloudcannon dev dist`.
2. **`configure generate` is interactive unless you pass `--auto`.** An agent that omits it will hang waiting on prompts.
3. **`configure generate` never writes `_inputs` or `_structures`.** Treat its output as a starting point, not a finished config.
4. **New sites are build-locked.** Nothing builds until `--no-building-locked`.
5. **No documented `--json` output flag on CLI commands.** Do not write scripts that parse CLI stdout as structured data — use the SDK or REST API when you need machine-readable results. The blog claims `sites list` supports sorting and filtering, but the reference page for `sites list` documents no options; check `--help` on your installed version.
6. **The blog's `await cloudcannon.files.upload(file)` one-liner is illustrative, not real.** The actual SDK method is `site.uploadFile(path, content, options?)`.
7. **Env var names disagree between docs and blog** (§3). Verify before wiring CI.
8. **Rate limits are per IP, not per key.** Multiple keys on one CI runner share a budget.
9. **`build.get()`, `sync.get()`, `site.getFile()`, `backup.download()`, and `site.getScreenshot()` return a raw `Response`.** You have to `.json()` / `.text()` / consume the stream yourself. Most other SDK methods return parsed objects. Easy to get wrong.
10. **Pass `preventGlobalInstall: true` to `useVersion`** if Bookshop or any other integration is present on the page.
11. **The API is `v0`.** Pin your SDK version, and re-download `openapi.json` rather than trusting a cached field list.
12. **`--app-sync` defaults to on**, so the local editor can write to your working tree. Disable it if an agent is editing files at the same time.

---

## 13. Sources

- CLI reference — https://cloudcannon.com/documentation/developer-reference/cli/
- `configure generate` — https://cloudcannon.com/documentation/developer-reference/cli/configure/generate/
- `dev` — https://cloudcannon.com/documentation/developer-reference/cli/dev/
- `validate` — https://cloudcannon.com/documentation/developer-reference/cli/validate/
- `sites` / `sites files` — https://cloudcannon.com/documentation/developer-reference/cli/sites/
- REST API overview — https://cloudcannon.com/documentation/developer-reference/api/
- OpenAPI spec — https://app.cloudcannon.com/api/v0/openapi.json
- TypeScript SDK — https://cloudcannon.com/documentation/developer-reference/sdk/ and https://github.com/CloudCannon/sdk
- Visual Editor API — https://cloudcannon.com/documentation/developer-reference/visual-editor-api/
- JSON Schemas — https://cloudcannon.com/documentation/developer-reference/schemas/
- Agent skills — https://github.com/CloudCannon/agent-skills
- Launch post — https://cloudcannon.com/blog/preview-automate-and-extend-cloudcannon/
- CLI walkthrough — https://cloudcannon.com/blog/manage-your-sites-from-the-terminal-with-cloudcannons-cli/
- Dev server walkthrough — https://cloudcannon.com/blog/build-your-editing-experience-locally-with-the-cloudcannon-dev-server/