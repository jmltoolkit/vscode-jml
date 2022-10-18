package jml.lsp

import com.github.javaparser.ast.Node
import com.github.javaparser.ast.expr.Expression
import com.github.javaparser.ast.jml.clauses.JmlSignalsClause
import com.github.javaparser.ast.jml.clauses.JmlSimpleExprClause
import com.github.javaparser.ast.jml.expr.JmlQuantifiedExpr
import com.github.javaparser.ast.jml.expr.JmlQuantifiedExpr.JmlDefaultBinder
import com.github.javaparser.ast.jml.stmt.JmlExpressionStmt
import jml.lsp.actions.WellDefinednessCheck
import org.eclipse.lsp4j.CodeAction
import org.eclipse.lsp4j.CodeActionContext
import org.eclipse.lsp4j.Command
import org.eclipse.lsp4j.jsonrpc.messages.Either
import kotlin.jvm.optionals.getOrNull

class CodeActionCollector(val context: CodeActionContext?, private val range: com.github.javaparser.Range) :
    ResultingVisitor<MutableList<Either<Command, CodeAction>>>() {
    override val result = arrayListOf<Either<Command, CodeAction>>()
    fun add(x: Command) = result.add(Either.forLeft(x))
    fun add(x: CodeAction) = result.add(Either.forRight(x))

    override fun visit(n: JmlExpressionStmt, arg: Unit?) {
        if (n.kind != JmlExpressionStmt.JmlStmtKind.SET && n.kind != JmlExpressionStmt.JmlStmtKind.HENCE_BY) {
            addWelldefinedCheck(n.expression)
        }
        super.visit(n, arg)
    }

    override fun visit(n: JmlSimpleExprClause, arg: Unit?) {
        addWelldefinedCheck(n.expression)
    }

    override fun visit(n: JmlSignalsClause, arg: Unit?) {
        addWelldefinedCheck(n.expression)
        super.visit(n, arg)
    }

    private fun addWelldefinedCheck(n: Expression): Boolean {
        if (inRange(n))
            return add(WellDefinednessCheck.createCommand(n))
        return false
    }

    @OptIn(ExperimentalStdlibApi::class)
    private fun inRange(n: Node): Boolean = n.range.getOrNull()?.contains(range) ?: false

    override fun visit(n: JmlQuantifiedExpr, arg: Unit?) {
        if (n.binder == JmlDefaultBinder.FORALL || n.binder == JmlDefaultBinder.EXISTS) {
            val ca = CodeAction("Add boundary")
            add(ca)
        }
    }
}
