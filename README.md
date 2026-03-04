# astral-mcp

MCP server providing headless browser tools via
[Astral](https://github.com/lino-levan/astral/)/CDP.

## Install

```sh
deno compile -A -o astral-mcp main.ts
```

Place the resulting binary somewhere on your `PATH`.

### Cross-compilation

Deno can produce binaries for other platforms via `--target`:

```sh
# Linux (x64)
deno compile -A --target x86_64-unknown-linux-gnu -o astral-mcp-linux-x64 main.ts

# Linux (ARM64)
deno compile -A --target aarch64-unknown-linux-gnu -o astral-mcp-linux-arm64 main.ts

# macOS (Apple Silicon)
deno compile -A --target aarch64-apple-darwin -o astral-mcp-macos-arm64 main.ts

# macOS (Intel)
deno compile -A --target x86_64-apple-darwin -o astral-mcp-macos-x64 main.ts

# Windows (x64)
deno compile -A --target x86_64-pc-windows-msvc -o astral-mcp-windows-x64.exe main.ts
```

## Configure

Add an entry to your Claude Code `settings.json`:

```json
{
  "mcpServers": {
    "astral-browser": {
      "command": "astral-mcp"
    }
  }
}
```

## Browser

On first launch Astral automatically downloads **Chrome for Testing** (~150 MB)
into a platform-specific cache directory:

| Platform | Cache path                                        |
| -------- | ------------------------------------------------- |
| macOS    | `~/Library/Caches/astral/`                        |
| Linux    | `~/.cache/astral/` (or `$XDG_CACHE_HOME/astral/`) |
| Windows  | `%LOCALAPPDATA%\astral\`                          |

### Environment variables

| Variable               | Purpose                                                                  |
| ---------------------- | ------------------------------------------------------------------------ |
| `ASTRAL_BIN_PATH`      | Skip the download and use a specific Chrome/Chromium binary              |
| `ASTRAL_QUIET_INSTALL` | Set to `1` to suppress download progress (auto-enabled when `CI` is set) |
| `ASTRAL_BIN_ARGS`      | Extra space-separated flags passed to the browser (e.g. `--no-sandbox`)  |

## Tools

32 tools across 10 categories:

### Navigation

| Tool         | Description                   |
| ------------ | ----------------------------- |
| `navigate`   | Navigate to a URL             |
| `reload`     | Reload the current page       |
| `go_back`    | Navigate to the previous page |
| `go_forward` | Navigate to the next page     |

### Pages

| Tool            | Description                                     |
| --------------- | ----------------------------------------------- |
| `get_page_info` | Get page URL, title, and viewport size          |
| `list_pages`    | List all open pages with IDs and active status  |
| `new_page`      | Open a new page, optionally navigating to a URL |
| `switch_page`   | Set the active page                             |
| `close_page`    | Close a page                                    |

### Content

| Tool         | Description                                 |
| ------------ | ------------------------------------------- |
| `get_html`   | Get HTML content of the page or an element  |
| `get_text`   | Get visible text content                    |
| `screenshot` | Take a screenshot of the page or an element |

### Interaction

| Tool        | Description                       |
| ----------- | --------------------------------- |
| `click`     | Click an element by CSS selector  |
| `type_text` | Type text into an input element   |
| `drag`      | Click and drag between two points |

### Query

| Tool               | Description                               |
| ------------------ | ----------------------------------------- |
| `element_at_point` | Find the element at given x,y coordinates |
| `query_selector`   | Find elements matching a CSS selector     |

### Styles

| Tool                  | Description                                        |
| --------------------- | -------------------------------------------------- |
| `get_computed_styles` | Get computed CSS styles for an element             |
| `get_pseudo_styles`   | Get `::before` and `::after` pseudo-element styles |
| `get_matched_styles`  | Get CSS cascade rules matching an element          |

### Configuration

| Tool             | Description                                               |
| ---------------- | --------------------------------------------------------- |
| `set_viewport`   | Set viewport dimensions                                   |
| `set_user_agent` | Override the User-Agent string                            |
| `emulate_media`  | Emulate CSS media features (color-scheme, reduced-motion) |
| `get_cookies`    | Get cookies for the current or specific URLs              |
| `set_cookies`    | Set cookies with domain/path scoping                      |
| `delete_cookies` | Delete cookies by name                                    |

### JavaScript

| Tool       | Description                            |
| ---------- | -------------------------------------- |
| `evaluate` | Execute JavaScript in the page context |

### Browser

| Tool            | Description                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------- |
| `browser_reset` | Kill the current browser and start a fresh instance. Optionally clear the Chrome cache to force a re-download. |

### Diagnostics

| Tool                     | Description                        |
| ------------------------ | ---------------------------------- |
| `get_accessibility_tree` | Get the accessibility tree         |
| `get_console_logs`       | Get captured console messages      |
| `get_page_errors`        | Get uncaught JavaScript errors     |
| `get_network_log`        | Get network requests and responses |

## Troubleshooting

If the browser is unresponsive or in a bad state, call the `browser_reset` tool.
Pass `clearCache: true` to also wipe the cached Chrome binary and re-download
it.

To manually clear the cache, delete the cache directory:

```sh
# macOS
rm -rf ~/Library/Caches/astral/

# Linux
rm -rf ~/.cache/astral/

# Windows (PowerShell)
Remove-Item -Recurse -Force "$env:LOCALAPPDATA\astral"
```

Astral will re-download Chrome on the next launch.

## Docker / CI

Point `ASTRAL_BIN_PATH` at a pre-installed Chromium and pass `--no-sandbox`:

```dockerfile
ENV ASTRAL_BIN_PATH=/usr/bin/chromium
ENV ASTRAL_BIN_ARGS="--no-sandbox"
```

Or let Astral download Chrome itself — the `CI` environment variable
automatically suppresses download progress output.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](LICENSE-APACHE) or
  <http://www.apache.org/licenses/LICENSE-2.0>)
- MIT license ([LICENSE-MIT](LICENSE-MIT) or
  <http://opensource.org/licenses/MIT>)

at your option.
