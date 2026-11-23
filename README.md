# JustCode

**English** · [繁體中文](READMEzhTW.md)

Practice Java and Python on your own computer with JustCode. Solve problems in a browser editor, test your code, and revisit the code and result of each attempt you submit. No account is required. After setup, both bundled problems work offline.

**Practice** · [Quick start](#quick-start) · [Solve your first problem](#solve-your-first-problem) · [Drafts and history](#drafts-results-and-history)

**Maintain and develop** · [Add problems and tests](#add-problems-and-tests) · [Back up and restore](#back-up-and-restore) · [Development](#development) · [Troubleshooting](#troubleshooting)

## Quick start

Install Node.js with npm. For local execution, install **either Python or the JDK**. The editor and SQLite driver come with the app. Use the default mode for code you write or trust. If Docker or the language image is unavailable, it runs solutions with your user account’s file permissions. To require a container, use a language image and set `JUSTCODE_SANDBOX_MODE=docker`. [Execution modes](#execution-modes)

| Tool | Version | Check in your terminal |
| --- | --- | --- |
| [Node.js](https://nodejs.org/en/download) | 22 or later | `node --version` and `npm --version` |
| [Python](https://www.python.org/downloads/) | 3.9 or later, for Python solutions | `python3 --version` · [Windows setup](#python-on-windows) |
| [Java Development Kit](https://adoptium.net/temurin/releases/) | JDK 11 or later, for Java solutions | `javac --version` and `java --version` |

1. Get the project. With Git, run the commands below. You can also choose **Code → Download ZIP** on GitHub, extract it, and open a terminal in the folder containing `package.json`.

   ```sh
   git clone https://github.com/TsengPinRuei/JustCode.git
   cd JustCode
   ```

2. Install dependencies from that folder. On **macOS or Linux**, run `npm ci`. On **Windows PowerShell**, use an up-to-date Node.js 22.x release and run `npx --yes npm@11.20.0 ci`.
3. Start the app.

   ```sh
   npm run dev
   ```

In a desktop browser, open the **Local** address printed in the terminal, usually [localhost:5173](http://localhost:5173). **Problems** lists two exercises on a fresh install. Keep the terminal running. To stop, wait for saves and submissions to finish, then press `Ctrl+C`. Start again with `npm run dev`.

## Solve your first problem

Open **-27. Add Two Integers**. The first example gives you `12` and `5` and expects `17`. JustCode calls `Solution.sum` and checks its return value. In **Language**, choose **Python3** or **Java** and replace the editor contents with the matching solution.

**Python3**

```python
class Solution:
    def sum(self, num1: int, num2: int) -> int:
        return num1 + num2
```

**Java**

```java
class Solution {
    public int sum(int num1, int num2) {
        return num1 + num2;
    }
}
```

| Try it | What happens with the bundled tests |
| --- | --- |
| Select **Case 1** under **Testcase** and click **Run**. | Run checks all visible examples. **Result** shows **Accepted**, **2 / 2**. |
| Return to **Testcase**, choose **Custom Input**, enter `{"num1": -3, "num2": 8}`, and click **Run**. | **Actual** shows `5`. In this mode **Accepted** means the code ran successfully. You check the answer. |
| Click **Submit**. | The judge runs visible and hidden tests. You’ll see **Accepted**, **52 / 52**, and the problem is marked solved. Only Submit records attempts in history, including failed ones. |
| Open **Submission history** beside the problem title, then **View**. | You can read or copy the exact code saved for that attempt. |

### Drafts, results, and history

- Each problem **autosaves** separate Java and Python drafts about a second after you stop typing. **Reset** replaces the current language’s draft with its starter code.
- For **Wrong Answer**, compare **Expected** and **Actual** on a visible case. **Console Output** shows debug text from failed visible cases. Hidden tests report totals and the first failure’s case number, status, and time.
- **Activity** shows submissions, accepted attempts, and distinct problems practiced or solved. It opens on the last 30 days in your time zone. Filter by problem, language, or dates, then click **Apply filters**. Clear both dates for all time.
- In the problem’s **Stats**, **Best Total** is your shortest time to solve it. **Latest Submit** measures the browser request for your latest accepted attempt. **Server judge** in submission details measures judging time.

Both bundled problems include an **Editorial** with worked Java and Python solutions.

| Problem | Difficulty | Visible / hidden tests | Editorial |
| --- | --- | --- | --- |
| [-27. Add Two Integers](problems/add-two-integers/problem.json) | Easy | 2 / 50 | [Direct addition and bit manipulation](problems/add-two-integers/editorial.md) |
| [-09. Sort an Array](problems/sort-array/problem.json) | Medium | 3 / 69 | [Five sorting algorithms and their trade-offs](problems/sort-array/editorial.md) |

## Add problems and tests

### Import from LeetCode

While online, open **Problems → Import from LeetCode**, paste a public problem URL, and click **Import**. The statement, available Java/Python templates, and public examples are saved locally. The public examples become the visible tests. The hidden set starts empty.

Choose a problem with one `Solution` method that returns a JSON-compatible value. Design classes, custom nodes such as `TreeNode`, and answers judged solely by in-place changes need a different runner. [Try Binary Search on LeetCode](https://leetcode.com/problems/binary-search/)

### Add a hidden test

On **Sort an Array**, open **Testcase → Add Hidden Tests**. Choose **Append** to keep the existing cases or **Replace** to overwrite the hidden set. Paste this JSON array, click **Import Hidden Tests**, then **Submit** to use the updated set.

```json
[
  {"input": {"nums": [3, -1, 3]}, "output": [-1, 3, 3]}
]
```

Each `input` uses the problem’s parameter names and each `output` is the expected return value. **Choose File** loads a JSON file, and **Project Path** reads an existing file relative to the project root. **Download Description** beside the title exports the parameters and a sample case as Markdown.

<details>
<summary>Write a problem from scratch</summary>

1. Copy the [bundled addition folder](problems/add-two-integers/) to `problems/my-addition/`. In `problem.json`, set `id` to the folder name. Use lowercase letters, digits, hyphens, or underscores, beginning with a letter or digit (up to 200 characters).
2. Edit the title, statement, and examples. Match `functionName`, `params`, and `returnType` to the signatures and each language’s `template.java` or `template.py`.
3. Put at least one input/output pair in `testcases_visible.json`. The examples in `problem.json` are for readers. Replace the copied `testcases_hidden.json` and `editorial.md` with your own cases and solution, or omit these optional files.
4. Refresh **Problems**, open the new entry, and try **Run** and **Submit**. If the entry is missing, the backend terminal identifies skipped problem folders.

</details>

## Back up and restore

JustCode stores the problem catalog in `problems/`. Drafts, solve status, submitted code, and results live in `data/justcode.sqlite`. Git ignores personal practice data and locally added problems.

1. After the first successful startup, let saves and submissions finish. Pause catalog edits and imports, then run `npm run data:backup` from the project root. It prints the snapshot path in `data/backups/`. The backend can stay running.
2. **Copy the snapshot and the matching `problems/` folder together** to your backup location. Resume catalog changes after the copy finishes.
3. To restore, **stop the backend**. Move the current `data/` and `problems/` folders aside. Restore the saved catalog as `problems/`, create a fresh `data/`, and copy the snapshot into it as `justcode.sqlite`. Restart and open a saved draft and its submission history.

Deleting an added problem from **Problems** removes its files, drafts, and history together. Back up first if you want to keep them. The two bundled problems are protected.

When upgrading from an older version, JustCode backs up legacy `progress.json` files in `data/backups/legacy-*/` before importing them. **Imported** entries contain the accepted summaries recorded by those versions.

## Development

The React workspace uses the Monaco editor. Vite forwards `/api` requests to Express at `127.0.0.1:3000`. One backend owns the practice database. On Submit, it reads the problem’s tests, saves the code in SQLite, and runs the Java or Python solution in a temporary directory. It writes the verdict and solve status together. On restart, pending submissions appear as **Interrupted**.

| To change | Start here |
| --- | --- |
| Editor, drafts, or history views | [Problem workspace](frontend/src/pages/ProblemDetail.tsx) · [Draft saving](frontend/src/services/progressPersistence.ts) · [Activity](frontend/src/pages/Activity.tsx) |
| Problem import and validation | [LeetCode importer](backend/src/services/leetcodeService.ts) · [Problem files](backend/src/services/problemService.ts) · [Validation](backend/src/services/problemValidation.ts) |
| Execution and judging | [Java runner](backend/src/services/javaExecutor.ts) · [Python runner](backend/src/services/pythonExecutor.ts) · [Result comparison](backend/src/services/executionUtils.ts) |
| API, practice data, or backups | [Routes](backend/src/routes/problemRoutes.ts) · [Practice database](backend/src/services/practiceDatabase.ts) · [Schema and backups](backend/src/services/practiceSchema.ts) |

### Build and test

Run these commands from the project root. Install both language runtimes for the full suite. CI runs it on Linux with Node.js 22, JDK 17, and Python 3.11, and tests SQLite storage on Linux, macOS, and Windows.

| Task | Commands |
| --- | --- |
| Check types, run regression tests, and build | `npm run typecheck`, `npm test`, then `npm run build` |
| Run browser tests | Install Chromium once with `npx playwright install chromium`, then run `npm run test:ui` |
| Start one development server | `npm run dev:frontend` or `npm run dev:backend` |
| Preview the build | After building, run `npm run start:backend` in one terminal and `npm run preview --workspace=frontend` in another. Open the URL Vite prints. |
| Clean installed packages, builds, and temporary files | `npm run clean` |
| Use the macOS/Linux helpers | [Install dependencies](install.sh) · [Interactive cleanup](uninstall.sh) |

For a pull request, describe the change and the checks you ran. To enable the optional pre-push check for local practice files in your clone, run `git config --local core.hooksPath .githooks`. [CI workflow](.github/workflows/verify.yml) · [Tests](tests/) · [npm scripts](package.json) · [Pre-push check](.githooks/pre-push)

### Execution modes

`JUSTCODE_SANDBOX_MODE` defaults to `auto`. It uses Docker when the daemon and the language image are ready, and otherwise uses the host runtime. In `local` mode, solutions run with your OS user’s file access. Use `docker` to require a container with networking disabled and a read-only root filesystem.

Start Docker and pull the image for each language you use.

```sh
docker pull eclipse-temurin:17-jdk
docker pull python:3.11-slim
```

On macOS/Linux, start with `JUSTCODE_SANDBOX_MODE=docker npm run dev`. In PowerShell, set `$env:JUSTCODE_SANDBOX_MODE = "docker"` before running `npm run dev`.

<details>
<summary>API, judge limits, and configuration</summary>

- To use the **HTTP API**, start with `GET /health` for readiness, `GET /api/problems` for the catalog, `POST /api/run` for visible or custom input, and `POST /api/submit` to record an attempt. Query history with `GET /api/submissions` and daily totals with `GET /api/stats/daily`. [All routes](backend/src/routes/problemRoutes.ts) · [Client request examples](frontend/src/services/apiClient.ts)
- For **retryable submissions**, supply a new UUID as `submissionId` for each attempt. Retry the same problem, language, and code with the same ID to retrieve the stored result. HTTP 202 means judging is in progress. Reusing an ID with different content returns 409.
- The **judge** compares arrays in order, accepts object keys in any order, and compares floating-point values exactly. The API preserves integers beyond JavaScript’s safe range. Use a lossless JSON parser to read them. Java uses signed 32-bit `int` and 64-bit `long`. Metadata `float` maps to a finite `double`. [Numeric rules](backend/src/services/numericContract.ts) · [JSON handling](backend/src/shared/json.ts)
- Run and Submit share **two execution slots**. HTTP 429 means both are busy. Compilation or syntax checking gets up to 10 seconds, each case up to 1 second, and the whole compile-and-test sequence shares a 60-second budget. [Judge and Docker defaults](backend/src/constants.ts)
- If you change the **backend port** with `PORT`, update Vite’s `/api` target too. Override the images with `JUSTCODE_JAVA_SANDBOX_IMAGE` or `JUSTCODE_PYTHON_SANDBOX_IMAGE`. [Vite proxy](frontend/vite.config.ts) · [Container settings](backend/src/services/sandboxRunner.ts)

</details>

## Troubleshooting

| Symptom | What to do |
| --- | --- |
| The page opens but the problem list fails to load | Check for `"status":"ok"` at the [backend health endpoint](http://127.0.0.1:3000/health). If it fails, read the backend terminal. If it succeeds, check the Vite proxy. |
| Java or Python fails to start | Run the version checks from Quick start in the terminal that starts JustCode. For Docker, check `docker info` and the language image, then restart the backend. |
| **Changes have not been saved** | Keep the tab open, copy your code, reconnect the backend, and click **Retry save**. |
| The connection drops during Submit | Check **Submission history**. If **Retry submission** appears, it reuses the original submission ID. |

For a practice error, include the problem ID, language, error message, and a small input that reproduces it. [JustCode issues](https://github.com/TsengPinRuei/JustCode/issues)

### Python on Windows

JustCode starts `python3.exe` directly. If PowerShell finds only `py` or `python`, install the Python install manager and run `pymanager install 3.11`. Enable the **Python (default)** aliases in **Manage app execution aliases**, then check that your user `Path` contains `%LOCALAPPDATA%\Microsoft\WindowsApps`. [Python’s Windows setup guide](https://docs.python.org/3/using/windows.html#python-install-manager)

Open a new PowerShell. This command prints the Python version if Node.js can launch the interpreter.

```powershell
node -e "require('node:child_process').execFileSync('python3', ['--version'], { stdio: 'inherit' })"
```

In the same window, start `npm run dev`. With the [first problem’s Python solution](#solve-your-first-problem), **Run** shows **2 / 2**.

## License

Copyright © 2026 Pin Ruei Tseng. The source code and bundled materials use the MIT License. Dependencies and imported problems retain their respective terms. [MIT License](LICENSE)
