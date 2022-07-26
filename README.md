# vscode-jml 

VS Code extension for supporting the Java Modeling Language.

Available at [open-vsx.org](https://open-vsx.org/extension/wadoon/jml-vscode) and [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=wadoon.jml-vscode)


**Features**

* Syntax highlighting of JML contracts. 
 
  The highlighting is sensitive to the JML conditions. You set the current
  active keys by a comment `//-*- jml-keys: ...`.

* [Language server for JML](lsp/)
  
* Support for KeY files

  Syntax highlighting and snippets.


## TODO

* Make the language server available and downloadable on the fly.

## Changelog

* **0.3.0** (upcoming-2022)
  - Changing to `SemanticTokenProvider` interface to highlight JML annotation texts
  - preparation for using a language server for more language support
  
* **0.2.0** (04.04.2019)
  - Fixes by @csicar

* **0.1.0** (14.02.2019)
  - First release

* **0.0.0** (unpublished)
  - Start with the `java` language definition of VS Code.

## Authors

* @csicar
* @wadoon
