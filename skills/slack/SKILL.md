---
name: slack
description: Use when you need to control Slack from OpenClaw via the slack tool, including reacting to messages or pinning/unpinning items in Slack channels or DMs.
metadata: { 
  "openclaw": { 
    "emoji": "💬", 
    "requires": { "config": ["channels.slack"] },
    "features": {
      "messageThreading": {
        "description": "Automatically create sessions for messages in specified channels",
        "status": "experimental"
      }
    }
  } 
}
---

# Slack Actions

## Overview

Use `slack` to react, manage pins, send/edit/delete messages, and fetch member info. The tool uses the bot token configured for OpenClaw.

## Message Threading Feature (NEW)

### Configuration

Add to `openclaw.json`:

```json
{
  "slack": {
    "messageThreading": {
      "enabledChannels": ["C0ACJK1A7H8"],
      "retentionDays": 90,
      "createThreads": true
    }
  }
}
```

### How It Works
- Automatically create a session for each message in specified channels
- Generate unique session identifier
- Store message context for later retrieval
- Optional: Create threaded replies with context summaries

## Existing Actions (Unchanged)

[... rest of the previous SKILL.md content remains the same ...]

## Changelog
- 2026-02-07: Added experimental message threading feature