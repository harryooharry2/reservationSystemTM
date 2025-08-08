# Task Master Setup Guide with Claude Code Max Membership

This guide provides step-by-step instructions for installing and configuring Task Master with your Claude Code Max membership for optimal performance.

## Prerequisites

### 1. Node.js Installation

Ensure you have Node.js v20.19.0+ installed:

```bash
node --version
```

If not installed, download from [nodejs.org](https://nodejs.org/)

### 2. Claude Code CLI Installation

Install Claude Code CLI (required for Max membership authentication):

```bash
# Install Claude Code CLI
npm install -g @anthropic-ai/claude-code

# Verify installation
claude --version
```

## Installation Methods

### Method 1: Local Installation (Recommended)

```bash
# Navigate to your project directory
cd your-project-name

# Install Task Master locally
npm install task-master-ai

# Initialize the project
./node_modules/.bin/task-master init --name "Your Project Name" --description "Project description" -y
```

### Method 2: Global Installation

```bash
# Install globally (requires sudo on macOS/Linux)
sudo npm install -g task-master-ai

# Initialize project
task-master init --name "Your Project Name" --description "Project description" -y
```

## Claude Code Max Membership Configuration

### 1. Verify Claude Code Authentication

First, ensure your Claude Code Max membership is properly authenticated:

```bash
# Test Claude Code CLI
claude --help

# Verify you can access premium models
claude code --model opus --prompt "Hello"
```

### 2. Configure Task Master for Max Membership

Set up Task Master to use your premium Claude Code models:

```bash
# Set main model to Opus (premium)
./node_modules/.bin/task-master models --set-main opus

# Set research model to Sonnet (high performance)
./node_modules/.bin/task-master models --set-research sonnet

# Verify configuration
./node_modules/.bin/task-master models
```

**Expected Output:**

```
Current Model Configuration:
- Main: claude-code/opus (Free, 72.5% SWE Score)
- Research: claude-code/sonnet (Free, 72.7% SWE Score)
- Fallback: anthropic/claude-3-7-sonnet-20250219 (Free, 62.3% SWE Score)
```

## MCP (Model Context Protocol) Setup

### For Cursor IDE

Create or update `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "task-master-ai": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"]
    }
  }
}
```

**Note:** No API keys needed when using Claude Code!

### For VS Code

Create or update `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "task-master-ai": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "--package=task-master-ai", "task-master-ai"]
    }
  }
}
```

## Project Initialization

### 1. Create PRD (Product Requirements Document)

Create a detailed PRD at `scripts/prd.txt` or `.taskmaster/docs/prd.txt`:

```bash
# Create PRD directory
mkdir -p scripts
touch scripts/prd.txt

# Or use the template
cp .taskmaster/templates/example_prd.txt scripts/prd.txt
```

### 2. Parse PRD and Generate Tasks

```bash
# Parse your PRD to generate initial tasks
./node_modules/.bin/task-master parse-prd scripts/prd.txt --force
```

### 3. Verify Task Generation

```bash
# List all generated tasks
./node_modules/.bin/task-master list

# Show next task to work on
./node_modules/.bin/task-master next
```

## Benefits of Max Membership

With your Claude Code Max membership, you get:

- **Premium Models**: Access to `opus` and `sonnet` models
- **Higher Speed**: Faster response times for task generation
- **Better Performance**: 72.5% SWE Score for main tasks
- **No API Costs**: All models are free with your membership
- **Research Capabilities**: Advanced research with Perplexity integration

## Common Commands

### Task Management

```bash
# List all tasks
./node_modules/.bin/task-master list

# Show specific task
./node_modules/.bin/task-master show 1

# Show next task
./node_modules/.bin/task-master next

# Add new task
./node_modules/.bin/task-master add-task --prompt "Your task description"

# Update task status
./node_modules/.bin/task-master set-status --id=1 --status=done
```

### Task Expansion

```bash
# Expand task into subtasks
./node_modules/.bin/task-master expand --id=1 --research

# Expand all pending tasks
./node_modules/.bin/task-master expand --all --research
```

### Research and Analysis

```bash
# Research with project context
./node_modules/.bin/task-master research "Latest React Query v5 best practices"

# Analyze project complexity
./node_modules/.bin/task-master analyze-complexity --research

# View complexity report
./node_modules/.bin/task-master complexity-report
```

## Troubleshooting

### Claude Code Issues

```bash
# Reinstall Claude Code CLI
npm uninstall -g @anthropic-ai/claude-code
npm install -g @anthropic-ai/claude-code

# Verify authentication
claude auth status
```

### Task Master Issues

```bash
# Reinstall Task Master
npm uninstall task-master-ai
npm install task-master-ai

# Reset configuration
rm -rf .taskmaster/config.json
./node_modules/.bin/task-master init -y
```

### MCP Connection Issues

```bash
# Restart your IDE
# Check MCP configuration syntax
# Verify no API keys are set (Claude Code doesn't need them)
```

## Quick Setup Checklist

- [ ] Node.js v20.19.0+ installed
- [ ] Claude Code CLI installed and authenticated
- [ ] Task Master installed locally or globally
- [ ] Project initialized with `task-master init`
- [ ] Models configured for Max membership (opus/sonnet)
- [ ] MCP configuration created
- [ ] PRD created and parsed
- [ ] Initial tasks generated
- [ ] Test task creation successful

## File Structure

After setup, your project should have:

```
your-project/
├── .taskmaster/
│   ├── config.json          # Model configuration
│   ├── tasks/
│   │   └── tasks.json       # Generated tasks
│   └── templates/
│       └── example_prd.txt  # PRD template
├── .cursor/
│   └── mcp.json            # MCP configuration
├── scripts/
│   └── prd.txt             # Your PRD
├── package.json
└── TASK_MASTER_SETUP_GUIDE.md
```

## Support

- **GitHub Repository**: [claude-task-master](https://github.com/eyaltoledano/claude-task-master)
- **Documentation**: [task-master.dev](https://task-master.dev)
- **Claude Code Setup**: [Claude Code Documentation](https://github.com/eyaltoledano/claude-task-master/blob/main/docs/examples/claude-code-usage.md)

---

**Last Updated**: August 2025  
**Version**: Task Master v0.23.0  
**Claude Code**: v1.0.69+  
**Membership**: Max
