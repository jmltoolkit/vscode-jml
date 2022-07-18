// JML Semantic Tokenizer
import * as vscode from 'vscode';

import { CharStream, CharStreams, Token, CommonTokenStream } from 'antlr4ts';
import './JML';
import { JML } from './JML';


const tokenTypes = ['comment', 'variable', 'keyword', 'string', 'number', "jmlmodifier"];
const tokenModifiers = ['declaration', 'documentation'];
const legend = new vscode.SemanticTokensLegend(tokenTypes, tokenModifiers);

class JmlConditionalChecker {
  // currently activated keys 
  activeKeys: string[] = []


  //
  cache: Map<string, boolean> = new Map()

  /**
   * 
   * @param token 
   */
  isActive(token: Token): boolean {
    const text = token.text
    if (text) {
      const atSign = text.indexOf('@')
      const keys = text.trim().substring(2, atSign)
      const cachedValue = this.cache.get(keys)
      if (cachedValue !== undefined) {
        return cachedValue
      }

      const conditions = keys.split(/(?=[+-])/)
      const result = this.isActiveForConditions(conditions)
      this.cache.set(keys, result)
      return result
    }
    return false
  }

  isActiveForConditions(conditions: string[]): boolean {
    //a JML annotation with at least one positive-key is only included
    let plusKeyFound = false;
    //if at least one of these positive keys is enabled
    let enabledPlusKeyFound = false;

    //a JML annotation with an enabled negative-key is ignored (even if there are enabled positive-keys).
    let enabledNegativeKeyFound = false;

    for (let marker of conditions) {
      let isPositive = marker.charAt(0) == '+'
      let isNegative = !isPositive
      const k = marker.substring(1).toLowerCase()
      let isEnabled = this.activeKeys.some(x => (x == k))
      plusKeyFound = plusKeyFound || isPositive;
      enabledPlusKeyFound = enabledPlusKeyFound || isPositive && isEnabled;
      enabledNegativeKeyFound = enabledNegativeKeyFound || isNegative && isEnabled;
      if ("-" == marker || "+" == marker) { // old deprecated conditions
        return false;
      }
    }
    return (!plusKeyFound || enabledPlusKeyFound) && !enabledNegativeKeyFound;
  }

  /**
   * Given a JML_SET_KEY token, this method sets the active keys for deciding the inclusion of 
   * conditional JML annotation comments.
   */
  setKeysFromToken(token: Token) {
    //JML_SET_KEY: '//-*- jml-keys: ' (IDENTIFIER)* '-*-';
    const prefix = "//-*- jml-keys: "
    const suffix = ""//"-*-"
    const text = token.text
    if (text) {
      const content = text.substring(prefix.length, text.length - suffix.length)
      const keys = content.split(/[ ,]/)
      this.activeKeys = keys.map(k => k.trim().toLowerCase())
      this.cache.clear()
    }
  }
}

function analyzeJmlToken(
  document: vscode.TextDocument, token: Token, builder: vscode.SemanticTokensBuilder
) {
  if (token.text == undefined) return;
  //const prefix = "\n".repeat(token.line - 1) + " ".repeat(token.charPositionInLine - 1)
  const text = token.text
  const start = text.indexOf("@") + 1
  const chars = CharStreams.fromString(text.substring(start))
  const lexer = new JML(chars);
  /*does not work 
  lexer._tokenStartCharIndex = token.startIndex;
  lexer._tokenStartLine = token.line;
  lexer._tokenStartCharPositionInLine = token.charPositionInLine;
  */
  const offset = token.startIndex + start
  lexer._mode = JML.jmlMode
  const tokens = lexer.getAllTokens() //TODO change to lazy iteration

  var parenthesisLevel = 0
  var bracesLevel = 0
  var bracketLevel = 0
  var waitForToplevelSemicolon = false;

  let keys = []


  for (const token of tokens) {
    switch (token.type) {
      case JML.WS: continue
      case JML.LPAREN: parenthesisLevel++; continue
      case JML.RPAREN: parenthesisLevel--; continue
      case JML.LBRACE: bracesLevel++; continue
      case JML.RBRACE: bracesLevel--; continue
      case JML.LBRACE: bracketLevel++; continue
      case JML.RBRACE: bracketLevel--; continue
      case JML.SEMI:
        if (bracketLevel == 0 && bracesLevel == 0 && parenthesisLevel == 0)
          waitForToplevelSemicolon = false
        continue
    }

    const toplevel = !waitForToplevelSemicolon &&
      (bracketLevel == 0 && bracesLevel == 0 && parenthesisLevel == 0);

    //console.log(token, toplevel, lexer.vocabulary.getDisplayName(token.type))

    var type: string;
    switch (token.type) {
      case JML.JAVA_MODIFIERS:
        type = "jmlmodifier"; break;
      case JML.JML_KEYWORDS_ALWAYS:
      case JML.JAVA_KEYWORDS:
        type = "keyword"; break;
      case JML.JML_MODIFIERS:
        if (toplevel)
          type = "jmlmodifier"
        else
          type = 'variable';
        break;
      case JML.JML_KEYWORDS_TL_EXPR:
        if (toplevel) waitForToplevelSemicolon = true
      //FALLTHROUGH
      case JML.JML_KEYWORDS_TL:
        if (toplevel)
          type = "keyword";
        else
          type = 'variable';
        break;
      case JML.IDENTIFIER:
        type = 'variable'; break;
      case JML.NUM_LITERALS:
        type = 'number'; break;
      case JML.COMMENT: type = 'comment'; break;
      default:
        console.log(token, toplevel, lexer.vocabulary.getDisplayName(token.type))
        continue;
    }

    const mods: string[] = [];
    const range = new vscode.Range(
      document.positionAt(offset + token.startIndex),
      document.positionAt(offset + token.stopIndex + 1));
    builder.push(range, type, mods);
  }
}


const provider: vscode.DocumentSemanticTokensProvider = {
  provideDocumentSemanticTokens(document: vscode.TextDocument): vscode.ProviderResult<vscode.SemanticTokens> {
    // analyze the document and return semantic tokens

    const tokensBuilder = new vscode.SemanticTokensBuilder(legend);
    const text = document.getText()
    const chars = CharStreams.fromString(document.getText());
    const lexer = new JML(chars);
    const conditionalChecker = new JmlConditionalChecker()

    for (const token of lexer.getAllTokens()) {
      if (token.type == JML.JML_SET_KEY) {
        console.log(token)
        conditionalChecker.setKeysFromToken(token)
        continue
      }
      if (token.type == JML.JML_COMMENT && conditionalChecker.isActive(token)) {
        analyzeJmlToken(document, token, tokensBuilder);
      }
    }

    return tokensBuilder.build();
  }
};

export function activateSemanticTokensProvider(): vscode.Disposable {
  // register for all Java documents from the local file system
  const selector = { language: 'java', scheme: 'file' };
  return vscode.languages.registerDocumentSemanticTokensProvider(selector, provider, legend);
}