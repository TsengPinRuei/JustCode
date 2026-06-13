# JustCode

JustCode is a single-machine coding practice app inspired by LeetCode. It runs a React frontend and an Express backend on your own computer, stores problems as files under `problems/`, and executes Java or Python3 solutions locally or in Docker.

The project is meant for personal learning and local practice. It is not a hosted multi-user online judge.

![JustCode](https://img.shields.io/badge/JustCode-v1.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## Key Features

- Browse local coding problems with difficulty, tags, and solved/attempted status.
- Solve problems in Java or Python3 using a Monaco-based code editor.
- Run visible testcases, run one custom JSON input, or submit against visible plus hidden testcases.
- Save progress automatically per problem, including selected language and code for each language.
- Import public LeetCode problem data by URL, including statement text, examples, constraints, Java/Python3 templates, and example testcases.
- Delete imported problems from the UI. Built-in problems are protected from deletion.
- Read Markdown editorials with GitHub-flavored Markdown, tabbed adjacent code blocks, and copy buttons.
- See AC, WA, CE, RE, and TLE feedback, per-testcase details, timing, and compile-error markers in the editor.
- Run code through a sandbox runner with temporary workspaces, timeout handling, bounded output, and optional Docker isolation.
- Resize the problem, editor, and console panes while working.

## Requirements

- Node.js 18 or newer, with npm.
- Java Development Kit 11 or newer if you want to run Java in local sandbox mode.
- Python 3 if you want to run Python3 in local sandbox mode.
- Docker is optional, but strongly recommended when running code you do not fully trust.
- Internet access is required for `npm install` and for LeetCode imports.
- macOS, Linux, or Windows. The `install.sh` and `uninstall.sh` scripts are for macOS/Linux; the npm commands work cross-platform.

Check your environment:

```bash
node --version
npm --version
javac --version
java --version
python3 --version
docker --version
```

## Installation

From the repository root:

```bash
npm install
```

This uses npm workspaces to install the root, frontend, and backend dependencies.

On macOS/Linux, you can also run:

```bash
./install.sh
```

The script checks for Node.js and then runs `npm install`.

## Configuration

JustCode does not require a `.env` file for normal local use. Configuration is read from environment variables.

| Variable | Default | Purpose |
| --- | --- | --- |
| `PORT` | `3000` | Backend API port. The Vite dev proxy expects `3000` unless you also update `frontend/vite.config.ts`. |
| `JUSTCODE_SANDBOX_MODE` | `auto` | Code execution mode: `auto`, `docker`, or `local`. |
| `JUSTCODE_JAVA_SANDBOX_IMAGE` | `eclipse-temurin:17-jdk` | Docker image for Java execution. |
| `JUSTCODE_PYTHON_SANDBOX_IMAGE` | `python:3.11-slim` | Docker image for Python execution. |
| `JUSTCODE_DOCKER_MEMORY` | `256m` | Docker memory limit per execution container. |
| `JUSTCODE_DOCKER_CPUS` | `1` | Docker CPU limit per execution container. |
| `JUSTCODE_DOCKER_PIDS_LIMIT` | `64` | Docker process limit per execution container. |

Sandbox modes:

| Mode | Behavior |
| --- | --- |
| `auto` | Uses Docker only when the required image already exists locally and the Docker daemon is available. Otherwise it falls back to restricted local execution. |
| `docker` | Requires Docker and the configured image. If Docker is unavailable, execution fails instead of falling back. Use this for untrusted code. |
| `local` | Runs local `javac`, `java`, and `python3` without a shell and with a minimal environment. This is convenient, but it is not a full security boundary. |

For Docker mode:

```bash
docker pull eclipse-temurin:17-jdk
docker pull python:3.11-slim
JUSTCODE_SANDBOX_MODE=docker npm run dev
```

On Windows PowerShell, set environment variables like this:

```powershell
$env:JUSTCODE_SANDBOX_MODE = "docker"
npm run dev
```

## Usage

Start both development servers:

```bash
npm run dev
```

This starts:

- Backend API: `http://localhost:3000`
- Frontend app: `http://localhost:5173`

Open:

```text
http://localhost:5173
```

The backend also has a health check:

```text
http://localhost:3000/health
```

### Solving a Problem

1. Open the problem list.
2. Select a problem.
3. Choose Java or Python3 if the problem supports both.
4. Edit the starter code.
5. Use `Run` to run visible testcases or the current custom input.
6. Use `Submit` to run visible and hidden testcases.

Only `Submit` can mark a problem as solved because `Run` does not use hidden testcases.

### Custom Input

Custom input must be a JSON object with the same parameter names as the problem metadata. For example:

```json
{
  "nums": [5, 2, 3, 1]
}
```

For the built-in Add Two Integers problem:

```json
{
  "num1": 12,
  "num2": 5
}
```

Custom input has no expected output, so JustCode reports whether the code executed successfully and shows the returned value.

### Importing From LeetCode

On the problem list page, click `Import from LeetCode` and paste a URL like:

```text
https://leetcode.com/problems/two-sum/
```

Imported problems are saved under `problems/<problem-slug>/`.

Important limits:

- Import uses LeetCode's public GraphQL response and the current problem HTML shape.
- Only Java and Python3 snippets are imported.
- Only public example testcases are imported as visible testcases.
- LeetCode hidden judge testcases are not available. JustCode creates an empty `testcases_hidden.json` file so you can add hidden cases manually later.
- Imported problems are ignored by the current `.gitignore` unless you explicitly change the ignore rules or force-add the files.

### Local Problem Files

Each problem directory uses this layout:

```text
problems/<problem-id>/
├── problem.json
├── template.java
├── template.py
├── editorial.md
├── testcases_visible.json
├── testcases_hidden.json
└── progress.json
```

`problem.json` defines title, difficulty, tags, statement text, examples, constraints, supported languages, function name, parameters, return type, and displayed function signatures.

Testcase files are JSON arrays:

```json
[
  {
    "input": {
      "nums": [5, 2, 3, 1]
    },
    "output": [1, 2, 3, 5]
  }
]
```

`progress.json` stores local user progress. The app writes it automatically.

## Common Commands

Run these from the repository root unless noted.

| Command | What it does |
| --- | --- |
| `npm install` | Installs all workspace dependencies. |
| `npm run dev` | Starts backend and frontend development servers together. |
| `npm run dev:backend` | Starts only the backend on `PORT` or `3000`. |
| `npm run dev:frontend` | Starts only the Vite frontend on `5173`. |
| `npm run build` | Builds frontend and backend. Use this as the current main verification command. |
| `npm run build:frontend` | Builds only the frontend. |
| `npm run build:backend` | Builds only the backend TypeScript output. |
| `npm run start:backend` | Starts the built backend from the backend workspace. Run `npm run build:backend` first. |
| `npm run clean` | Removes dependencies, build output, temporary execution files, and lock files. |
| `npm run clean:modules` | Removes `node_modules` and lock files only. |
| `npm run clean:build` | Removes build output and TypeScript build info only. |
| `./install.sh` | macOS/Linux helper for installation. |
| `./uninstall.sh` | macOS/Linux helper for cleaning dependencies and build output. |

There is currently no `npm test` or lint script in this repository. Use `npm run build` to type-check and build both apps.

## Build and Deployment Notes

Build everything:

```bash
npm run build
```

Start the built backend:

```bash
npm run start:backend
```

Use the workspace script instead of running `node backend/dist/server.js` directly from the repository root. The backend expects its working directory to be `backend/` so it can find `../problems`.

There is no bundled single-command production server for both frontend and backend. For deployment, serve `frontend/dist` with a static file server or reverse proxy, and route `/api` requests to the backend. The development setup uses Vite's proxy for `/api`.

## Project Structure

```text
JustCode/
├── backend/                    # Express + TypeScript API
│   ├── src/
│   │   ├── constants.ts        # Timeouts, sandbox env vars, protected problem IDs
│   │   ├── routes/             # REST API routes
│   │   ├── services/           # Problem storage, LeetCode import, code execution
│   │   ├── server.ts           # Express server entry
│   │   └── types.ts            # Backend API/data types
│   └── package.json
├── frontend/                   # React + TypeScript + Vite app
│   ├── public/                 # Static assets
│   ├── src/
│   │   ├── components/         # Editor, console, description, layout components
│   │   ├── pages/              # Problem list and problem detail pages
│   │   ├── plugins/            # Markdown code-group plugin
│   │   ├── services/           # Axios API client
│   │   ├── types/              # Frontend API/data types
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── problems/                   # File-backed problem store
│   ├── add-two-integers/       # Built-in protected problem
│   └── sort-array/             # Built-in protected problem
├── install.sh                  # macOS/Linux install helper
├── uninstall.sh                # macOS/Linux cleanup helper
├── package.json                # npm workspace scripts
└── package-lock.json
```

## API Overview

The frontend calls relative `/api` paths. In development, Vite proxies these to the backend on port `3000`.

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Backend health check. |
| `GET` | `/api/problems` | List problem metadata. |
| `GET` | `/api/problems/:id` | Load one problem without hidden testcase contents. |
| `POST` | `/api/run` | Run visible testcases or one custom input. |
| `POST` | `/api/submit` | Submit against visible and hidden testcases. |
| `POST` | `/api/import-problem` | Import a public LeetCode problem URL. |
| `GET` | `/api/progress` | Read all saved progress files. |
| `GET` | `/api/progress/:id` | Read one problem's progress. |
| `PUT` | `/api/progress/:id` | Save one problem's progress. |
| `DELETE` | `/api/problems/:id` | Delete a non-protected problem. |

## Troubleshooting

### The frontend cannot connect to the backend

Check that the backend is running:

```text
http://localhost:3000/health
```

If you changed `PORT`, also update the Vite proxy target in `frontend/vite.config.ts`, or the frontend will still send `/api` requests to port `3000` during development.

### Port 3000 or 5173 is already in use

Stop the existing process, then run `npm run dev` again.

macOS/Linux:

```bash
lsof -ti:3000 | xargs kill
lsof -ti:5173 | xargs kill
```

Windows PowerShell:

```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process
```

### `javac: command not found` or Java compilation always fails

Install a JDK, not just a JRE, and confirm:

```bash
javac --version
java --version
```

You can also use Docker mode after pulling the Java image:

```bash
docker pull eclipse-temurin:17-jdk
JUSTCODE_SANDBOX_MODE=docker npm run dev
```

### `python3: command not found`

Install Python 3 and confirm:

```bash
python3 --version
```

Or use Docker mode after pulling the Python image:

```bash
docker pull python:3.11-slim
JUSTCODE_SANDBOX_MODE=docker npm run dev
```

### Docker mode fails

Make sure Docker Desktop or the Docker daemon is running, then pull the images used by the app:

```bash
docker pull eclipse-temurin:17-jdk
docker pull python:3.11-slim
```

`JUSTCODE_SANDBOX_MODE=docker` fails closed if Docker or the image is unavailable. `auto` falls back to local execution when Docker is not ready.

### LeetCode import fails

Check that the URL matches this shape:

```text
https://leetcode.com/problems/<problem-slug>/
```

The importer depends on network access, LeetCode's public GraphQL response, and the current statement HTML format. If LeetCode changes its response shape, the importer may need code changes in `backend/src/services/leetcodeService.ts`.

### Custom input is rejected

Custom input must be valid JSON and must match the problem parameter names. Use the first visible testcase as a template.

### A problem does not appear in the list

The backend skips invalid problem directories. Check that the directory contains a valid `problem.json` and `testcases_visible.json`.

Also start the backend through the workspace command so it can find the problem store:

```bash
npm run dev:backend
```