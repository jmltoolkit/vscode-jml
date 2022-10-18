package jml.lsp

import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.*
import java.util.ServiceLoader
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutorService
import java.util.concurrent.ForkJoinPool
import kotlin.system.exitProcess


class JmlLanguageServer : LanguageServer, LanguageClientAware {
    internal val executorService: ExecutorService = ForkJoinPool.commonPool()
    internal val jmlTextDocumentService by lazy { JmlTextDocumentService(this) }
    internal val jmlWorkspaceService by lazy { JmlWorkspaceService(this) }

    lateinit var client: LanguageClient
    internal var capabilities: ClientCapabilities? = null
    internal var workspaceFolders: List<WorkspaceFolder>? = null
    internal val jmlNotebookDocumentServices by lazy { JmlNotebookDocumentServices() }

    internal val actions by lazy {
        ServiceLoader.load(LspAction::class.java).toList()
    }

    override fun getNotebookDocumentService(): NotebookDocumentService = jmlNotebookDocumentServices

    override fun initialize(params: InitializeParams?): CompletableFuture<InitializeResult> {
        if (params != null) {
            workspaceFolders = params.workspaceFolders
            capabilities = params.capabilities
        }

        return CompletableFuture.supplyAsync {
            val capabilities = ServerCapabilities()
            capabilities.setTextDocumentSync(TextDocumentSyncKind.Full)
            capabilities.diagnosticProvider = DiagnosticRegistrationOptions(true, false)
            capabilities.setDocumentSymbolProvider(true)
            capabilities.setWorkspaceSymbolProvider(true)
            capabilities.setDeclarationProvider(DeclarationRegistrationOptions("JML"))
            capabilities.signatureHelpProvider = SignatureHelpOptions()
            capabilities.setHoverProvider(true)
            capabilities.codeLensProvider = CodeLensOptions(true)
            capabilities.setSelectionRangeProvider(true)

            //capabilities.setDefinitionProvider(true)
            //capabilities.setDocumentHighlightProvider(true)
            //capabilities.completionProvider = CompletionOptions(true, null)

            capabilities.setCodeActionProvider(CodeActionOptions(actions.map { it.id }))
            return@supplyAsync InitializeResult(capabilities)
        }
    }

    override fun shutdown(): CompletableFuture<Any> {
        executorService.shutdownNow()
        return CompletableFuture.completedFuture("finish")
    }

    override fun exit() {
        shutdown()
        exitProcess(0)
    }

    override fun getTextDocumentService(): TextDocumentService = jmlTextDocumentService

    override fun getWorkspaceService(): WorkspaceService = jmlWorkspaceService

    override fun connect(client: LanguageClient) {
        this.client = client
    }

}
