import { CharStreams, CommonTokenStream, Token } from "antlr4ts";
import { DocumentSemanticTokensProvider, Range, ExtensionContext, languages, ProviderResult, SemanticTokens, SemanticTokensBuilder, SemanticTokensLegend, TextDocument } from "vscode";
import { Key } from "./Key";


const tokenTypes = ['comment', 'variable', 'keyword', 'string', 'number'];
const tokenModifiers = ['declaration', 'documentation'];
const legend = new SemanticTokensLegend(tokenTypes, tokenModifiers);

const tokenTypesTable: Map<string, number> = new Map()
tokenTypes.forEach((v, idx) => tokenModifiers[v] == idx)

function translateTokenType(type: number): string {
    let stype: string = ""
    switch (type) {
        case Key.COMMENT:
        case Key.ML_COMMENT:
        case Key.SL_COMMENT:
        case Key.DOC_COMMENT:
            stype = "comment"; break;
        case Key.IDENT: stype = "variable"; break;
        case Key.SORTS:
        case Key.GENERIC:
        case Key.PROXY:
        case Key.EXTENDS:
        case Key.ONEOF:
        case Key.ABSTRACT:
        case Key.SCHEMAVARIABLES:
        case Key.SCHEMAVAR:
        case Key.MODALOPERATOR:
        case Key.PROGRAM:
        case Key.FORMULA:
        case Key.TERM:
        case Key.UPDATE:
        case Key.VARIABLES:
        case Key.VARIABLE:
        case Key.SKOLEMTERM:
        case Key.SKOLEMFORMULA:
        case Key.TERMLABEL:
        case Key.MODIFIES:
        case Key.PROGRAMVARIABLES:
        case Key.STORE_TERM_IN:
        case Key.STORE_STMT_IN:
        case Key.HAS_INVARIANT:
        case Key.GET_INVARIANT:
        case Key.GET_FREE_INVARIANT:
        case Key.GET_VARIANT:
        case Key.IS_LABELED:

        case Key.SAME_OBSERVER:
        case Key.VARCOND:
        case Key.APPLY_UPDATE_ON_RIGID:
        case Key.DEPENDINGON:
        case Key.DISJOINTMODULONULL:
        case Key.DROP_EFFECTLESS_ELEMENTARIES:
        case Key.DROP_EFFECTLESS_STORES:
        case Key.SIMPLIFY_IF_THEN_ELSE_UPDATE:
        case Key.ENUM_CONST:
        case Key.FREELABELIN:
        case Key.HASSORT:
        case Key.FIELDTYPE:
        case Key.FINAL:
        case Key.ELEMSORT:
        case Key.HASLABEL:
        case Key.HASSUBFORMULAS:
        case Key.ISARRAY:
        case Key.ISARRAYLENGTH:
        case Key.ISCONSTANT:
        case Key.ISENUMTYPE:
        case Key.ISINDUCTVAR:
        case Key.ISLOCALVARIABLE:
        case Key.ISOBSERVER:
        case Key.DIFFERENT:
        case Key.METADISJOINT:
        case Key.ISTHISREFERENCE:
        case Key.DIFFERENTFIELDS:
        case Key.ISREFERENCE:
        case Key.ISREFERENCEARRAY:
        case Key.ISSTATICFIELD:
        case Key.ISINSTRICTFP:
        case Key.ISSUBTYPE:
        case Key.EQUAL_UNIQUE:
        case Key.NEW:
        case Key.NEW_TYPE_OF:
        case Key.NEW_DEPENDING_ON:
        case Key.HAS_ELEMENTARY_SORT:
        case Key.NEWLABEL:
        case Key.CONTAINS_ASSIGNMENT:
        case Key.NOT_:
        case Key.NOTFREEIN:
        case Key.SAME:
        case Key.STATIC:
        case Key.STATICMETHODREFERENCE:
        case Key.MAXEXPANDMETHOD:
        case Key.STRICT:
        case Key.TYPEOF:
        case Key.INSTANTIATE_GENERIC:
        case Key.FORALL:
        case Key.EXISTS:
        case Key.SUBST:
        case Key.IF:
        case Key.IFEX:
        case Key.THEN:
        case Key.ELSE:
        case Key.INCLUDE:
        case Key.INCLUDELDTS:
        case Key.CLASSPATH:
        case Key.BOOTCLASSPATH:
        case Key.NODEFAULTCLASSES:
        case Key.JAVASOURCE:
        case Key.WITHOPTIONS:
        case Key.OPTIONSDECL:
        case Key.KEYSETTINGS:
        case Key.PROFILE:
        case Key.TRUE:
        case Key.FALSE:
        case Key.SAMEUPDATELEVEL:
        case Key.INSEQUENTSTATE:
        case Key.ANTECEDENTPOLARITY:
        case Key.SUCCEDENTPOLARITY:
        case Key.CLOSEGOAL:
        case Key.HEURISTICSDECL:
        case Key.NONINTERACTIVE:
        case Key.DISPLAYNAME:
        case Key.HELPTEXT:
        case Key.REPLACEWITH:
        case Key.ADDRULES:
        case Key.ADDPROGVARS:
        case Key.HEURISTICS:
        case Key.FIND:
        case Key.ADD:
        case Key.ASSUMES:
        case Key.TRIGGER:
        case Key.AVOID:

        case Key.PREDICATES:
        case Key.FUNCTIONS:
        case Key.TRANSFORMERS:
        case Key.UNIQUE:

        case Key.RULES:
        case Key.AXIOMS:
        case Key.PROBLEM:
        case Key.CHOOSECONTRACT:
        case Key.PROOFOBLIGATION:
        case Key.PROOF:
        case Key.PROOFSCRIPT:
        case Key.CONTRACTS:
        case Key.INVARIANTS:
        case Key.LEMMA:
        case Key.IN_TYPE:
        case Key.IS_ABSTRACT_OR_INTERFACE:
        case Key.CONTAINERTYPE:
        case Key.UTF_PRECEDES:
        case Key.UTF_IN:
        case Key.UTF_EMPTY:
        case Key.UTF_UNION:
        case Key.UTF_INTERSECT:
        case Key.UTF_SUBSET:
        case Key.UTF_SETMINUS:
            stype = 'keyword'
            break
        case Key.CHAR_LITERAL:
        case Key.STRING_LITERAL:
            stype = "string"
            break;
        case Key.INT_LITERAL:
            stype = 'number';
        default:
            break;
    }
    return stype
}


