# JustCode

A single-machine LeetCode-like coding practice platform with offline Java code execution.

![JustCode](https://img.shields.io/badge/JustCode-v1.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **Multi-Language Support**: Java and Python3 supported with automatic language detection
- **LeetCode Import**: Import problems directly from LeetCode by URL — auto-extracts description, examples, constraints, templates, and testcases
- **User Interface**: Familiar and intuitive interface with dark theme
- **Offline Code Execution**: Run and submit code locally without external dependencies
- **Error Highlighting**: Real-time compilation error highlighting in the code editor with red squiggly lines
- **Complete Problem Flow**: Problem browsing, code editing, running, and submission
- **Monaco Editor**: Professional code editing experience with syntax highlighting and error markers
- **Comprehensive Testing**: Visible testcases for practice, hidden testcases for validation
- **Real-time Feedback**: Instant results with AC/WA/CE/RE/TLE status indicators
- **Resizable Layout**: Adjustable split pane for optimal workspace

## System Requirements

- **Node.js**: Version 18.x or higher
- **JDK**: Java Development Kit 11 or higher (for Java code execution)
- **Python**: Python 3.x (for Python code execution)
- **Operating System**: macOS, Linux, or Windows

### Verify Environment:

```bash
# Check Node.js version
node --version          # Should be >= 18.0.0

# Check Java version
java --version          # Should be >= 11
javac --version         # Should be >= 11

# Check Python version
python3 --version       # Should be >= 3.x
```

## Installation and Execution

1. **Clone or navigate to the project directory:**
   ```bash
   cd JustCode
   ```

2. **Install dependencies (cross-platform):**
   ```bash
   npm install
   ```

   This will install dependencies for both frontend and backend using npm workspaces.

3. **Start the development servers:**
   ```bash
   npm run dev
   ```

   This starts both:
   - **Backend** (Express API): `http://localhost:3000`
   - **Frontend** (React + Vite): `http://localhost:5173`

4. **Open your browser:**
   Navigate to `http://localhost:5173`

## Cleanup and Uninstallation

### Reset for Reinstallation

If you want to **keep the project** but reinstall dependencies (e.g., to fix issues):

```bash
npm run clean  # Remove node_modules, build artifacts, and lock files
npm install    # Reinstall all dependencies
```

Other cleanup commands:
- `npm run clean:modules` - Only remove node_modules and lock files
- `npm run clean:build` - Only remove build artifacts (dist, .vite, etc.)

> **Note**: These commands preserve your source code, problem files, and configuration.

### Complete Removal

If you want to **completely delete** JustCode from your computer:

```bash
# macOS/Linux
cd ..
rm -rf JustCode

# Windows (PowerShell)
cd ..
Remove-Item -Recurse -Force JustCode
```

## Project Structure

```
JustCode/
├── frontend/                       # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/             # Navbar, Editor, Console, etc.
│   │   ├── pages/                  # ProblemList, ProblemDetail
│   │   ├── plugins/                # Remark plugins (tabbed code blocks)
│   │   ├── services/               # API client
│   │   ├── types/                  # TypeScript interfaces
│   │   └── App.tsx
│   └── package.json
├── backend/                        # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/                 # API endpoints
│   │   ├── services/               # Executors, problem service, LeetCode import
│   │   └── server.ts
│   └── package.json
├── problems/                       # Problem data (JSON + Markdown)
│   ├── sort-array/
│   │   ├── problem.json
│   │   ├── template.java           # Java template
│   │   ├── template.py             # Python template
│   │   ├── editorial.md            # Problem editorial
│   │   ├── testcases_visible.json
│   │   └── testcases_hidden.json
│   └── two-sum/                    # Imported from LeetCode
│       ├── problem.json
│       ├── template.java
│       ├── template.py
│       ├── testcases_visible.json
│       └── testcases_hidden.json
├── install.sh                      # Installation script
├── uninstall.sh                    # Cleanup script
└── package.json                    # Root workspace config
```

## Usage Guide

### Running Code

1. Click "Run" to test your code with example testcases
2. Switch to "Custom Input" tab and provide your own JSON input
3. Click "Submit" to run against all testcases (visible + hidden)

### Understanding Results

- **AC (Accepted)**: All testcases passed
- **WA (Wrong Answer)**: At least one testcase failed
- **CE (Compile Error)**: Code compilation failed
- **RE (Runtime Error)**: Code threw an exception
- **TLE (Time Limit Exceeded)**: Code exceeded time limit

## Troubleshooting

### "javac: command not found"

**Problem**: JDK is not installed or not in PATH.

**Solution**:
1. Download and install JDK from [Oracle](https://www.oracle.com/java/technologies/downloads/) or [OpenJDK](https://openjdk.org/)
2. Add Java to your PATH:
   ```bash
   # macOS/Linux - Add to ~/.zshrc or ~/.bashrc
   export JAVA_HOME=/path/to/jdk
   export PATH=$JAVA_HOME/bin:$PATH
   
   # Windows - Set environment variables in System Properties
   ```
3. Verify: `javac --version`

### Port Already in Use

**Problem**: Port 3000 or 5173 is already in use.

**Solution**:
```bash
# macOS/Linux - Find and kill processes
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Windows (PowerShell)
Get-Process -Id (Get-NetTCPConnection -LocalPort 3000).OwningProcess | Stop-Process -Force
Get-Process -Id (Get-NetTCPConnection -LocalPort 5173).OwningProcess | Stop-Process -Force

# Or change ports in:
# - backend/src/server.ts (PORT=3000)
# - frontend/vite.config.ts (port: 5173)
```

### Module Not Found Errors

**Problem**: Dependencies not installed.

**Solution**:
```bash
# Cross-platform clean install
npm run clean:modules
npm install
```

## Security Note

This project is designed for personal learning and local use only, **do not** use this in:
- Multi-user environments
- Production systems
- Scenarios with untrusted code

## Future Enhancements

- [x] Import problems via LeetCode URL
- [x] Support Python3
- [x] Solution Editorial with tabbed multi-language code blocks
- [x] Error highlighting in code editor
- [ ] User accounts and submission history
- [ ] Difficulty-based filtering
- [ ] Code execution statistics and leaderboards

## Contributing

This is a personal learning project, but suggestions and improvements are welcome:
1. Fork the repository
2. Create your feature branch
3. Submit a pull request

## License

MIT License - feel free to use this project for learning purposes.

## Acknowledgments

- Inspired by [LeetCode](https://leetcode.com)
- Built with [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- Powered by [React](https://react.dev/), [Express](https://expressjs.com/), and [TypeScript](https://www.typescriptlang.org/)