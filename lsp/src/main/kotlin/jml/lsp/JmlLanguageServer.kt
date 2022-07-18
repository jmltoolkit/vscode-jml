package jml.lsp

import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.services.*
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


    override fun initialize(params: InitializeParams?): CompletableFuture<InitializeResult> {
        if (params != null) {
            workspaceFolders = params.workspaceFolders
            capabilities = params.capabilities
        }

        val capabilities = ServerCapabilities()
        capabilities.setTextDocumentSync(TextDocumentSyncKind.Full)
        //capabilities.diagnosticProvider = DiagnosticRegistrationOptions(true, false)
        // capabilities.setCodeActionProvider(true)
        // capabilities.setColorProvider(false)
        capabilities.setDocumentHighlightProvider(true)
        // capabilities.setDeclarationProvider(true)
        //capabilities.codeLensProvider = CodeLensOptions(true)
        //capabilities.completionProvider = CompletionOptions(true, null)

        return CompletableFuture.completedFuture(InitializeResult(capabilities))
    }

    override fun shutdown(): CompletableFuture<Any> {
        executorService.shutdownNow()
        return CompletableFuture.completedFuture("finish")
    }

    override fun exit() {
        exitProcess(0)
    }

    override fun getTextDocumentService(): TextDocumentService = jmlTextDocumentService

    override fun getWorkspaceService(): WorkspaceService = jmlWorkspaceService

    override fun connect(client: LanguageClient) {
        this.client = client
    }

}
