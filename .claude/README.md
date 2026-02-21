# Claude Code Configuration

This directory contains project-specific configuration for Claude Code.

## MCP (Model Context Protocol) Setup

MCP configurations are kept local to prevent cross-project contamination and to keep secrets secure.

### Initial Setup

1. Copy the example MCP configuration:
   ```bash
   cp .claude/mcp.json.example .claude/mcp.json
   ```

2. Edit `.claude/mcp.json` and replace the placeholders:
   - `YOUR_SUPABASE_PROJECT_REF` - Your Supabase project reference ID
   - `YOUR_SUPABASE_ACCESS_TOKEN` - Your Supabase access token

3. If using VS Code, also set up:
   ```bash
   cp .vscode/mcp.json.example .vscode/mcp.json
   ```
   And update the placeholders in `.vscode/mcp.json` with the same values.

### Finding Your Credentials

- **Project Ref**: Found in your `.env` file as `VITE_SUPABASE_URL` (the subdomain before `.supabase.co`)
- **Access Token**: Generate from [Supabase Dashboard](https://supabase.com/dashboard) → Settings → Access Tokens

### Security

**IMPORTANT:** Never commit `mcp.json` or `settings.local.json` files to git. These files contain secrets and are already in `.gitignore`.

Only commit the `.example` files to help other developers set up their environment.

## Files in This Directory

- `mcp.json` - **Local only** - Your MCP server configurations with secrets
- `mcp.json.example` - **Committed** - Template for setting up MCP
- `settings.local.json` - **Local only** - Your local Claude Code settings
- `README.md` - **Committed** - This file
