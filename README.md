# Telegram HTTP Request Bot (Deno)

A Telegram bot that stores and runs raw HTTP requests. Data is persisted with Deno KV.

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and get the token.
2. Set the token:
   ```bash
   export TELEGRAM_BOT_TOKEN=your_bot_token
   ```
3. Run (requires `--unstable-kv` for Deno KV):
   ```bash
   deno task start
   ```
   Or with watch: `deno task dev`

## Commands

| Command | Description |
|--------|-------------|
| `/start`, `/list`, or any other text | Show list of your saved requests |
| `/add <NAME_AS_ID> <CONTENT>` | Save a new HTTP request. `<CONTENT>` is a raw HTTP request (method, path, headers, optional body). |
| `/request_<NAME_OR_ID>` | Run the saved request and reply with the response (status + body, truncated to 4000 chars). |
| `/delete <NAME_OR_ID>` | Delete a saved request. |

## Adding a request

Send a message like:

```
/add locations GET /api/dms/query/bwt-aqua/locations?type=favorite&lat=50.42&lng=30.59 HTTP/1.1
Host: dms.ecosoft.ua
Content-Type: application/json
Authorization: Bearer your_token_here
```

The name is the first word after `/add`; the rest of the message (including newlines) is the full HTTP request. After saving, you can run it with `/request_locations`.

## Requirements

- Deno with `--unstable-kv` (for KV persistence).
- `TELEGRAM_BOT_TOKEN` environment variable.

## Tests

```bash
deno test main_test.ts
```
