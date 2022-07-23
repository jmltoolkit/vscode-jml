package jml.lsp

import com.github.javaparser.ast.Node
import com.github.javaparser.ast.jml.clauses.JmlSignalsClause
import com.github.javaparser.ast.jml.clauses.JmlSimpleExprClause
import com.github.javaparser.ast.jml.expr.JmlQuantifiedExpr
import com.github.javaparser.ast.jml.expr.JmlQuantifiedExpr.JmlDefaultBinder
import com.github.javaparser.ast.jml.stmt.JmlExpressionStmt
import org.eclipse.lsp4j.CodeAction
import org.eclipse.lsp4j.CodeActionContext
import org.eclipse.lsp4j.Command
import org.eclipse.lsp4j.jsonrpc.messages.Either

class CodeActionCollector(val context: CodeActionContext?) :
    ResultingVisitor<MutableList<Either<Command, CodeAction>>>() {
    override val result = arrayListOf<Either<Command, CodeAction>>()
    fun add(x: Command) = result.add(Either.forLeft(x))
    fun add(x: CodeAction) = result.add(Either.forRight(x))

    override fun visit(n: JmlExpressionStmt, arg: Unit?) {
        if (n.kind != JmlExpressionStmt.JmlStmtKind.SET && n.kind != JmlExpressionStmt.JmlStmtKind.HENCE_BY) {
            addWelldefinedCheck(n)
        }
        super.visit(n, arg)
    }

    override fun visit(n: JmlSimpleExprClause, arg: Unit?) {
        addWelldefinedCheck(n)
    }

    override fun visit(n: JmlSignalsClause, arg: Unit?) {
        addWelldefinedCheck(n)
        super.visit(n, arg)
    }

    private fun addWelldefinedCheck(n: Node) {
        val r = n.asRange
        val ca = Command("WD-check", "jml.welldefinedCheck", listOf(r))
        add(ca)
    }

    override fun visit(n: JmlQuantifiedExpr, arg: Unit?) {
        if (n.binder == JmlDefaultBinder.FORALL || n.binder == JmlDefaultBinder.EXISTS) {
            val ca = CodeAction("Add boundary")
            add(ca)
        }
    }
}
