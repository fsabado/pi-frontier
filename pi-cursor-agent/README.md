# pi-cursor-agent

[![npm](https://badgen.net/npm/v/pi-cursor-agent)](https://www.npmjs.com/package/pi-cursor-agent)
[![cursor-cli](https://badgen.net/static/cursor-cli/2026.01.17-d239e66/gray)](https://cursor.com/cli)

![terminal](./assets/terminal.avif)

Cursor Agent provider extension for [pi](https://github.com/badlogic/pi-mono).

Use [Cursor](https://cursor.com/)'s AI models directly from pi with your existing Cursor subscription. Supports Claude, GPT, Gemini, Grok, Composer, and Kimi models — including thinking/reasoning variants.

## Models

The following models are available through the Cursor Agent provider. Canonical Model IDs are used in pi, while Cursor Model IDs are the internal identifiers used by the Cursor API. Model families with multiple Cursor reasoning variants automatically switch to the appropriate Cursor model ID based on the configured thinking level.

| Canonical Model ID | Cursor Model ID | Name |
| --- | --- | --- |
| `claude-sonnet-4-5` | `claude-4.5-sonnet`, `claude-4.5-sonnet-thinking` | Claude 4.5 Sonnet (Cursor) |
| `claude-sonnet-4-6` | `claude-4.6-sonnet-medium`, `claude-4.6-sonnet-medium-thinking` | Claude 4.6 Sonnet (Cursor) |
| `claude-opus-4-5` | `claude-4.5-opus-high`, `claude-4.5-opus-high-thinking` | Claude 4.5 Opus (Cursor) |
| `claude-opus-4-6` | `claude-4.6-opus-high`, `claude-4.6-opus-high-thinking` | Claude 4.6 Opus (Cursor) |
| `gpt-5.1` | `gpt-5.1`, `gpt-5.1-low`, `gpt-5.1-high` | GPT-5.1 (Cursor) |
| `gpt-5.1-codex-max` | `gpt-5.1-codex-max`, `gpt-5.1-codex-max-high` | GPT-5.1 Codex Max (Cursor) |
| `gpt-5.1-codex-mini` | `gpt-5.1-codex-mini` | GPT-5.1 Codex Mini (Cursor) |
| `gpt-5.2` | `gpt-5.2`, `gpt-5.2-high` | GPT-5.2 (Cursor) |
| `gpt-5.2-codex` | `gpt-5.2-codex`, `gpt-5.2-codex-low`, `gpt-5.2-codex-high`, `gpt-5.2-codex-xhigh` | GPT-5.2 Codex (Cursor) |
| `gpt-5.2-codex-fast` | `gpt-5.2-codex-fast`, `gpt-5.2-codex-low-fast`, `gpt-5.2-codex-high-fast`, `gpt-5.2-codex-xhigh-fast` | GPT-5.2 Codex Fast (Cursor) |
| `gpt-5.3-codex` | `gpt-5.3-codex`, `gpt-5.3-codex-low`, `gpt-5.3-codex-high`, `gpt-5.3-codex-xhigh` | GPT-5.3 Codex (Cursor) |
| `gpt-5.3-codex-fast` | `gpt-5.3-codex-fast`, `gpt-5.3-codex-low-fast`, `gpt-5.3-codex-high-fast`, `gpt-5.3-codex-xhigh-fast` | GPT-5.3 Codex Fast (Cursor) |
| `gpt-5.3-codex-spark` | `gpt-5.3-codex-spark-preview` | GPT-5.3 Codex Spark (Cursor) |
| `gpt-5.4` | `gpt-5.4-medium`, `gpt-5.4-low`, `gpt-5.4-high`, `gpt-5.4-xhigh` | GPT-5.4 (Cursor) |
| `gpt-5.4-fast` | `gpt-5.4-medium-fast`, `gpt-5.4-high-fast`, `gpt-5.4-xhigh-fast` | GPT-5.4 Fast (Cursor) |
| `gemini-3-pro-preview` | `gemini-3-pro` | Gemini 3 Pro (Cursor) |
| `gemini-3-flash-preview` | `gemini-3-flash` | Gemini 3 Flash (Cursor) |
| `gemini-3.1-pro-preview` | `gemini-3.1-pro` | Gemini 3.1 Pro (Cursor) |
| `grok-code-fast-1` | `grok-code-fast-1` | Grok Code (Cursor) |
| `composer-1` | `composer-1` | Composer 1 (Cursor) |
| `composer-1.5` | `composer-1.5` | Composer 1.5 (Cursor) |
| `kimi-k2.5` | `kimi-k2.5` | Kimi K2.5 (Cursor) |

## Installation

```sh
pi install npm:pi-cursor-agent
```

## Authentication

1. Open pi and enter `/login`.
2. Select **Cursor Agent** from the provider list.
3. A browser window will open to the Cursor login page — sign in with your Cursor account.

## Requirements

- `pi >= 0.52.10`
- Cursor subscription

## License

MIT