const provider: DocumentSemanticTokensProvider = {
    provideDocumentSemanticTokens(document: TextDocument): ProviderResult<SemanticTokens> {
        // analyze the document and return semantic tokens
        const tokensBuilder = new SemanticTokensBuilder(legend);
        const text = document.getText()
        const chars = CharStreams.fromString(document.getText());
        const lexer = new Key(chars);

        const stream = new CommonTokenStream(lexer)
        let tok: Token;
        let type: number;
        do {
            let abort = false
            type = stream.LA(1);
            tok = stream.LT(1);

            if (type == Key.EOF) {
                break
            }

            if (type == Key.ERROR_CHAR) {
                stream.consume()
                continue
            }

            if (type == Key.INT_LITERAL) {//rewrite INT_LITERALs to identifier when preceeded by an '('
                const MAX_K = 10;
                for (let k = 1; k <= MAX_K; k++) {
                    let codePoint = String.fromCharCode(this._input.LA(k));
                    if (codePoint == ' ' || codePoint == '\n' ||
                        codePoint == '\r' || codePoint == '\t') continue;
                    if (codePoint == '(')
                        type = Key.IDENT
                    break;
                }
            }

            if (type == Key.PROOF) {
                abort = true;
            }

            let stype = translateTokenType(type)
            if (stype != "") {
                const range = new Range(
                    document.positionAt(tok.startIndex),
                    document.positionAt(tok.stopIndex + 1));
                tokensBuilder.push(range, stype);
            }
            stream.consume()
            if (abort) return;
        } while (type != Key.EOF)
        return tokensBuilder.build();
    }
};


export function activateKeyLangage(context: ExtensionContext) {
    const selector = { language: 'key', scheme: 'file' };
    const disposable = languages.registerDocumentSemanticTokensProvider(selector, provider, legend);
    context.subscriptions.push(disposable);
}
