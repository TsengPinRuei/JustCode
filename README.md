# JustCode

[English](README.md) | [繁體中文](READMEzhTW.md)

JustCode is a coding practice app that runs on your own computer. Choose a problem, write a Java or Python3 solution in your browser, and check it against local testcases. A **testcase** is an input together with the answer your code should return.

The React frontend is the page you use; the Express backend reads problem files and runs your code. Problems and progress live in `problems/`. Normal local use needs no account, database, API key, or cloud service.

![JustCode](https://img.shields.io/badge/JustCode-v1.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

Start with [Quick Start](#quick-start), then follow [Your First Solution](#your-first-solution). The interface currently uses English labels; both guides use the exact button names.

- [Features](#features)
- [Quick Start](#quick-start)
- [Built-in Problems](#built-in-problems)
- [Practice Guide](#practice-guide)
- [Importing Problems and Hidden Tests](#importing-problems-and-hidden-tests)
- [Local Files, Backup, and Custom Problems](#local-files-backup-and-custom-problems)
- [Configuration and Execution Limits](#configuration-and-execution-limits)
- [Commands and Verification](#commands-and-verification)
- [Previewing a Build](#previewing-a-build)
- [Implementation and Portfolio Notes](#implementation-and-portfolio-notes)
- [Limitations](#limitations)
- [Project Structure](#project-structure)
- [API Overview](#api-overview)
- [Troubleshooting](#troubleshooting)
- [License Metadata](#license-metadata)

## Features

- Browse problems with difficulty, tags, and attempted/solved indicators.
- Write Java or Python3 in the Monaco editor, switch languages without losing the other draft, restore a template, and adjust the font size.
- Run visible tests, try custom JSON input, or submit against visible and hidden tests.
- See accepted answers, wrong answers, syntax/compilation errors, runtime errors, timeouts, editor error markers, and details for visible tests.
- Automatically save code and accepted-submission timing records per problem, with save-error messages and a retry action.
- Import public LeetCode statements, examples, constraints, Java/Python3 templates, and example testcases.
- Download a Markdown problem brief; add hidden tests from pasted JSON, a browser-selected file, or a project-relative file path.
- Read Markdown editorials with tables, language tabs for adjacent code blocks, and copy buttons. Resize the problem, editor, and console panes.
- Compare your accepted submissions in a local statistics panel. Delete non-built-in problems after confirmation.
- Execute in separate temporary workspaces with time and output limits, using local runtimes or optional Docker containers.

## Quick Start

### What to install

| Tool | When you need it |
| --- | --- |
| Node.js and npm | Always, to run the app. This guide was verified with Node.js 22. The locked Vite dependency accepts Node.js `18.x`, `20.x`, or `>=22`; `install.sh` only checks the lower bound of 18. |
| JDK 11 or newer | To run Java locally. A JDK includes both `javac` (compiler) and `java` (runtime). |
| Python 3.9 or newer | To run Python3 locally. The executable must be named `python3`; the sorting template uses `list[int]` annotations. |
| Docker | Optional alternative to installing Java/Python locally. Start Docker and download the images in [Configuration](#configuration-and-execution-limits) before using it. |
| Git | Only if you download the project with `git clone`; downloading and extracting the repository ZIP also works. |

For a first try, Node.js/npm plus **one** local language runtime is enough. Full executor tests need both Java and Python. The commands are intended for macOS, Linux, and Windows; the shell helper scripts require macOS/Linux. Verification for this documentation was performed on macOS, not on every platform.

Open Terminal on macOS/Linux or PowerShell on Windows. Check Node.js and whichever language you installed:

```bash
node --version
npm --version
```

For Java, check both commands:

```bash
javac --version
java --version
```

For Python:

```bash
python3 --version
```

### Download, install, and start

If you do not have the project yet:

```bash
git clone https://github.com/TsengPinRuei/JustCode.git
cd JustCode
```

If you already downloaded it, open a terminal in the **project root**: the folder containing `package.json`, `frontend/`, `backend/`, and `problems/`. Run commands there unless stated otherwise.

```bash
npm install
npm run dev
```

`npm install` installs both frontend and backend dependencies through npm workspaces. It is normally needed only for the first setup or after dependency changes. On macOS/Linux, `./install.sh` is an alternative to `npm install`; it checks Node.js/npm and installs dependencies, but does not install Java, Python, or Docker. Run it as your normal user, without `sudo`.

Leave the terminal running and open [http://localhost:5173](http://localhost:5173) in your browser. The API runs at [http://localhost:3000](http://localhost:3000); [its health endpoint](http://localhost:3000/health) should return JSON with `"status":"ok"`. Port 3000 is the backend, not the app page. If Vite selects another available port, use the URL printed in the terminal.

Internet access is needed to install dependencies and import from LeetCode. Once installed, the bundled problems and editor work locally; Monaco and its worker are bundled, and the optional Google font has a system-font fallback.

To stop, allow pending saves to finish, then press `Ctrl+C` in the server terminal. Next time, run `npm run dev` again from the project root.

### Your First Solution

1. Open **-27. Add Two Integers** in the problem list.
2. Choose **Java** or **Python3** above the editor.
3. Replace the editor contents with the corresponding complete example below. The starter templates are intentionally unfinished.

Java:

```java
class Solution {
    public int sum(int num1, int num2) {
        return num1 + num2;
    }
}
```

Python3:

```python
class Solution:
    def sum(self, num1: int, num2: int) -> int:
        return num1 + num2
```

4. In **Testcase**, select **Case 1**, then click **Run**. The result should be **Accepted**, with **2 / 2** visible tests passed.
5. Click **Submit**. With the bundled, unchanged tests, the result should be **Accepted**, with **52 / 52** tests passed.
6. Expand **Stats** to see the new accepted record. Return to the problem list using **Problems**; the problem should have a solved check mark.

Keep the `Solution` class, method name, parameters, and return type from the template. **Return** the answer with `return`; printing it with `print` or `System.out.println` is only debug output. You do not need to write a `main` function or read standard input: JustCode generates the calling code.

## Built-in Problems

These are the files shipped in this checkout; counts change if you edit or import more tests.

| Problem | Difficulty | Languages | Visible / hidden tests | Included editorial |
| --- | --- | --- | --- | --- |
| [-27. Add Two Integers](problems/add-two-integers/problem.json) | Easy | Java, Python3 | 2 / 50 | [Addition and a bitwise alternative](problems/add-two-integers/editorial.md) |
| [-09. Sort an Array](problems/sort-array/problem.json) | Medium | Java, Python3 | 3 / 70 | [Quick, merge, heap, counting, and radix sort](problems/sort-array/editorial.md) |

Both problems include templates and visible/hidden test files. They are protected from UI/API deletion. Start with addition to check your installation, then use sorting to practice algorithms and compare approaches. The sorting statement asks you to implement sorting yourself; the judge checks outputs and execution limits, not whether you used a built-in sorting function or achieved a particular complexity.

## Practice Guide

### Run, custom input, and Submit

| Action | What executes | What success means |
| --- | --- | --- |
| **Run** while a **Case** tab is selected | All visible testcases, not just the displayed case | Your return values matched those visible answers. It does not mark the problem solved. |
| **Testcase → Custom Input → Run** | One input you enter | The program ran and returned a value. There is no expected answer to compare, even when the summary says **Accepted**. |
| **Submit** | All visible tests plus the current local hidden tests | Passing creates a solved status and an accepted record. It ignores the Custom Input box. |

For Add Two Integers, enter this in **Custom Input**:

```json
{"num1": 12, "num2": 5}
```

For Sort an Array:

```json
{"nums": [5, 2, 3, 1]}
```

Use valid JSON: double-quoted keys/strings, no comments, and no trailing commas. Enter only the input object, not an `input`/`output` wrapper. The keys must exactly match the problem's parameter names. Opening **Custom Input** initially copies the first visible input as a starting point.

### Reading results

| Status | Meaning | What to check |
| --- | --- | --- |
| **AC — Accepted** | All compared tests passed, or custom input executed successfully | Use Submit to record a solve. An imported problem may still have no hidden tests. |
| **WA — Wrong Answer** | A returned value differs from its expected answer | Compare Input, Expected, and Actual; check edge cases and array order. |
| **CE — Compilation Error** | Java compilation or Python syntax checking failed | Read the message and editor markers; check indentation, names, types, and syntax. |
| **RE — Runtime Error** | Execution failed, or a runtime/sandbox could not start correctly | Read the error; check exceptions, supported types, and installed runtimes. |
| **TLE — Time Limit Exceeded** | Compilation, a testcase, or the whole request ran out of time | Check loops and algorithm cost; see the execution limits below. |

**Result** shows visible testcase values and timing. For hidden tests, Submit reports totals and at most the first failing hidden result's index, status, and timing; it omits hidden inputs, answers, exception text, and debug output. The **Console Output** area shows debug output only for failing visible cases. Successful runs do not display it.

### Editor, progress, and statistics

- The language selector preserves a separate code draft for Java and Python3. **Reset** immediately replaces and saves the current language's code with its template; it keeps the other language and existing solve records. Copy anything you want to keep before resetting.
- **A− / A+** change the font size from 12 to 24. Drag the dividers to resize the problem/editor area or editor/console area. **Description** shows the statement; **Editorial** shows the explanation and copyable code.
- Code edits are saved after about one second without further edits. Language changes and accepted records request an immediate save; page navigation also attempts to flush pending changes. If **Changes have not been saved** appears, keep the tab open, copy your code, restore the backend connection, and use **Retry save**. Failed drafts are held in browser memory, not a durable offline store.
- An untouched problem has no status icon; editing marks it attempted (**◐**); an accepted Submit marks it solved (**✓**). Later edits or failed submissions do not clear a solved status.
- **Stats → Current** measures wall-clock time since opening the problem or the latest accepted submission, including idle time. Refreshing/reopening starts a new attempt timer. **Best Total** is the shortest saved time to an accepted submission.
- **Latest Submit** is the latest accepted submission's browser request duration, including compilation, process startup, tests, and request overhead. **Latest Rank** orders this problem's local accepted records by that duration, then total attempt time and timestamp. It is not a global leaderboard or a controlled algorithm benchmark.
- Records contain timing, language, timestamp, and passed/total counts. Only the latest draft per language is stored; there is no complete source-code history for every submission.

## Importing Problems and Hidden Tests

### Import from LeetCode

1. On **Problems**, click **Import from LeetCode**.
2. Paste a URL such as `https://leetcode.com/problems/two-sum/` and click **Import**.
3. After success, open the new problem in the list. Its files are under `problems/two-sum/`.

The importer reads public problem data through LeetCode's GraphQL endpoint and parses its statement/examples. It saves Java/Python3 snippets and public example tests. It does **not** fetch LeetCode's private judge tests or editorials; it creates an empty `testcases_hidden.json`. Until you add tests, an accepted Submit only validates the imported examples. Add `editorial.md` yourself if desired; otherwise the Editorial tab says `Editorial coming soon...`.

Importing an existing ID returns HTTP 409 without overwriting its templates, progress, or hidden tests. Design-class problems are rejected; problems requiring custom structures such as `ListNode` or `TreeNode` may import but cannot use those structures with the current runners. Changes to LeetCode's response format or unavailable public data can also prevent import.

To remove a non-built-in problem, click its trash icon in the list and confirm. This deletes the **entire problem folder**, including saved code and history; back it up first if needed.

### Add hidden tests

1. Open a problem and click **Download Description** to save `<problem-id>-description.md`. The brief contains the statement, examples, constraints, function metadata, and a sample hidden-test JSON format. It does not generate tests for you.
2. Prepare and check the expected answers for your additional cases.
3. Click **Add Hidden Tests**, then choose **Append** to keep existing tests and add more, or **Replace** to overwrite the hidden-test collection.
4. Choose **Paste JSON** and paste the content or use **Choose File** to select a local JSON/text file; alternatively choose **Project Path** and enter a path inside the repository, such as `tmp/generated-hidden-tests.json`.
5. Click **Import Hidden Tests**, check the reported counts, close the dialog with **×**, and use **Submit** to exercise the updated tests.

For **Sort an Array**, a valid hidden-test file is:

```json
[
  {"input": {"nums": [3, 1, 2]}, "output": [1, 2, 3]},
  {"input": {"nums": [0, -1, 0]}, "output": [-1, 0, 0]}
]
```

Use a **non-empty array**, with `input` and `output` in each item. Input keys must exactly match `problem.json`'s `params`; values and expected outputs must suit that problem. Structural validation does not prove the expected answer is correct. Replace changes only hidden tests and does not clear existing solved status or records; submit again to check an older solution against the new tests.

Browser-selected files are sent in a JSON request limited to **10 MiB**, including the request wrapper/escaping. **Project Path** reads an existing regular file of at most **64 MiB** inside the project. It is relative to the project root, not your Downloads folder; create the example `tmp/` folder and file yourself if using that path. Absolute paths, directories, missing files, and paths escaping the project are rejected.

## Local Files, Backup, and Custom Problems

### What each file contains

```text
problems/<problem-id>/
├── problem.json
├── template.java
├── template.py
├── testcases_visible.json
├── testcases_hidden.json
├── editorial.md
└── progress.json
```

| File | Purpose and requirements |
| --- | --- |
| `problem.json` | Required metadata: identity, statement, examples, constraints, languages, and function information. Its `id` must equal the folder name. |
| `template.java` / `template.py` | Starter code for `java` / `python3`. Provide one per supported language for a usable starting point. A missing template opens an empty editor; templates are not completed solutions. |
| `testcases_visible.json` | Required, non-empty JSON array of `{ "input": {...}, "output": ... }`. Used by Run and Submit. |
| `testcases_hidden.json` | Optional; the same shape, and may be `[]`. Used only by Submit. Import creates an empty file. |
| `editorial.md` | Optional Markdown explanation. Adjacent fenced code blocks with different language labels can display as language tabs. |
| `progress.json` | App-managed status, code by language, selected language, accepted `solveRecords`, and `lastUpdated`. Created/updated when saving progress; do not use it as a template or testcase file. |

Display examples in `problem.json` are separate from executable tests. Changing an example paragraph does not change what the judge runs; edit the testcase files too.

### Backup, restore, or start over

1. Wait for saves to finish, close the app tabs, and stop the servers with `Ctrl+C`.
2. Copy the entire **`problems/` folder** to a separate backup location using Finder/File Explorer. This preserves imported problems, templates, editorials, visible/hidden tests, code, and records. `node_modules/`, `dist/`, and `temp/` are not your progress.
3. To restore, keep the app stopped, preserve any newer data separately, then copy the desired problem folders back into `problems/`. Restart with `npm run dev`.
4. To restart one problem from scratch, first back it up, then remove **only that problem's `progress.json`** while the app is stopped. Reopening it uses its templates with no saved status or records. This differs from the editor's Reset button.

`npm run clean` and `./uninstall.sh` remove dependencies/builds/temporary files but preserve `problems/` and `package-lock.json`. They do not erase practice history.

The current `.gitignore` ignores additional problem folders but allows the two built-in folders. **The built-in `progress.json` files are tracked by Git**, so practice can change tracked files; a checkout can contain the progress saved by its author. Imported problems are not automatically included in Git backups. Before publishing this project or making a commit, inspect `git status` and intentionally choose which problem data and personal code to include.

### Add your own problem without LeetCode

A first exercise can reuse the addition problem:

1. Stop the app and copy `problems/add-two-integers/` to `problems/my-addition/`.
2. In the copy's `problem.json`, change `id` to `my-addition` and `title` to your own title. Remove the copied `progress.json` so it starts fresh.
3. Keep the `sum` function and its testcases for this first exercise. Update the description/editorial if you change the task.
4. Restart the app and refresh the list. Open your new problem, fill in its template, then Run and Submit.

When designing a different function, update these fields together:

| Metadata | Must agree with |
| --- | --- |
| `id` | Folder name: 1–200 lowercase letters, digits, `_`, or `-`; first character must be a letter or digit. |
| `difficulty`, `tags`, `description`, `examples`, `constraints` | Difficulty is `Easy`, `Medium`, or `Hard`; use string arrays for tags/constraints and strings for example input/output. |
| `supportedLanguages`, `functionSignatures` | Languages are `java` and/or `python3`, with a displayed signature for each listed language. |
| `functionName`, `params`, `returnType` | The actual method in `Solution`; parameter names/order/types and returned value must match the runners and tests. Include these fields for new problems. |

Use the linked built-in `problem.json` files as complete examples. Test input keys must match `params` exactly. JSON/Markdown files can be edited in a text editor; refresh the browser after external changes. New folders use the same Git ignore rules as imported problems, and non-built-in folders can be deleted through the UI.

## Configuration and Execution Limits

No `.env` file is needed or automatically loaded. Set environment variables in the terminal **before starting the backend**, and restart it after changing them.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Backend port. If changed, update `/api`'s target in `frontend/vite.config.ts` too. |
| `JUSTCODE_SANDBOX_MODE` | `auto` | Execution mode: `auto`, `docker`, or `local`. |
| `JUSTCODE_JAVA_SANDBOX_IMAGE` | `eclipse-temurin:17-jdk` | Java execution image. |
| `JUSTCODE_PYTHON_SANDBOX_IMAGE` | `python:3.11-slim` | Python execution image. |
| `JUSTCODE_DOCKER_MEMORY` | `256m` | Memory limit per execution container. |
| `JUSTCODE_DOCKER_CPUS` | `1` | CPU limit per execution container. |
| `JUSTCODE_DOCKER_PIDS_LIMIT` | `64` | Process limit per execution container. |

| Mode | Behavior |
| --- | --- |
| `auto` | Uses Docker when the daemon and required local image are available; otherwise falls back to local execution. It does not download images automatically. |
| `docker` | Requires Docker and the configured image; fails if unavailable instead of falling back. Use this mode for code you do not fully trust. |
| `local` | Uses local `javac`, `java`, and `python3`, without a shell and with a reduced environment. It is not an isolation/security boundary: code still runs with your user's file access. |

Docker mode disables container networking and applies a read-only root filesystem, capability removal, and resource limits. Only the execution workspace is mounted; it is writable when compilation needs it. These controls are for a local practice tool, not a claim of production-grade isolation.

Start Docker Desktop or the Docker daemon, then fetch the images for the languages you will use:

```bash
docker pull eclipse-temurin:17-jdk
docker pull python:3.11-slim
```

Start in Docker mode on macOS/Linux:

```bash
JUSTCODE_SANDBOX_MODE=docker npm run dev
```

Windows PowerShell:

```powershell
$env:JUSTCODE_SANDBOX_MODE = "docker"
npm run dev
```

Replace `docker` with `local` or `auto` to choose another mode. The PowerShell value remains set in that terminal until changed or the terminal is closed. Docker is only for submitted code; Node.js is still needed to run the app.

| Limit | Current value |
| --- | --- |
| Java compilation / Python syntax check | 10 seconds |
| Each testcase | 1 second |
| Entire Run/Submit execution | 60 seconds, including preparation/compilation |
| Frontend wait for Run/Submit | 75 seconds |
| Combined stdout/stderr per process | 10 MiB; retained debug output also has a 10 MiB submission budget |
| Concurrent Run/Submit requests | 2; additional requests receive HTTP 429 instead of being queued |
| JSON request body / local data file | 10 MiB / 64 MiB |

Timing/output limits live in [constants.ts](backend/src/constants.ts), concurrency in [problemRoutes.ts](backend/src/routes/problemRoutes.ts), request limits in [app.ts](backend/src/app.ts), file limits in [storage.ts](backend/src/services/storage.ts), and frontend timeouts in [apiClient.ts](frontend/src/services/apiClient.ts). These limits have no environment-variable overrides.

## Commands and Verification

Run from the project root. A **workspace** here means one of the frontend/backend packages managed together by npm.

| Command | Purpose |
| --- | --- |
| `npm install` | Install workspace dependencies. |
| `npm run dev` | Start both development servers. |
| `npm run dev:backend` / `npm run dev:frontend` | Start one development server. |
| `npm test` | Run the existing regression suite. Install both local Java and Python to exercise all language cases. |
| `npm run typecheck` | Check backend, frontend, and Vite configuration types without producing build files. |
| `npm run build` | Build both packages into `frontend/dist/` and `backend/dist/`. |
| `npm run build:frontend` / `npm run build:backend` | Build one package. |
| `npm run start:backend` | Start the built backend; build it first. |
| `npm run preview --workspace=frontend` | Preview the built frontend; build it first and keep the backend running. |
| `npm run clean` | Remove dependencies, builds, and execution temporary files. |
| `npm run clean:modules` | Remove workspace `node_modules/` folders. |
| `npm run clean:build` | Remove build output, Vite cache, and TypeScript build-info files. |
| `./install.sh` / `./uninstall.sh` | macOS/Linux setup and cleanup helpers. Uninstall asks for confirmation; `--yes` explicitly skips it. |

After changing the project, run:

```bash
npm test
npm run typecheck
npm run build
```

No separate lint script is configured. Tests cover request validation/local access, storage and concurrent writes, import parsing, progress-save ordering, result parsing and hidden-data masking, executor errors/timeouts, sandbox process cleanup, editorial solutions, and cleanup scripts. See [tests/](tests/).

Some executor tests **skip** when `javac` or `python3` is missing; check the skipped count before claiming full verification. For a predictable local executor run, set `JUSTCODE_SANDBOX_MODE=local` before `npm test`. Import tests use mocked LeetCode responses, and the Docker argument/cleanup test mocks process execution; passing the suite does not establish live LeetCode availability or a working Docker installation.

## Previewing a Build

Development with `npm run dev` is the easiest way to practice. To use the built files locally, stop the development servers first, then:

```bash
npm run build
npm run start:backend
```

Leave that terminal running. In a **second terminal**, also at the project root:

```bash
npm run preview --workspace=frontend
```

Open the URL Vite prints, normally [http://localhost:4173](http://localhost:4173). With the current Vite configuration, preview uses the `/api` proxy to `127.0.0.1:3000`, so the backend must remain running. The built backend also works with `node backend/dist/server.js` from the root; it resolves problem storage relative to its module.

Vite preview is for local build checks. The backend does not serve frontend assets, and there is no combined production-start command. A different static server must route `/api` to the backend and serve `index.html` for client routes such as `/problems/add-two-integers`. Static hosting alone cannot execute Java/Python or save files. The backend binds to `127.0.0.1` and rejects external Host/Origin values; this project is designed for local use.

## Limitations

- One local user: no login, cloud sync, shared progress, database, or global leaderboard. Use one backend and avoid editing the same problem in multiple tabs; there is no cross-tab or multi-process conflict-resolution protocol.
- **Explore** and **Discuss** in the navigation bar are disabled placeholders, not implemented features.
- Only Java and Python3 runners are implemented. They call a method on `Solution` and judge its return value. Custom node structures, design-class APIs, and `void`/in-place-only judging are not implemented.
- Java input conversion supports a defined set of primitives, arrays, and lists; Python receives JSON-shaped values. Arbitrary imported type names are not guaranteed to work. See [Java's type mapping](backend/src/services/javaExecutor.ts) before adding new types.
- JSON comparison ignores object key order but preserves array order and value types. There is no special judge for unordered answers, floating-point tolerances, or multiple valid outputs.
- Hidden tests are local files hidden from the normal frontend responses, not secrets from the computer's owner. No official LeetCode hidden tests or account submission sync are provided.
- Data validation checks structure and parameter names; it does not verify algorithmic complexity, every input's stated constraints, or the correctness of manually supplied expected answers.
- Local execution is not a security sandbox. Docker mode adds the controls described above; the app remains a personal practice tool.

## Project Structure

```text
JustCode/
├── backend/
│   ├── src/
│   │   ├── app.ts                # Express middleware, local access, health check
│   │   ├── server.ts             # Loopback-only server entry
│   │   ├── constants.ts          # Execution limits and Docker settings
│   │   ├── requestValidation.ts  # Request and progress validation
│   │   ├── routes/               # Problem, judge, import, and progress endpoints
│   │   ├── services/             # Storage, import, runners, sandbox, JSON support
│   │   └── types.ts              # Shared backend data contracts
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── public/                   # Static assets
│   ├── src/
│   │   ├── components/           # Editor, results, stats, tests, Markdown, panes
│   │   ├── pages/                # Problem list and problem workspace
│   │   ├── plugins/              # Markdown code-group transformation
│   │   ├── services/             # API client, save ordering, local Monaco setup
│   │   ├── types/                # Frontend data contracts
│   │   ├── App.tsx               # Routes and unsaved-change handling
│   │   ├── main.tsx              # Browser entry
│   │   └── index.css             # Application styles
│   ├── index.html
│   ├── vite.config.ts            # Development/preview API proxy
│   └── package.json
├── problems/
│   ├── add-two-integers/
│   └── sort-array/
├── tests/                        # Regression tests
├── install.sh
├── uninstall.sh
├── .gitignore                    # Includes problem-data ignore rules
├── package.json                  # Workspace scripts
├── package-lock.json             # Resolved dependency versions
├── README.md
└── READMEzhTW.md
```

Generated folders include `node_modules/`, both `dist/` folders, and execution workspaces under `temp/` relative to the backend's working directory (normally `backend/temp/` with workspace commands). Execution workspaces are cleaned after a run; these are not the problem store.

## API Overview

You can use the app entirely through the browser; this table is for developers. The frontend sends relative `/api` requests through Vite's proxy. Requests and responses use JSON.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health check. |
| `GET` | `/api/problems` | List valid problem metadata. |
| `GET` | `/api/problems/:id` | Read metadata, templates, visible tests, and optional editorial; no hidden-test contents. |
| `POST` | `/api/run` | Run all visible tests or one custom input. |
| `POST` | `/api/submit` | Judge visible and hidden tests. |
| `POST` | `/api/import-problem` | Import a public LeetCode URL. |
| `POST` | `/api/problems/:id/hidden-testcases` | Append/replace hidden tests from JSON content or a project-relative file. |
| `GET` | `/api/progress` | Read saved progress across problems. |
| `GET` | `/api/progress/:id` | Read one problem's progress; `null` for a missing file or the bundled empty-progress placeholder. |
| `PUT` | `/api/progress/:id` | Save validated progress and assign its update timestamp. |
| `DELETE` | `/api/problems/:id` | Delete a non-built-in problem and its data. |

For direct API clients, `/api/submit` returns the judgment only; the browser creates an accepted record and saves it separately through the progress endpoint. Reading corrupt saved progress produces an error rather than silently replacing it with empty progress. Request shapes are in [backend types](backend/src/types.ts) and [request validation](backend/src/requestValidation.ts).

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| `npm` is missing, or npm cannot find `package.json` | Install Node.js/npm, reopen the terminal, and enter the project root. On Windows, use npm commands instead of `.sh` scripts. |
| The app cannot load problems | Check [backend health](http://localhost:3000/health) and the server terminal. If `PORT` changed, update the proxy in `frontend/vite.config.ts` and restart Vite. Use localhost, not a LAN/public address. |
| Port 3000 or 5173 is occupied | Stop the earlier JustCode terminal with `Ctrl+C`. Use Vite's printed URL if it chose another frontend port. Inspect the owner of an unfamiliar port before stopping a process. |
| Java cannot run | Check both `javac --version` and `java --version`; install a JDK, not only a JRE. Preserve `class Solution` and the expected method signature. |
| Python cannot run | Check `python3 --version`. The runner calls `python3`, even on Windows; having only `python` or `py` is insufficient. Alternatively use Docker mode. |
| Docker execution fails | Start Docker, check `docker info`, and pull the configured images. `docker` mode fails when unavailable; `auto` can fall back to local execution. |
| Run/Submit times out or reports busy | Check for infinite loops and the listed limits. For HTTP 429, wait for existing work to finish before retrying. Docker/process startup can contribute to observed time. |
| LeetCode import fails | Use `https://leetcode.com/problems/<problem-slug>/`, check connectivity and the error message. Duplicate IDs are not overwritten; design-class or changed remote data formats may be unsupported. |
| An imported problem fails to execute | Check its metadata and template for unsupported structures, return types, or missing imports. Import success is not a guarantee of runner compatibility. |
| Custom input or hidden tests are rejected | Use the correct JSON shape and exact parameter names. Hidden imports need a non-empty array; Project Path must point to an existing regular file inside the repository. Check the 10/64 MiB limits. |
| A problem is absent from the list | Check the folder name, matching metadata `id`, valid metadata, and non-empty visible tests. The backend skips invalid folders and logs a warning. |
| The editor is empty or starter code fails | A template may be missing, or its body may be deliberately unfinished. Use the first-solution example; add the language's template when authoring problems. |
| Progress cannot load or save | Copy the current editor text, inspect the error/server logs, and use Retry/Retry save. Back up a corrupt `progress.json` before repairing it or removing it to start over; the backend intentionally refuses to overwrite corrupt progress. |
| Run works but Submit fails to read tests | Back up and inspect `testcases_hidden.json`. A missing hidden file means no hidden tests; malformed JSON is an error, not an empty test set. Repair it or intentionally replace it through Add Hidden Tests. |
| AC code shows no debug output | Successful runs hide debug output by design. Inspect the returned value; debug output is shown only for failing visible cases. |

---

## Implementation and Portfolio Notes

| Area | Implemented behavior | Source |
| --- | --- | --- |
| Full-stack practice UI | React/TypeScript, Monaco editor, per-language drafts, resizable panels, Markdown editorials, and statistics | [ProblemDetail](frontend/src/pages/ProblemDetail.tsx), [components](frontend/src/components/), [frontend dependencies](frontend/package.json) |
| Java/Python judging | Generate runners from function metadata, compile/check syntax, execute tests, compare JSON values, and return diagnostics | [Executor factory](backend/src/services/codeExecutorFactory.ts), [Java](backend/src/services/javaExecutor.ts), [Python](backend/src/services/pythonExecutor.ts), [shared result logic](backend/src/services/executionUtils.ts) |
| Execution controls | Local/Docker selection, deadlines, bounded output, process cleanup, and concurrent-request limits | [Sandbox runner](backend/src/services/sandboxRunner.ts), [routes](backend/src/routes/problemRoutes.ts) |
| File-based persistence | Validate data, serialize changes per problem within the backend process, write synchronized temporary JSON files, then rename them into place | [Storage](backend/src/services/storage.ts), [problem service](backend/src/services/problemService.ts) |
| Problem import | Validate URLs/metadata/testcases, convert public LeetCode data, and publish a completed staging folder without overwriting existing problems | [Importer](backend/src/services/leetcodeService.ts), [validation](backend/src/services/problemValidation.ts), [problem service](backend/src/services/problemService.ts) |
| Progress reliability | Order saves per problem, retain failed drafts in memory, retry saves, and flush during navigation | [Progress persistence](frontend/src/services/progressPersistence.ts), [workspace](frontend/src/pages/ProblemDetail.tsx) |
| Regression verification | API, data integrity, concurrency, language execution, sandbox handling, frontend state, and executable editorial cases | [Tests](tests/), [scripts](package.json) |

> Built a local coding-practice application with React, TypeScript, Express, and Monaco, supporting Java/Python3 execution, LeetCode example import, custom/hidden tests, and automatic progress saving. Implemented file-based persistence, execution limits with optional Docker isolation, and regression tests for judging, data integrity, and progress handling.
