package jml.lsp

import com.github.javaparser.ast.visitor.VoidVisitorAdapter

/**
 *
 * @author Alexander Weigl
 * @version 1 (20.07.22)
 */
abstract class ResultingVisitor<T> : VoidVisitorAdapter<Unit?>() {
    abstract val result : T
    fun applyOn(x: Any): Unit {

    }
}