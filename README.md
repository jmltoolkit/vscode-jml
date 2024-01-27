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

 

## Authors

* @csicar
* @wadoon
