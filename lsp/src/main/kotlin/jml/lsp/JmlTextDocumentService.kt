package jml.lsp

import com.github.javaparser.JavaParser
import com.github.javaparser.ParseResult
import com.github.javaparser.ParserConfiguration
import com.github.javaparser.ast.CompilationUnit
import com.github.javaparser.ast.Node
import com.github.javaparser.ast.body.*
import com.github.javaparser.ast.expr.NameExpr
import com.github.javaparser.resolution.declarations.AssociableToAST
import com.github.javaparser.symbolsolver.JavaSymbolSolver
import com.github.javaparser.symbolsolver.model.resolution.TypeSolver
import com.github.javaparser.symbolsolver.resolution.typesolvers.ClassLoaderTypeSolver
import com.github.javaparser.symbolsolver.resolution.typesolvers.CombinedTypeSolver
import com.github.javaparser.symbolsolver.resolution.typesolvers.JavaParserTypeSolver
import com.google.common.hash.Hashing.crc32
import org.eclipse.lsp4j.*
import org.eclipse.lsp4j.jsonrpc.messages.Either
import org.eclipse.lsp4j.services.TextDocumentService
import org.tinylog.kotlin.Logger
import java.io.File
import java.nio.file.Path
import java.nio.file.Paths
import java.util.*
import java.util.concurrent.CompletableFuture
import java.util.concurrent.ExecutorService
import kotlin.io.path.readText


class AstRepository(val server: JmlLanguageServer, val executorService: ExecutorService) {
    private val sourceFolders = Collections.synchronizedList(arrayListOf<Path>())

    val config: ParserConfiguration = ParserConfiguration()

    val inParsing = Collections.synchronizedMap(mutableMapOf<Uri, CompletableFuture<ParseResult<CompilationUnit>>>())
    val cached = Collections.synchronizedMap(mutableMapOf<Uri, ParseResult<CompilationUnit>>())
    val version = Collections.synchronizedMap(mutableMapOf<Uri, Long>())

    val typeSolver: TypeSolver
        get() {
            synchronized(sourceFolders) {
                val elements: MutableList<TypeSolver> =
                    sourceFolders.asSequence().map { JavaParserTypeSolver(it) }.toMutableList()
                val classLoaderTypeSolver = ClassLoaderTypeSolver(ClassLoader.getSystemClassLoader())
                elements.add(0, classLoaderTypeSolver)
                return CombinedTypeSolver(elements)
            }
        }

    val symbolSolver: JavaSymbolSolver
        get() = JavaSymbolSolver(typeSolver)

    init {
        config.isProcessJml = true
    }

    fun createJavaParser() = JavaParser(config)

    private fun isUpToDate(uri: Uri, content: String): Boolean {
        if (uri !in cached) return false
        return uri in version && crc32(content) == version[uri]
    }

    fun crc32(content: String) = crc32().hashBytes(content.toByteArray()).asLong()

    private fun parseSync(path: Uri): ParseResult<CompilationUnit> {
        val jp = createJavaParser()
        val content = path.path.readText()
        if (isUpToDate(path, content)) {
            return cached[path]!!
        }
        val result = jp.parse(content)
        result.result.ifPresent {
            it.setStorage(path.path, jp.parserConfiguration.characterEncoding)
            addSourceFolder(it.storage.get().sourceRoot)
        }
        announceResult(path, result)
        return result
    }

    private fun parse(path: Uri): CompletableFuture<ParseResult<CompilationUnit>> {
        val future = CompletableFuture.supplyAsync { parseSync(path) }
        synchronized(inParsing) {
            inParsing[path] = future
        }
        return future
    }

    private fun announceResult(path: Uri, result: ParseResult<CompilationUnit>) {
        synchronized(cached) {
            synchronized(inParsing) {
                inParsing.remove(path)
            }
            cached[path] = result
            if (result.isSuccessful && result.result.isPresent) {
                server.client.showMessage(MessageParams(MessageType.Log, "$path parsed"))
            } else {
                /*
                val diagnostics = result.problems.map {
                    if (it.cause.isPresent)
                        Logger.error("Found exception in errors: {}", it.cause.get())
                    val d = Diagnostic(it.location.asRange, it.verboseMessage, DiagnosticSeverity.Error, "jmlparser")
                    d
                }
                server.client.publishDiagnostics(
                    PublishDiagnosticsParams(path.value, diagnostics)
                )
                */
            }
        }
    }

