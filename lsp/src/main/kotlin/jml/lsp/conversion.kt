package jml.lsp

import com.github.javaparser.TokenRange
import com.github.javaparser.ast.Node
import org.eclipse.lsp4j.Position
import org.eclipse.lsp4j.Range
import java.util.*

val com.github.javaparser.Position.asPosition: Position
    get() = Position(line - 1, column - 1)

val Optional<TokenRange>.asRange: Range
    get() =
        if (isPresent) {
            val r = get().toRange().get()
            r.asRange
        } else {
            Range(Position(1, 1), Position(1, 2))
        }

fun Optional<com.github.javaparser.Range>.asRange(): Range =
    if (isPresent) {
        this.get().asRange
    } else {
        Range()
    }

val com.github.javaparser.Range.asRange: Range
    get() = Range(begin.asPosition, end.asPosition)

val Node.asRange: Range
    get() = range.asRange()
