# JustCode

A single-machine LeetCode-like coding practice platform with offline Java code execution.

![JustCode](https://img.shields.io/badge/JustCode-v1.0-green)
![License](https://img.shields.io/badge/license-MIT-blue)

## Features

- **User Interface**: Familiar and intuitive interface with dark theme
- **Offline Java Execution**: Run and submit Java code locally without external dependencies
- **Complete Problem Flow**: Problem browsing, code editing, running, and submission
- **Monaco Editor**: Professional code editing experience with syntax highlighting
- **Comprehensive Testing**: Visible testcases for practice, hidden testcases for validation
- **Real-time Feedback**: Instant results with AC/WA/CE/RE/TLE status indicators
- **Resizable Layout**: Adjustable split pane for optimal workspace
- **Editorial Support**: Comprehensive problem editorials with step-by-step examples and learning paths

## System Requirements

- **Node.js**: Version 18.x or higher
- **JDK**: Java Development Kit 11 or higher (for code execution)
- **Operating System**: macOS, Linux, or Windows

### Verify Environment:

```bash
# Check Node.js version
node --version  # Should be >= 18.0.0

# Check Java version
java --version  # Should be >= 11
javac --version # Should be >= 11
```

## Installation and Execution

1. **Clone or navigate to the project directory:**
   ```bash
   cd JustCode
   ```

2. **Install dependencies:**
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

## Project Structure

```
JustCode/
├── frontend/                       # React + TypeScript + Vite
│   ├── src/
│   │   ├── components/             # Navbar, Editor, Console, etc.
│   │   ├── pages/                  # ProblemList, ProblemDetail
│   │   ├── services/               # API client
│   │   ├── types/                  # TypeScript interfaces
│   │   └── App.tsx
│   └── package.json
├── backend/                        # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── routes/                 # API endpoints
│   │   ├── services/               # Java executor, problem service
│   │   ├── templates/              # Runner.java template
│   │   └── server.ts
│   └── package.json
├── problems/                       # Problem data (JSON + Markdown)
│   └── sort-array/
│       ├── problem.json
│       ├── template.java
│       ├── editorial.md            # Problem editorial
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
# Find and kill processes
lsof -ti:3000 | xargs kill -9
lsof -ti:5173 | xargs kill -9

# Or change ports in:
# - backend/src/server.ts (PORT=3000)
# - frontend/vite.config.ts (port: 5173)
```

### Module Not Found Errors

**Problem**: Dependencies not installed.

**Solution**:
```bash
# Clean install
rm -rf node_modules frontend/node_modules backend/node_modules
npm install
```

## Security Note

This project is designed for personal learning and local use only, **do not** use this in:
- Multi-user environments
- Production systems
- Scenarios with untrusted code

## Future Enhancements

- [ ] Add more problems (arrays, trees, graphs, dynamic programming)
- [ ] Support Python and C++
- [ ] User accounts and submission history
- [ ] Difficulty-based filtering
- [x] Solution Editorial
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