    private fun getSourcePath(cu: CompilationUnit): Path? =
        cu.storage.map { it.sourceRoot }.orElse(null)


    fun addSourceFolder(folder: Path) {
        if (folder !in sourceFolders) {
            sourceFolders.add(folder)
            updateTypeSolver()
        }
    }

    fun updateTypeSolver() {
        val copy = synchronized(cached) { cached.toMap() }
        val solver = symbolSolver
        for (value in copy.values) {
            value.result.ifPresent { it.setData(Node.SYMBOL_RESOLVER_KEY, solver) }
        }
    }

    fun getDiagnostics(path: Uri): CompletableFuture<MutableList<Diagnostic>> =
        get(path).thenApply { result ->
            result.problems.map {
                Diagnostic(it.location.asRange, it.verboseMessage, DiagnosticSeverity.Error, "jmlparser")
            }.toMutableList()
        }

    fun get(path: Uri): CompletableFuture<ParseResult<CompilationUnit>> {
        synchronized(inParsing) {
            inParsing[path]?.let { return it }
        }
        return parse(path)
    }
}

/**
 * Represents URIs send from the client. These are different than Java URI class!
 * Incoming URIs have full protocol specifiers: `file://<path with root>`.
 */
@JvmInline
value class Uri(val value: String) {
    val localFilePath: String
        get() = value.removePrefix("file://")
    val path: Path
        get() = Paths.get(localFilePath)
    val file: File
        get() = File(localFilePath)
}

class JmlTextDocumentService(server: JmlLanguageServer) : TextDocumentService {
    val repo = AstRepository(server, server.executorService)

    override fun didOpen(params: DidOpenTextDocumentParams) {
        Logger.info("didOpen: {}", params)
        Logger.info(params.textDocument.languageId)
        if (params.textDocument.languageId != "text/java")
            return
    }

    override fun didChange(params: DidChangeTextDocumentParams) {
        Logger.info("didChange: {}", params)
    }

    override fun didClose(params: DidCloseTextDocumentParams) {
        Logger.info("didClose: {}", params)
    }

    override fun didSave(params: DidSaveTextDocumentParams) {
        Logger.info("didSave: {}", params)
    }

    override fun completion(position: CompletionParams?): CompletableFuture<Either<MutableList<CompletionItem>, CompletionList>> {
        return super.completion(position)
    }

    override fun resolveCompletionItem(unresolved: CompletionItem?): CompletableFuture<CompletionItem> {
        return super.resolveCompletionItem(unresolved)
    }

    override fun hover(params: HoverParams): CompletableFuture<Hover?> {
        return repo.get(Uri(params.textDocument.uri))
            .thenApplyAsync { findSymbol(params.position, it) }
            .thenApplyAsync {
                if (it == null) null
                else
                    Hover(
                        MarkupContent(
                            "markdown",
                            "Hover message for name: ${it.nameAsString}"
                        )
                    )
            }
    }

    override fun signatureHelp(params: SignatureHelpParams): CompletableFuture<SignatureHelp> {
        /*val path = Uri(params.textDocument.uri)
        val pos = params.position
        val active =
            params.context.activeSignatureHelp.signatures[params.context.activeSignatureHelp.activeSignature]
         */
        return CompletableFuture.supplyAsync {
            SignatureHelp()
        }
    }

    override fun declaration(params: DeclarationParams)
            : CompletableFuture<Either<MutableList<out Location>, MutableList<out LocationLink>>> {
        val uri = Uri(params.textDocument.uri)
        return repo.get(uri)
            .thenApplyAsync { findSymbol(params.position, it) }
            .thenApplyAsync { resolveSymbolInDocument(it) }
    }

    private fun resolveSymbolInDocument(nameExpr: NameExpr?)
            : Either<MutableList<out Location>, MutableList<out LocationLink>> {
        if (nameExpr != null) {
            val r = nameExpr.resolve()
            if (r is AssociableToAST<*> && r.toAst().isPresent) {
                val ast = r.toAst().get()
                val targetUri = "file://${ast.findCompilationUnit().get().storage.get().path.toFile()}"
                val targetRange = ast.asRange
                val targetSelectionRange = targetRange
                // TODO be more specific dependening targeted type
                arrayListOf(LocationLink(targetUri, targetRange, targetSelectionRange))
            }
        }
        return Either.forLeft(arrayListOf())
    }

