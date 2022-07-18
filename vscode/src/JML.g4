lexer grammar JML;

tokens {
	JML_INFORMAL
}

// Modifiers with occur in Java and are always highlighted.
JAVA_MODIFIERS:
	'abstract'
	| 'default'
	| 'final' 'native'
	| 'package'
	| 'private'
	| 'protected'
	| 'public'
	| 'static'
	| 'strictfp'
	| 'synchronized'
	| 'transient'
	| 'volatile';

// Keywords with occur in Java and are always highlighted.
JAVA_KEYWORDS:
	//'assert' |
	'boolean'
	| 'break'
	| 'byte'
	| 'case'
	| 'catch'
	| 'char'
	| 'class'
	| 'const'
	| 'continue'
	| 'void'
	| 'try'
	| 'while'
	| 'throw'
	| 'throws'
	//| 'synchronized'
	| 'switch'
	| 'short'
	| 'super'
	| 'this'
	| 'return'
	| 'new'
	| 'long'
	| 'interface'
	| 'instanceof'
	| 'import'
	| 'implements'
	| 'goto'
	| 'int'
	| 'if'
	| 'for'
	| 'float'
	| 'finally'
	| 'extends'
	| 'enum'
	| 'else'
	| 'do'
	| 'double'
	| 'true'
	| 'false'
	| 'null';

