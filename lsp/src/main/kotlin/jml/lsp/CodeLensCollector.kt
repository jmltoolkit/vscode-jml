package jml.lsp

import com.github.javaparser.ast.jml.clauses.JmlContract
import jml.lsp.actions.VerifyAgainstParent
import org.eclipse.lsp4j.CodeLens
import org.eclipse.lsp4j.Command

/**
 * Runs through the AST and collect code lens actions.
 */
class CodeLensCollector : ResultingVisitor<MutableList<out CodeLens>>() {
    override val result = arrayListOf<CodeLens>()

    override fun visit(n: JmlContract, arg: Unit?) {
        if (n.type == JmlContract.Type.METHOD) {
            //result.add(VerifyAgainstParent.createCodeLens(n))
        }
    }
}
