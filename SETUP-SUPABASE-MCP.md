# Setting Up Supabase MCP

## What is Supabase MCP?

MCP (Model Context Protocol) allows AI assistants to interact with Supabase directly. With Supabase MCP, I could:
- Run SQL migrations automatically
- Query your database
- Manage tables and policies
- All without you copying/pasting SQL

## Current Status

❌ Supabase MCP is **not currently configured** in your Cursor workspace.

## How to Set It Up

### Step 1: Install Supabase MCP Server

```bash
# Install globally via npm
npm install -g @supabase/mcp-server

# Or via Cursor's MCP settings
# (Check Cursor > Settings > MCP Servers)
```

### Step 2: Configure MCP in Cursor

Add to your Cursor MCP configuration file:

**Location:** `~/.cursor/mcp.json` (or Cursor Settings > MCP)

```json
{
  "mcpServers": {
    "supabase": {
      "command": "npx",
      "args": [
        "-y",
        "@supabase/mcp-server"
      ],
      "env": {
        "SUPABASE_URL": "https://dxqglotcyirxzyqaxqln.supabase.co",
        "SUPABASE_SERVICE_ROLE_KEY": "your-service-role-key-here"
      }
    }
  }
}
```

### Step 3: Restart Cursor

After adding the configuration, restart Cursor for changes to take effect.

### Step 4: Verify

After restart, I'll be able to see Supabase MCP resources and can:
- List tables
- Run SQL migrations
- Query data
- Manage schemas

## Security Note

⚠️ **Never commit your service role key to git!**

The service role key gives full admin access to your database. Keep it in:
- Environment variables
- Cursor settings (not in project files)
- Secure password manager

## Alternative: Just Use SQL Editor

Honestly, for most tasks, using Supabase's SQL Editor is simpler:
- ✅ No setup needed
- ✅ Visual query builder
- ✅ Syntax highlighting
- ✅ Query history
- ✅ Direct database access

**Recommendation:** Stick with SQL Editor for now, set up MCP later if needed.

---

## For This Migration

Just use the SQL Editor method described in `RUN-THIS-MIGRATION.md`. It's faster and doesn't require MCP setup.

**Steps:**
1. Open: https://supabase.com/dashboard/project/dxqglotcyirxzyqaxqln/sql/new
2. Copy: `migrations/003-fix-beta-signups-schema.sql`
3. Paste and Run

Done! 🎉
