.PHONY: help install build clean package test

help: ## Show this help message
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

install: ## Install all dependencies
	npm install
	npm install --workspaces

clean: ## Clean all build artifacts
	npm run clean

build: ## Build all packages
	npm run build:core
	npm run build:lsp
	npm run build:vscode

watch: ## Watch for changes and rebuild
	npm run watch

package: build ## Package for distribution
	npm run package:vscode
	npm run package:lsp

test: ## Run automated tests
	npm run test

dev-lsp: build ## Start LSP server in development mode
	cd packages/lsp-server && node dist/server.js

install-lsp: build ## Install LSP server globally for nvim
	cd packages/lsp-server && npm install -g .

setup-nvim: ## Show Neovim setup instructions
	@echo "Add this to your Neovim LSP config:"
	@echo ""
	@echo "require('lspconfig').uranus_yaml.setup {"
	@echo "  cmd = { 'uranus-yaml-lsp', '--stdio' },"
	@echo "  filetypes = { 'yaml', 'yml' },"
	@echo "  root_dir = require('lspconfig').util.root_pattern('.git', 'package.json'),"
	@echo "}"
	@echo ""
	@echo "Or add this custom setup:"
	@echo ""
	@echo "local lspconfig = require('lspconfig')"
	@echo "local configs = require('lspconfig.configs')"
	@echo ""
	@echo "if not configs.uranus_yaml then"
	@echo "  configs.uranus_yaml = {"
	@echo "    default_config = {"
	@echo "      cmd = { 'uranus-yaml-lsp', '--stdio' },"
	@echo "      filetypes = { 'yaml', 'yml' },"
	@echo "      root_dir = lspconfig.util.root_pattern('.git', 'package.json'),"
	@echo "      settings = {},"
	@echo "    },"
	@echo "  }"
	@echo "end"
	@echo ""
	@echo "lspconfig.uranus_yaml.setup{}"
