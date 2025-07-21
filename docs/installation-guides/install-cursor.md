# Cursor Installation & GitHub MCP Setup Guide

## Overview

This guide provides step-by-step instructions for setting up Cursor IDE with GitHub MCP (Model Context Protocol) integration for the TAAXDOG-CODING project.

## Prerequisites

- macOS, Windows, or Linux
- Node.js (for MCP servers)
- GitHub account with access to TaaxDog organization
- Internet connection

## Part 1: Installing Cursor IDE

### Step 1: Download Cursor
1. Visit [cursor.com](https://cursor.com)
2. Download the appropriate version for your operating system
3. Install following the standard installation process

### Step 2: Initial Setup
1. Launch Cursor
2. Sign in with your preferred account (GitHub recommended)
3. Configure basic settings and preferences

## Part 2: GitHub MCP Integration Setup

### Step 1: Create GitHub Personal Access Token

1. **Navigate to GitHub Settings:**
   - Go to [github.com/settings/tokens](https://github.com/settings/tokens)
   - Click "Generate new token" → "Generate new token (classic)"

2. **Configure Token:**
   - **Name:** "Cursor MCP Access"
   - **Expiration:** 90 days (or longer)
   - **Scopes:** Select the following:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `read:org` (Read org and team membership)
     - ✅ `user` (Update ALL user data)

3. **Generate and Copy:**
   - Click "Generate token"
   - **Copy the token immediately** (starts with `ghp_`)
   - Store it securely - you won't see it again

### Step 2: Test Your Token

Verify your token works by running this command:

```bash
curl -H "Authorization: token YOUR_TOKEN_HERE" https://api.github.com/user
```

You should see your GitHub user information returned.

### Step 3: Configure Cursor MCP

1. **Open MCP Configuration File:**
   - **macOS/Linux:** `~/.cursor/mcp.json`
   - **Windows:** `%USERPROFILE%\.cursor\mcp.json`
   
   If the file doesn't exist, create it.

2. **Add GitHub MCP Configuration:**

```json
{
  "mcpServers": {
    "github-direct": {
      "type": "stdio",
      "command": "npx",
      "args": [
        "-y",
        "@modelcontextprotocol/server-github"
      ],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_GHP_TOKEN_HERE"
      }
    }
  }
}
```

3. **Replace Token:**
   - Replace `YOUR_GHP_TOKEN_HERE` with your actual GitHub token (starts with `ghp_`)

### Step 4: Restart Cursor

1. **Quit Cursor completely** (Cmd+Q on Mac, Alt+F4 on Windows)
2. **Wait 30 seconds**
3. **Reopen Cursor**
4. **Wait 3-5 minutes** for MCP to initialize

## Part 3: Verify GitHub Integration

### Step 1: Check Available Tools

In Cursor, you should now see GitHub MCP tools available:
- `mcp_github-direct_get_file_contents`
- `mcp_github-direct_search_repositories`
- `mcp_github-direct_list_commits`
- `mcp_github-direct_create_pull_request`
- And many more...

### Step 2: Test Repository Access

Ask Cursor to:
- "Show me files in the TaaxDog/TAAXDOG-CODING repository"
- "List recent commits in our repository"
- "Search for files containing 'auth' in our codebase"

## Part 4: Troubleshooting

### Common Issues

#### 1. GitHub Tools Not Available
**Problem:** MCP tools don't appear in Cursor
**Solution:**
- Verify MCP configuration file syntax
- Ensure token has correct permissions
- Restart Cursor completely
- Wait longer for MCP initialization (up to 5 minutes)

#### 2. Access Denied Errors
**Problem:** "Not Found" or "Permission Denied" errors
**Solution:**
- Verify GitHub token has `repo` scope
- Check token isn't expired
- Ensure you have access to TaaxDog organization
- Test token with curl command

#### 3. Token Format Issues
**Problem:** Integration not working despite correct setup
**Solution:**
- Ensure token starts with `ghp_` (classic token)
- Use classic tokens, not fine-grained tokens
- Regenerate token if unsure

### Alternative Integration: Smithery AI

If the direct GitHub integration doesn't work, you can try Smithery AI:

```bash
npx -y @smithery/cli@latest install @smithery-ai/github --client cursor --profile YOUR_PROFILE --key YOUR_KEY
```

## Part 5: Advanced Configuration

### Multiple Integrations

You can run multiple MCP servers simultaneously:

```json
{
  "mcpServers": {
    "github-direct": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "YOUR_TOKEN"
      }
    },
    "stripe": {
      "command": "node",
      "args": ["./node_modules/@stripe/mcp/dist/index.js", "--tools=all"],
      "cwd": "/path/to/your/project",
      "env": {
        "STRIPE_SECRET_KEY": "YOUR_STRIPE_KEY"
      }
    }
  }
}
```

### Security Best Practices

1. **Token Management:**
   - Use minimal required scopes
   - Set reasonable expiration dates
   - Rotate tokens regularly
   - Store tokens securely

2. **Access Control:**
   - Review organization permissions
   - Monitor token usage
   - Revoke unused tokens
   - Use separate tokens for different purposes

## Part 6: Usage Examples

### Common Commands

Once set up, you can ask Cursor to:

1. **Repository Operations:**
   - "Show me the structure of our repository"
   - "List all branches in TaaxDog/TAAXDOG-CODING"
   - "Find files modified in the last week"

2. **Code Analysis:**
   - "Search for all TypeScript files in the components directory"
   - "Show me the latest commits to the main branch"
   - "Find all files that import React"

3. **Development Tasks:**
   - "Create a new branch for my feature"
   - "Open a pull request for my changes"
   - "Review recent changes in the codebase"

## Support

### Getting Help

1. **Cursor Documentation:** [cursor.com/docs](https://cursor.com/docs)
2. **MCP Documentation:** [modelcontextprotocol.io](https://modelcontextprotocol.io)
3. **GitHub API Docs:** [docs.github.com/rest](https://docs.github.com/rest)

### Project-Specific Issues

For TAAXDOG-CODING project issues:
1. Check existing documentation in `docs/`
2. Review project README.md
3. Consult with team members
4. Create GitHub issues for bugs

## Conclusion

With Cursor and GitHub MCP properly configured, you now have:
- ✅ Direct access to your GitHub repositories
- ✅ AI-powered code assistance
- ✅ Seamless integration with your development workflow
- ✅ Enhanced productivity for the TAAXDOG project

The integration allows Cursor's AI to understand your codebase context and provide more relevant assistance for your specific project needs. 