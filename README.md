# vscode-jml 

VS Code extension for supporting the Java Modeling Language.

Available at [Visual Studio Marketplace
![](https://img.shields.io/visual-studio-marketplace/v/wadoon.jml-vscode?style=flat-square)](https://marketplace.visualstudio.com/items?itemName=wadoon.jml-vscode)
and [open-vsx.org ![](https://img.shields.io/open-vsx/v/wadoon/jml-vscode?style=flat-square)](https://open-vsx.org/extension/wadoon/jml-vscode)

## Features

### Syntax highlighting of JML specification

This extensions enables syntax highlighting of JML annotation texts inside Java
files. A JML annotation text is encapsulate into comments, that starts with an
at-sign `@`. Additionally before the `@`, you can also add a list of conditions
(identifiers prefixed with `+` or `-`) to activate or deactivate a JML
annotation for a specific tool.

The highlighting is sensitive to the JML conditions. You set the current active
keys by a comment `//-*- jml-keys: ...`.

![](.images/syntaxhightlight.png)

### Language Server for JML 

This project provides a language server on top of the [jmlparser
project](https://github.com/wadoon/jmlparser). The language server supports
following requests:

* Code Outline (`documentSymbols`)

* Error reporting (``)

* Code Actions
  * [ ] Check well-definedness (requires z3)
  * [ ] Normalise formula
  * [ ] ...

* Code Lenses
  * [ ] Prove refinment of contracts
  * [ ] 

* Snippets

* Support for [KeY files](https://key-project.org/)

  Syntax highlighting and snippets.

 

## Configuration

All settings are under the `jmltk` namespace. Access via VS Code Settings (`Ctrl+,` or `Cmd+,`).

| Setting | Default | Description |
|---------|---------|-------------|
| `jmltk.lspDisabled` | `false` | If true, disables the language server |
| `jmltk.javaHome` | `null` | Path to JRE/JDK installation (auto-detected if not set) |
| `jmltk.javaPath` | `"java"` | Full path to Java executable |
| `jmltk.jarFile` | `null` | Path to LSP jar file (auto-downloads if not set) |
| `jmltk.githubOwner` | `"wadoon"` | GitHub owner for LSP downloads |
| `jmltk.githubRepo` | `"jml-lsp"` | GitHub repository for LSP downloads |
| `jmltk.assetPattern` | `".*\.jar"` | Regex pattern for matching jar assets |

## Development

### Prerequisites

- Node.js 18+ 
- npm
- Java JDK/JRE (for running the LSP)

### Build & Run

```bash
# Install dependencies
npm install

# Build the extension
npm run esbuild

# Run TypeScript compiler
npm run compile
```

### Debugging / Running Locally

Press `F5` in VS Code to launch the Extension Development Host with the extension loaded.

Alternatively, use the pre-configured launch configurations (press `Ctrl+Shift+D` or `Cmd+Shift+D`):

- **Run Extension** - Launches the extension in a new VS Code window
- **Extension Tests** - Runs integration tests in a new VS Code window  
- **Unit Tests (Mocha)** - Runs unit tests in the terminal
- **Debug Tests** - Runs unit tests with debugger attached

### Running Tests

```bash
# Run all tests (requires VS Code)
npm test

# Run unit tests only (no VS Code required)
npx mocha -r ts-node/register src/test/suite/**/*.test.ts
```

### Available Tasks (Ctrl+Shift+B or Cmd+Shift+B)

- **Build Extension** - Default build task (esbuild)
- **Compile TypeScript** - Compile TS to JS
- **Run Tests** - Run integration tests
- **Run Unit Tests** - Run unit tests directly
- **Lint** - Run ESLint
- **Watch Build** - Watch mode for development
- **Package Extension** - Create .vsix package

### Publishing

```bash
# Package the extension
npm run package

# Publish to VS Code Marketplace
npx vsce publish

# Publish to Open VSX Registry
npx ovsx publish
```

## Authors

* @csicar
* @wadoon
