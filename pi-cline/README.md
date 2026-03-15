# pi-cline

[![npm](https://badgen.net/npm/v/pi-cline)](https://www.npmjs.com/package/pi-cline)
[![cline](https://badgen.net/static/cline/2.7.0/gray)](https://cline.bot/)

Cline provider extension for [pi](https://github.com/badlogic/pi-mono).

Use [Cline](https://cline.bot/)'s models directly from pi through Cline's authenticated API flow. `pi-cline` works as a compatibility layer between pi and Cline:

- Builds Cline-style prompts and requests
- Parses Cline XML tool calls
- Maps them back into pi's runtime
- Currently exposes **free models only**

## Installation

```sh
pi install npm:pi-cline
```

## Authentication

1. Open pi and enter `/login`.
2. Select **Cline** from the provider list.
3. A browser window will open to the Cline login page — sign in with your Cline account.

## Prompt construction

Pi messages are repackaged into the structure Cline models expect.

- Injects Cline-style operating rules and runtime/system information
- Wraps user input into task or resumption form
- Appends environment details such as cwd, workspace snapshot, time, CLI tools, and context usage
- Feeds tool results back as the next-turn context
- Preserves turn state so later turns can continue with consistent tool semantics

## Tool mapping

| Cline tool | Pi runtime | Handling |
| --- | --- | --- |
| `read_file` | `read` | Direct mapping |
| `write_to_file` | `write` | Direct mapping |
| `replace_in_file` | `edit`, `write` | Single SEARCH/REPLACE block → `edit`, Otherwise apply diff and `write` |
| `execute_command` | `bash` | Direct mapping |
| `list_files` | `bash` | Converted into a `find` command |
| `search_files` | `bash` | Converted into an `rg` command |
| `list_code_definition_names` | `bash` | Converted into an `rg`-based definition scan |
| `attempt_completion` | final assistant text | Completion-only; no local tool call |
| `act_mode_respond`, `plan_mode_respond`, `ask_followup_question` | display-only | Preserved as prompt/display semantics |

## Optional tools

| Cline tool | If pi provides the same runtime tool | If pi does not provide it |
| --- | --- | --- |
| `use_mcp_tool` | Forward to runtime tool | Synthetic, no-op compatibility handling |
| `access_mcp_resource` | Forward to runtime tool | Synthetic, no-op compatibility handling |
| `browser_action` | Forward to runtime tool | Synthetic, no-op compatibility handling |
| `web_fetch`, `web_search` | Forward to runtime tool | Synthetic, no-op compatibility handling |
| `new_task`, `load_mcp_documentation` | Forward if available | Synthetic, no-op compatibility handling |

## Requirements

- `pi >= 0.49.0`
- A Cline account
- Network access to `https://api.cline.bot`

## License

MIT
