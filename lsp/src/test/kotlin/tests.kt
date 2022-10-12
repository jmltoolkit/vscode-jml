import com.google.common.truth.Truth
import jml.lsp.JmlLanguageServer
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.LanguageClient
import org.junit.jupiter.api.DynamicTest
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.TestFactory
import java.io.File
import java.lang.StringBuilder
import java.util.concurrent.CompletableFuture

private val File.toUri: String
    get() = "file://${absolutePath}"

class EmptyLanguageClient : LanguageClient {
    override fun telemetryEvent(`object`: Any?) {
    }

    override fun publishDiagnostics(diagnostics: PublishDiagnosticsParams?) {
    }

    override fun showMessage(messageParams: MessageParams?) {
    }

    override fun showMessageRequest(requestParams: ShowMessageRequestParams?): CompletableFuture<MessageActionItem> {
        return CompletableFuture.completedFuture(MessageActionItem("Test!"))
    }

    override fun logMessage(message: MessageParams?) {
    }
}

val workspace = File("../example_workspace/")
val languageServer = JmlLanguageServer().also {
    val params = InitializeParams()
    params.workspaceFolders = arrayListOf(WorkspaceFolder(workspace.toUri, "Test Bed"))
    it.connect(EmptyLanguageClient())
    it.initialize(params)
}

val docService = languageServer.textDocumentService

class HoverTest {
    @Test
    fun test1(): Unit {
        val params = HoverParams()
        //docService.hover(params)
    }
}

class DeclarationTests {
    @Test
    fun test1() {
        val file = TextDocumentIdentifier(File(workspace, "Declarations.java").toUri)
        val variableInClause = DeclarationParams(file, Position(5, 16))
        val variableInAssert = DeclarationParams(file, Position(10, 18))
        val forall = DeclarationParams(file, Position(7, 16))

        val result0 = docService.declaration(forall).get()
        println(result0)

        //val result1 = docService.declaration(variableInClause).get()
        //val result2 = docService.declaration(variableInAssert).get()

    }
}

/**
 *
 * @author Alexander Weigl
 * @version 1 (20.07.22)
 */
class DocumentSymbolTests {
    private fun testDocumentSymbols(javaFile: File, symbolsTruth: File) {
        val params = DocumentSymbolParams(TextDocumentIdentifier(javaFile.toUri))
        val result = docService.documentSymbol(params).get()
        val sb = toCsv(result.map { it.right }, javaFile.name)
        Truth.assertThat(sb.toString())
            .isEqualTo(symbolsTruth.readText())
    }

    @TestFactory
    fun documentSymbols(): List<DynamicTest> {
        println(workspace.absoluteFile)

        return workspace.absoluteFile.walkTopDown().asSequence()
            .filter {
                File("$it.symbols").exists()
            }
            .filter { it.name.endsWith(".java") }
            .map { file ->
                DynamicTest.dynamicTest(file.name) {
                    testDocumentSymbols(file, File("$file.symbols"))
                }
            }
            .toList()
    }

    private fun toCsv(
        result: List<DocumentSymbol>,
        file: String,
        sb: StringBuilder = StringBuilder(),
        depth: Int = 0,
    ): StringBuilder {
        for (right in result) {
            sb.append(">".repeat(depth))
                .append(" ")
                .append(right.name)
                .append("\t")
                .append(right.kind)
                .append("\t")
                .append(file)
                .append(":")
                .append(right.selectionRange.start.line + 1)
                .append(":")
                .append(right.selectionRange.start.character + 1)
                .append("\n")
            toCsv(right.children, file, sb, depth + 1);
        }
        return sb
    }
}