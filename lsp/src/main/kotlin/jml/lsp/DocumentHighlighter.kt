package jml.lsp

import com.github.javaparser.*
import com.github.javaparser.GeneratedJavaParserConstants.EOF
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range
import java.util.*
import java.util.regex.Pattern

enum class SupportedTokenTypes(val kind: String) {
    COMMENT(SemanticTokenTypes.Comment),
    VARIABLE(SemanticTokenTypes.Variable),
    KEYWORD(SemanticTokenTypes.Keyword),
    STRING(SemanticTokenTypes.String),
    NUMBER(SemanticTokenTypes.Number),
    MODIFIER(SemanticTokenTypes.Modifier),
}

enum class SupportedTokenModifier(val kind: String) {
    DECLARATION(SemanticTokenModifiers.Declaration),
    DOCUMENTATION(SemanticTokenModifiers.Documentation),
    DEPRECATED(SemanticTokenModifiers.Deprecated),
    STATIC(SemanticTokenModifiers.Static),
}

private val Token.asRange: Range
    get() = Range(Position(beginLine, beginColumn), Position(endLine, endColumn))

val tokenTypes = SupportedTokenTypes.entries.map { it.kind }
val tokenModifiers = SupportedTokenModifier.entries.map { it.kind }
val LEGEND: SemanticTokensLegend = SemanticTokensLegend(tokenTypes, tokenModifiers)


/*
    There are different ways how the position of a token can be expressed in a file.
    Absolute positions or relative positions. The protocol for the token format relative uses
    relative positions, because most tokens remain stable relative to each other when edits
    are made in a file. This simplifies the computation of a delta if a server supports it.
    So each token is represented using 5 integers. A specific token i in the file consists
    of the following array indices:

    at index 5*i - deltaLine: token line number, relative to the previous token
    at index 5*i+1 - deltaStart: token start character, relative to the previous token (relative to 0 or the previous
    token’s start if they are on the same line)
    at index 5*i+2 - length: the length of the token.
    at index 5*i+3 - tokenType: will be looked up in SemanticTokensLegend.tokenTypes. We currently ask that tokenType < 65536.
    at index 5*i+4 - tokenModifiers: each set bit will be looked up in SemanticTokensLegend.tokenModifiers

 */
data class SemanticTokensBuilder(val data: ArrayList<Int> = ArrayList(4096)) {
    var lastLineStart = 0
    var lastColumnStart = 0
    fun add(tok: Token, tokenType: Int, modifiers: Int) {
        data.ensureCapacity(data.size + 5)
        if (tok.beginLine != lastLineStart)
            lastColumnStart = 0

        data.add(tok.beginLine - lastLineStart)
        data.add(tok.beginColumn - lastColumnStart)
        data.add(tok.image.length)
        data.add(tokenType)
        data.add(modifiers)

        lastLineStart = tok.beginLine
        lastColumnStart = tok.beginColumn
    }
}

/**
 *
 * @author Alexander Weigl
 * @version 1 (13.01.24)
 */
class DocumentHighlighter {
    internal class StringConstructor {
        val buffer: java.lang.StringBuilder = java.lang.StringBuilder(10240)
        private var curLine = 1
        private var curColumn = 1

        fun append(value: String): StringConstructor {
            buffer.ensureCapacity(buffer.length + value.length + 1)
            val var2 = value.toCharArray()
            val var3 = var2.size

            for (var4 in 0 until var3) {
                val c = var2[var4]
                buffer.append(c)
                if (c == '\n') {
                    this.curColumn = 1
                    ++this.curLine
                } else {
                    ++this.curColumn
                }
            }

            return this
        }

        fun expandTo(line: Int, column: Int): StringConstructor {
            if (this.curLine <= line && (this.curLine != line || this.curColumn <= column)) {
                while (this.curLine < line) {
                    buffer.append("\n")
                    this.curColumn = 1
                    ++this.curLine
                }

                while (this.curColumn < column) {
                    buffer.append(" ")
                    ++this.curColumn
                }

                return this
            } else {
                throw IllegalArgumentException()
            }
        }

        override fun toString(): String {
            return buffer.toString()
        }
    }

    class JmlDocSanitizer(val enabledKeys: Set<String>) {
        @JvmOverloads
        fun asString(jmlDocs: List<Token>, emulateGlobalPosition: Boolean = true): String {
            if (jmlDocs.isEmpty()) {
                return ""
            } else {
                val s = StringConstructor()
                for (tok in jmlDocs) {
                    if (emulateGlobalPosition) {
                        s.expandTo(tok.beginLine, tok.beginColumn)
                    } else {
                        s.append("\n")
                    }
                    s.append(tok.image)
                }
                return this.toSanitizedString(s.buffer)
            }
        }

        fun toSanitizedString(s: StringBuilder): String {
            this.cleanComments(s)
            cleanAtSigns(s)
            return s.toString()
        }

        private fun cleanComments(s: StringBuilder) {
            var cur = 0
            while (cur < s.length - 1) {
                if (this.isJavaCommentStart(s, cur)) {
                    cur = if (this.isJmlComment(s, cur)) {
                        activateJmlComment(s, cur)
                    } else {
                        cleanComment(s, cur)
                    }
                }
                ++cur
            }
        }

        private fun cleanComment(s: StringBuilder, pos: Int): Int {
            val second = s[pos + 1]
            var end: Int
            end = if (second == '*') {
                s.indexOf("*/", pos + 2) + 2
            } else {
                s.indexOf("\n", pos + 2)
            }

            if (end == -1) {
                end = s.length
            }

            for (i in pos until end) {
                s.setCharAt(i, ' ')
            }

            return end
        }