CHAR_LITERAL: '\'' (~['\\\r\n] | EscapeSequence) '\'';
STRING_LITERAL: '"' (~["\\\r\n] | EscapeSequence)* '"';

// Keywords of JML, that can not be an identifier!
JML_KEYWORDS_ALWAYS:
	'\\measured_by'
	| '\\such_that'
	| '\\lblpos'
	| '\\lblneg'
	| '\\forall'
	| '\\exists'
	| '\\by'
	| '\\declassifies'
	| '\\erases'
	| '\\new_objects';

JML_MODIFIERS:
	'non_null'
	| 'nullable'
	| 'unreachable'
	| 'pure'
	| 'strictly_pure'
	| 'helper'
	| 'nullable_by_default'
	| 'instance'
	| 'two_state'
	| 'no_state'
	| 'spec_public'
	| 'spec_private'
	| 'spect_package'
	| 'spec_protected';

JML_KEYWORDS_TL_EXPR: 'fsadfsdaf';

JML_KEYWORDS_TL:
	(
		'normal_'
		| 'exceptional_'
		| 'model_'
		| 'break_'
		| 'continue_'
		| 'return_'
	)? ('behavior' | 'behaviour')
	| 'also'
	| 'assert'
	| 'assume'
	| 'model'
	| 'invariant'
	| 'constraint'
	| 'initially'
	| 'axiom'
	| 'accessible'
	| 'assignable'
	| 'breaks'
	| 'continues'
	| ('decreasing' | 'decreases')
	| 'depends'
	| 'determines'
	| ('ensures' | 'post') '_free'? '_redundantly'?
	| 'loop_determines'
	| 'loop_separates'
	| 'model_method_axiom'
	| 'merge_params'
	| 'represents'
	| ('requires' | 'post') '_free'? '_redundantly'?
	| 'returns'
	| 'separates'
	| 'signals'
	| 'signals_only'
	| 'diverges'
	| 'set'
	| ('maintaining' | 'loop_invariant') '_free'?
	| 'ghost'
	| 'modifiable'
	| 'modifies'
	| 'measured_by';

NUM_LITERALS:
	('0' | [1-9] (Digits? | '_'+ Digits)) [lL]?
	| '0' [xX] [0-9a-fA-F] ([0-9a-fA-F_]* [0-9a-fA-F])? [lL]?
	| '0' '_'* [0-7] ([0-7_]* [0-7])? [lL]?
	| '0' [bB] [01] ([01_]* [01])? [lL]?
	| (Digits '.' Digits? | '.' Digits) ExponentPart? [fFdD]? Digits (
		ExponentPart [fFdD]?
		| [fFdD]
	)
	| '0' [xX] (HexDigits '.'? | HexDigits? '.' HexDigits) [pP] [+-]? Digits [fFdD]?;

// Separators

LPAREN: '(';
RPAREN: ')';
LBRACE: '{';
RBRACE: '}';
LBRACK: '[';
RBRACK: ']';
SEMI: ';';
COMMA: ',';
DOT: '.';

// Operators
ASSIGN: '=';
GT: '>';
LT: '<';
BANG: '!';
TILDE: '~';
QUESTION: '?';
COLON: ':';
EQUAL: '==';
LE: '<=';
GE: '>=';
NOTEQUAL: '!=';
AND: '&&';
OR: '||';
INC: '++';
DEC: '--';
ADD: '+';
SUB: '-';
MUL: '*';
DIV: '/';
BITAND: '&';
BITOR: '|';
CARET: '^';
MOD: '%';

ADD_ASSIGN: '+=';
SUB_ASSIGN: '-=';
MUL_ASSIGN: '*=';
DIV_ASSIGN: '/=';
AND_ASSIGN: '&=';
OR_ASSIGN: '|=';
XOR_ASSIGN: '^=';
MOD_ASSIGN: '%=';
LSHIFT_ASSIGN: '<<=';
RSHIFT_ASSIGN: '>>=';
URSHIFT_ASSIGN: '>>>=';

// Java 8 tokens

ARROW: '->';
COLONCOLON: '::';

DOTDOT: '..';
EQUIVALENCE: '<==>';
ANTIVALENCE: '<=!=>';
IMPLIES: '==>';
IMPLIESBACKWARD: '<==';
LOCKSET_LEQ: '<#=';
LOCKSET_LT: '<#';
ST: '<:';

// Additional symbols not defined in the lexical specification

AT: '@';
ELLIPSIS: '...';

// Whitespace and comments
WS: [ \t\r\n\u000C]+ -> skip; //channel(HIDDEN);

COMMENT_START: '/*' ~[@] -> pushMode(comment), more;
COMMENT: '//' ~[@] ~[\r\n]* -> channel(HIDDEN);

// Identifiers
IDENTIFIER: '\\'? JavaLetter JavaLetterOrDigit*;

// Fragments rules
fragment ExponentPart: [eE] [+-]? Digits;

// Escape Sequences for Character and String Literals

fragment EscapeSequence:
	'\\' [btnfr"'\\]
	| OctalEscape
	| UnicodeEscape;

fragment OctalEscape: '\\' ([0-3]? [0-7])? [0-7];

fragment UnicodeEscape:
	'\\' 'u' HexDigit HexDigit HexDigit HexDigit;

fragment HexDigits: HexDigit ((HexDigit | '_')* HexDigit)?;

fragment HexDigit: [0-9a-fA-F];

fragment Digits: [0-9] ([0-9_]* [0-9])?;

fragment JavaLetter:
	[a-zA-Z$_] // these are the "java letters" below 0x7F
	| // covers all characters above 0x7F which are not a surrogate
	~[\u0000-\u007F\uD800-\uDBFF]
	| // covers UTF-16 surrogate pairs encodings for U+10000 to U+10FFFF
	[\uD800-\uDBFF] [\uDC00-\uDFFF];

fragment JavaLetterOrDigit:
	[a-zA-Z0-9$_] // these are the "java letters or digits" below 0x7F
	| // covers all characters above 0x7F which are not a surrogate
	~[\u0000-\u007F\uD800-\uDBFF]
	| // covers UTF-16 surrogate pairs encodings for U+10000 to U+10FFFF
	[\uD800-\uDBFF] [\uDC00-\uDFFF];

ERROR_CHAR: .; //catch errors

mode comment;
COMMENT_END_COMMENT: '*/' -> popMode, type(COMMENT);
COMMENT_EVERY_CHAR: . -> more;

mode jmlComment;
JML_COMMENT_END: '*}' -> popMode, type(JML_INFORMAL);
JML_COMMENT_EVERY_CHAR: . -> channel(HIDDEN);