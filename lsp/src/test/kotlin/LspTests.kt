import jml.lsp.JmlLanguageServer
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.LanguageClient
import org.junit.jupiter.api.Test
import java.io.File
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

/**
 *
 * @author Alexander Weigl
 * @version 1 (20.07.22)
 */
class LspTests {
    val workspace = File("../example_workspace/")
    val languageServer = JmlLanguageServer().also {
        val params = InitializeParams()
        params.workspaceFolders = arrayListOf(WorkspaceFolder(workspace.toUri, "Test Bed"))
        it.connect(EmptyLanguageClient())
        it.initialize(params)
    }

    val docService = languageServer.textDocumentService

    @Test
    fun documentSymbols() {
        val params = DocumentSymbolParams(TextDocumentIdentifier(File(workspace, "Example.java").toUri))
        val result = docService.documentSymbol(params).get()
        println(result)
    }
}