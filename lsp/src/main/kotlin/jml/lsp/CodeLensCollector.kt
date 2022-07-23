package jml.lsp

import com.github.javaparser.ast.jml.clauses.JmlContract
import org.eclipse.lsp4j.CodeLens
import org.eclipse.lsp4j.Command

class CodeLensCollector : ResultingVisitor<MutableList<out CodeLens>>() {
    override val result = arrayListOf<CodeLens>()

    override fun visit(n: JmlContract, arg: Unit?) {
        if (n.type == JmlContract.Type.METHOD) {
            val lens = CodeLens(
                n.asRange, Command(
                    "Verify against parent", "jml.verify.liskov"
                ), listOf("contract", n.asRange)
            )
            result.add(lens)
        }
    }
}