        private fun activateJmlComment(s: StringBuilder, pos: Int): Int {
            val blockComment = s[pos] == '/' && s[pos + 1] == '*'
            var i: Int
            if (blockComment) {
                i = s.indexOf("*/", pos)
                if (i >= 0) {
                    s.setCharAt(i, ' ')
                    s.setCharAt(i + 1, ' ')
                }
            }

            i = pos
            while (i < s.length) {
                val point = s[i]
                s.setCharAt(i, ' ')
                if (point == '@') {
                    return i
                }
                ++i
            }

            return s.length
        }

        private fun isJmlComment(s: StringBuilder, pos: Int): Boolean {
            val posAt = s.indexOf("@", pos + 2)
            if (posAt < 0) {
                return false
            } else {
                for (i in pos + 2 until posAt) {
                    val point = s[i].code
                    if (!Character.isJavaIdentifierPart(point) && point != '-'.code && point != '+'.code) {
                        return false
                    }
                }

                if (pos + 2 == posAt) {
                    return true
                } else {
                    val keys = splitTags(s.substring(pos + 2, posAt))
                    return this.isActiveJmlSpec(keys)
                }
            }
        }

        private fun isJavaCommentStart(s: StringBuilder, pos: Int): Boolean {
            return s[pos] == '/' && (s[pos + 1] == '*' || s[pos + 1] == '/')
        }

        fun isActiveJmlSpec(keys: Array<String>): Boolean {
            return isActiveJmlSpec(this.enabledKeys, keys)
        }

        companion object {
            private val tag: Pattern = Pattern.compile("(?=[+-])")

            private fun cleanAtSigns(s: StringBuilder) {
                var pos = 0
                while (pos < s.length) {
                    val cur = s[pos]
                    if (cur == '\n') {
                        ++pos

                        while (pos < s.length && Character.isWhitespace(s[pos])) {
                            ++pos
                        }

                        while (pos < s.length) {
                            if ('@' == s[pos]) {
                                s.setCharAt(pos, ' ')
                            }
                            ++pos
                        }
                    }
                    ++pos
                }
            }

            private fun splitTags(substring: String): Array<String> {
                return tag.split(substring)
            }

            fun isActiveJmlSpec(activeKeys: Collection<String>, keys: Array<String>): Boolean {
                if (keys.size == 0) {
                    return true
                } else {
                    var plusKeyFound = false
                    var enabledPlusKeyFound = false
                    var enabledNegativeKeyFound = false
                    val var5 = keys
                    val var6 = keys.size

                    for (var7 in 0 until var6) {
                        val marker = var5[var7]
                        if (!marker.isEmpty()) {
                            plusKeyFound = plusKeyFound || isPositive(marker)
                            enabledPlusKeyFound =
                                enabledPlusKeyFound || isPositive(marker) && isEnabled(activeKeys, marker)
                            enabledNegativeKeyFound =
                                enabledNegativeKeyFound || isNegative(marker) && isEnabled(activeKeys, marker)
                            if ("-" == marker || "+" == marker) {
                                return false
                            }
                        }
                    }

                    return (!plusKeyFound || enabledPlusKeyFound) && !enabledNegativeKeyFound
                }
            }

            private fun isNegative(marker: String): Boolean {
                return marker[0] == '-'
            }

            private fun isEnabled(enabledKeys: Collection<String>, marker: String): Boolean {
                return enabledKeys.contains(marker.substring(1).lowercase(Locale.getDefault()))
            }

            private fun isPositive(marker: String): Boolean {
                return marker[0] == '+'
            }
        }
    }

    fun analyzeJmlToken(result: SemanticTokensBuilder, tokens: MutableList<Token>) {
        val sanitizer = JmlDocSanitizer(setOf())
        val text = sanitizer.asString(tokens, true)
        val lexer = GeneratedJavaParserTokenManager(
            SimpleCharStream(Providers.provider(text)),
            GeneratedJavaParserConstants.JML_MULTI_CONTRACT
        )

        do {
            val token = lexer.nextToken
            val tokenType = tokenType(token)
            if (tokenType != null)
                result.add(token, tokenType, tokenModifier(token))
        } while (token.kind != EOF)
    }

    private fun tokenType(token: Token): Int? {
        val cat = TokenTypes.getCategory(token.kind)
        return when (cat) {
            JavaToken.Category.COMMENT -> SupportedTokenTypes.COMMENT.ordinal
            JavaToken.Category.IDENTIFIER -> SupportedTokenTypes.VARIABLE.ordinal
            JavaToken.Category.KEYWORD -> SupportedTokenTypes.KEYWORD.ordinal
            JavaToken.Category.LITERAL -> SupportedTokenTypes.NUMBER.ordinal
            else -> null
        }
    }

    private fun tokenModifier(token: Token): Int = when (token.kind) {
        else -> 0
    }

    fun analyzeJmlToken(document: String): SemanticTokens {
        val provider = Providers.provider(document)
        val lexer = GeneratedJavaParserTokenManager(SimpleCharStream(provider))
        val result = SemanticTokensBuilder()
        var token = lexer.nextToken
        val bag = mutableListOf<Token>()
        while (token != null && token.kind != EOF) {
            when (token.kind) {
                GeneratedJavaParserConstants.JML_LINE_COMMENT,
                GeneratedJavaParserConstants.JML_BLOCK_COMMENT -> {
                    bag.add(token)
                    /*token = lexer.nextToken
                    while (token.kind == GeneratedJavaParserConstants.JML_LINE_COMMENT ||
                        token.kind == GeneratedJavaParserConstants.JML_BLOCK_COMMENT
                    ) {
                        */
                    //  token = lexer.nextToken
                    //}
                    //analyzeJmlToken(result, bag)
                }
            }
            token = lexer.nextToken
        }
        analyzeJmlToken(result, bag)
        return SemanticTokens(result.data)
    }
}