    private fun findSymbol(position: Position, it: ParseResult<CompilationUnit>): NameExpr? {
        if (!it.result.isPresent) return null
        var current: Node = it.result.get()
        val pos = com.github.javaparser.Position(position.line, position.character)

        next@ while (current.range.get().contains(pos)) {
            if (current is NameExpr)
                return current

            for (child in current.childNodes) {
                if (child.range.get().contains(pos)) {
                    current = child
                    continue@next
                }
            }
        }
        return null
    }

    override fun definition(params: DefinitionParams?): CompletableFuture<Either<MutableList<out Location>, MutableList<out LocationLink>>> {
        return super.definition(params)
    }

    override fun typeDefinition(params: TypeDefinitionParams?): CompletableFuture<Either<MutableList<out Location>, MutableList<out LocationLink>>> {
        return super.typeDefinition(params)
    }

    override fun implementation(params: ImplementationParams?): CompletableFuture<Either<MutableList<out Location>, MutableList<out LocationLink>>> {
        return super.implementation(params)
    }

    override fun references(params: ReferenceParams?): CompletableFuture<MutableList<out Location>> {
        return super.references(params)
    }

    override fun documentHighlight(params: DocumentHighlightParams): CompletableFuture<MutableList<out DocumentHighlight>> {
        Logger.info("documentHighlight: {}", params)
        return CompletableFuture.completedFuture(arrayListOf())
    }

    override fun documentSymbol(params: DocumentSymbolParams): CompletableFuture<MutableList<Either<SymbolInformation, DocumentSymbol>>> {
        Logger.info("params: {}", params)
        val uri = Uri(params.textDocument.uri)
        return repo.get(uri).thenApply {
            Logger.info("Parse: {}", it)
            if (!it.result.isPresent) mutableListOf()
            else resolveSymbol(it.result.get())
        }
    }

    private fun resolveSymbol(compilationUnit: CompilationUnit)
            : MutableList<Either<SymbolInformation, DocumentSymbol>> {
        Logger.info("Resolve symbols for compiluation unit: {}", compilationUnit.storage.get().path)
        val visitor = CatchSymbols()
        val a = compilationUnit.accept(visitor, null) ?: arrayListOf()
        Logger.info("Symbols caught: {}", a.size)
        val b = a.map { Either.forRight<SymbolInformation, DocumentSymbol>(it) }
        return b.toMutableList()
    }

    override fun codeAction(params: CodeActionParams): CompletableFuture<MutableList<Either<Command, CodeAction>>> {
        Logger.info("codeAction: {}", params)
        return repo.get(Uri(params.textDocument.uri)).applyOn(CodeActionCollector(params.context), arrayListOf())
    }

    override fun resolveCodeAction(unresolved: CodeAction?): CompletableFuture<CodeAction> {
        return super.resolveCodeAction(unresolved)
    }

    override fun codeLens(params: CodeLensParams): CompletableFuture<MutableList<out CodeLens>> {
        Logger.info("codeLens: {}", params)
        return repo.get(Uri(params.textDocument.uri)).applyOn(CodeLensCollector(), arrayListOf())
    }

    override fun resolveCodeLens(unresolved: CodeLens): CompletableFuture<CodeLens> {
        Logger.info("codeLens: {}", unresolved)
        return CompletableFuture.completedFuture(CodeLens())
    }

    override fun formatting(params: DocumentFormattingParams?): CompletableFuture<MutableList<out TextEdit>> {
        return super.formatting(params)
    }

    override fun rangeFormatting(params: DocumentRangeFormattingParams?): CompletableFuture<MutableList<out TextEdit>> {
        return super.rangeFormatting(params)
    }

    override fun onTypeFormatting(params: DocumentOnTypeFormattingParams?): CompletableFuture<MutableList<out TextEdit>> {
        return super.onTypeFormatting(params)
    }

    override fun rename(params: RenameParams?): CompletableFuture<WorkspaceEdit> {
        return super.rename(params)
    }

    override fun linkedEditingRange(params: LinkedEditingRangeParams?): CompletableFuture<LinkedEditingRanges> {
        return super.linkedEditingRange(params)
    }

    override fun willSave(params: WillSaveTextDocumentParams?) {
        super.willSave(params)
    }

