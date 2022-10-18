package jml.lsp

import com.github.javaparser.ast.Node
import com.github.javaparser.ast.jml.clauses.JmlContract
import com.google.common.cache.CacheBuilder
import jml.lsp.actions.WellDefinednessCheck
import org.eclipse.lsp4j.CodeLens
import org.eclipse.lsp4j.Command
import org.eclipse.lsp4j.MessageParams
import org.eclipse.lsp4j.MessageType
import java.util.concurrent.CompletableFuture

/**
 *
 * @author Alexander Weigl
 * @version 1 (16.10.22)
 */
interface LspAction<T : Node> {
    val id: String
    val title: String

    fun command(args: List<Any>? = null): Command =
        Command(WellDefinednessCheck.title, WellDefinednessCheck.id, args)

    fun execute(server: JmlLanguageServer, value: List<Any>): CompletableFuture<Any>
    fun createCodeLens(node: T): CodeLens
}
