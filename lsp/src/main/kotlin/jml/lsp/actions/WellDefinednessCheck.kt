package jml.lsp.actions

import com.github.javaparser.ast.expr.Expression
import jml.lsp.JmlLanguageServer
import jml.lsp.LspAction
import jml.lsp.asRange
import org.eclipse.lsp4j.CodeLens
import org.eclipse.lsp4j.Command
import java.util.concurrent.CompletableFuture

object WellDefinednessCheck : LspAction<Expression> {
    override val id: String
        get() = "jml.welldefinedness-check"
    override val title: String
        get() = "Check expression for well-definedness"

    override fun execute(server: JmlLanguageServer, value: List<Any>): CompletableFuture<Any> {
        TODO("Not yet implemented")
    }

    fun createCommand(node: Expression): Command = command(listOf(node.hashCode()))

    override fun createCodeLens(node: Expression): CodeLens = CodeLens(node.asRange, command(), null)

}

//    val ca = Command("WD-check", "jml.welldefinedCheck", listOf(r))