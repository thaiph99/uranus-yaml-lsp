
# Using with Neovim and lazy.nvim

This guide explains how to set up the Uranus YAML language server with Neovim using the `lazy.nvim` plugin manager.

## Prerequisites

- Neovim >= 0.8.0
- `lazy.nvim` installed
- `npm`

## Installation

1.  **Clone the repository:**

    ```bash
    git clone https://github.com/thaiph99/uranus-yaml-vscode.git
    ```

2.  **Install dependencies and compile the server:**

    ```bash
    cd uranus-yaml-vscode
    npm install
    npm run compile:vim
    ```

3.  **Add the following to your `lazy.nvim` configuration:**

    ```lua
    {
        'neovim/nvim-lspconfig',
        config = function()
            local lspconfig = require('lspconfig')
            lspconfig.uranus_yaml.setup {
                cmd = { "node", "/path/to/uranus-yaml-vscode/out/src/vim/server.js", "--stdio" },
                filetypes = { "yaml" },
            }
        end,
    }
    ```

    **Note:** Replace `/path/to/uranus-yaml-vscode` with the actual path to the cloned repository.

4.  **Restart Neovim and run `:LspInfo` to verify that the language server is attached to your YAML files.**