    override fun willSaveWaitUntil(params: WillSaveTextDocumentParams?): CompletableFuture<MutableList<TextEdit>> {
        return super.willSaveWaitUntil(params)
    }

    override fun documentLink(params: DocumentLinkParams?): CompletableFuture<MutableList<DocumentLink>> {
        return super.documentLink(params)
    }

    override fun documentLinkResolve(params: DocumentLink?): CompletableFuture<DocumentLink> {
        return super.documentLinkResolve(params)
    }

    override fun documentColor(params: DocumentColorParams?): CompletableFuture<MutableList<ColorInformation>> {
        return super.documentColor(params)
    }

    override fun colorPresentation(params: ColorPresentationParams?): CompletableFuture<MutableList<ColorPresentation>> {
        return super.colorPresentation(params)
    }

    override fun foldingRange(params: FoldingRangeRequestParams?): CompletableFuture<MutableList<FoldingRange>> {
        return super.foldingRange(params)
    }

    override fun prepareRename(params: PrepareRenameParams?): CompletableFuture<Either<Range, PrepareRenameResult>> {
        return super.prepareRename(params)
    }

    override fun prepareTypeHierarchy(params: TypeHierarchyPrepareParams?): CompletableFuture<MutableList<TypeHierarchyItem>> {
        return super.prepareTypeHierarchy(params)
    }

    override fun typeHierarchySupertypes(params: TypeHierarchySupertypesParams?): CompletableFuture<MutableList<TypeHierarchyItem>> {
        return super.typeHierarchySupertypes(params)
    }

    override fun typeHierarchySubtypes(params: TypeHierarchySubtypesParams?): CompletableFuture<MutableList<TypeHierarchyItem>> {
        return super.typeHierarchySubtypes(params)
    }

    override fun prepareCallHierarchy(params: CallHierarchyPrepareParams?): CompletableFuture<MutableList<CallHierarchyItem>> {
        return super.prepareCallHierarchy(params)
    }

    override fun callHierarchyIncomingCalls(params: CallHierarchyIncomingCallsParams?): CompletableFuture<MutableList<CallHierarchyIncomingCall>> {
        return super.callHierarchyIncomingCalls(params)
    }

    override fun callHierarchyOutgoingCalls(params: CallHierarchyOutgoingCallsParams?): CompletableFuture<MutableList<CallHierarchyOutgoingCall>> {
        return super.callHierarchyOutgoingCalls(params)
    }

    override fun selectionRange(params: SelectionRangeParams?): CompletableFuture<MutableList<SelectionRange>> {
        return super.selectionRange(params)
    }

    override fun semanticTokensFull(params: SemanticTokensParams?): CompletableFuture<SemanticTokens> {
        return super.semanticTokensFull(params)
    }

    override fun semanticTokensFullDelta(params: SemanticTokensDeltaParams?): CompletableFuture<Either<SemanticTokens, SemanticTokensDelta>> {
        return super.semanticTokensFullDelta(params)
    }

    override fun semanticTokensRange(params: SemanticTokensRangeParams?): CompletableFuture<SemanticTokens> {
        return super.semanticTokensRange(params)
    }

    override fun moniker(params: MonikerParams?): CompletableFuture<MutableList<Moniker>> {
        return super.moniker(params)
    }

    override fun inlayHint(params: InlayHintParams?): CompletableFuture<MutableList<InlayHint>> {
        return super.inlayHint(params)
    }

    override fun resolveInlayHint(unresolved: InlayHint?): CompletableFuture<InlayHint> {
        return super.resolveInlayHint(unresolved)
    }

    override fun inlineValue(params: InlineValueParams?): CompletableFuture<MutableList<InlineValue>> {
        return super.inlineValue(params)
    }

    override fun diagnostic(params: DocumentDiagnosticParams): CompletableFuture<DocumentDiagnosticReport> {
        Logger.info("diagnostic: {}", params)
        val path = Uri(params.textDocument.uri)
        return repo.getDiagnostics(path).thenApply {
            Logger.info("Found errors: {}", it)
            DocumentDiagnosticReport(RelatedFullDocumentDiagnosticReport(it))
        }
    }
}

private fun <T> CompletableFuture<ParseResult<CompilationUnit>>.applyOn(collector: ResultingVisitor<T>, default: T)
        : CompletableFuture<T> = this.thenApplyAsync {
    if (it.result.isPresent) {
        it.result.get().accept(collector, null)
        collector.result
    } else
        default
}
