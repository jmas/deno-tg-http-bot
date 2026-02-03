# Telegram HTTP Request Bot (Deno)

A Telegram bot that stores and runs raw HTTP requests. Data is persisted with Deno KV.

## Setup

1. Create a bot with [@BotFather](https://t.me/BotFather) and get the token.
2. Set the token:
   ```bash
   export TELEGRAM_BOT_TOKEN=your_bot_token
   ```
3. Run the server so it is reachable by Telegram (e.g. on a VPS or behind ngrok). It listens on `PORT` (default 8080). Use HTTPS in production; Telegram requires it for webhooks.
4. Register the webhook **once** (use the public URL Telegram will POST to). Either call the server URL:
   - **GET** `https://your-domain.com/set-webhook?url=https://your-domain.com`
   - **POST** to `/set-webhook` with body `{"url":"https://your-domain.com"}`
   - Or set `WEBHOOK_URL` and run `deno task set-webhook`, or call `/set-webhook` with no params (uses `WEBHOOK_URL` env).
5. Start the server (tasks use `--unstable-kv` for Deno KV):
   ```bash
   deno task start
   ```
   Or with watch: `deno task dev`

Telegram sends each update as a POST to your webhook URL; the server processes it and replies to the user. No long-running polling.

## Commands

| Command | Description |
|--------|-------------|
| `/start`, `/list`, or any other text | Show list of your saved requests (subscribed ones are marked). |
| `/add <NAME_AS_ID> <CONTENT>` | Save a new HTTP request. `<CONTENT>` is a raw HTTP request (method, path, headers, optional body). |
| `/request_<NAME_OR_ID>` | Run the saved request and reply with the response (status + body, truncated to 4000 chars). |
| `/subscribe_<NAME_OR_ID>` | Subscribe to change notifications for this request. When the HTTP response changes (checked every time `/cron` runs), you get a Telegram message. |
| `/unsubscribe_<NAME_OR_ID>` | Stop change notifications for this request. |
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

## Cron (change notifications)

Configure an external cron job (e.g. every 5 minutes) to call:

- **GET or POST** `https://your-domain.com/cron`

The server will run all subscribed requests, compare responses to the last run, and send a Telegram message to each subscriber when the response changed.

Optional: set `CRON_SECRET` and pass it so only your cron service can trigger checks:

- **GET** `https://your-domain.com/cron?secret=your_secret`
- **Header** `X-Cron-Secret: your_secret`

## Requirements

- Deno with `--unstable-kv` (for KV persistence).
- `TELEGRAM_BOT_TOKEN` environment variable.
- For webhook: a public HTTPS URL and one-time `set-webhook` (see above).

## Tests

```bash
deno test main_test.ts
```
