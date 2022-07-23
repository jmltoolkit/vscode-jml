package jml.lsp

import com.github.javaparser.ast.*
import com.github.javaparser.ast.body.*
import com.github.javaparser.ast.expr.VariableDeclarationExpr
import com.github.javaparser.ast.jml.body.*
import com.github.javaparser.ast.jml.clauses.JmlContract
import com.github.javaparser.ast.modules.ModuleDeclaration
import com.github.javaparser.ast.visitor.GenericVisitorAdapter
import org.eclipse.lsp4j.*
import java.util.*

class CatchSymbols : GenericVisitorAdapter<MutableList<DocumentSymbol>?, Unit?>() {
    override fun visit(n: CompilationUnit, arg: Unit?): MutableList<DocumentSymbol>? {
        val children = acceptAll(n.types)
        return arrayListOf(
            DocumentSymbol(
                n.storage.get().fileName,
                SymbolKind.Interface,
                n.asRange, n.primaryType.get().name.asRange, "", children
            )
        )
    }

    override fun visit(n: AnnotationDeclaration, arg: Unit?): MutableList<DocumentSymbol> {
        val children = acceptAll(n.members)
        return arrayListOf(
            DocumentSymbol(
                n.nameAsString,
                SymbolKind.Interface,
                n.asRange, n.name.asRange, "", children
            )
        )
    }

    override fun visit(n: AnnotationMemberDeclaration, arg: Unit?): MutableList<DocumentSymbol>? {
        return arrayListOf(
            DocumentSymbol(
                n.nameAsString,
                SymbolKind.Field,
                n.asRange, n.name.asRange, ""
            )
        )
    }

    override fun visit(n: ClassOrInterfaceDeclaration, arg: Unit?): MutableList<DocumentSymbol> {
        val children = acceptAll(n.members)
        return arrayListOf(
            DocumentSymbol(
                n.nameAsString,
                if (n.isInterface) SymbolKind.Interface else SymbolKind.Class,
                n.asRange, n.name.asRange, "", children
            )
        )
    }

    private fun acceptAll(members: NodeList<*>?): MutableList<DocumentSymbol> {
        if (members == null) return arrayListOf()
        return members.flatMap { it.accept(this, null) ?: arrayListOf() }.toMutableList()
    }

    private fun <T : Node> acceptAllo(members: Optional<NodeList<T>>?): MutableList<DocumentSymbol> =
        acceptAll(members?.orElse(null))

    override fun visit(n: ConstructorDeclaration, arg: Unit?): MutableList<DocumentSymbol> {
        val children = acceptAllo(n.contracts)
        return arrayListOf(
            DocumentSymbol(
                n.nameAsString,
                SymbolKind.Constructor,
                n.asRange, n.name.asRange, "", children
            )
        )
    }


    override fun visit(n: EnumConstantDeclaration, arg: Unit?): MutableList<DocumentSymbol> {
        return arrayListOf(
            DocumentSymbol(
                n.nameAsString,
                SymbolKind.EnumMember,
                n.asRange, n.name.asRange,
            )
        )
    }

    override fun visit(n: EnumDeclaration, arg: Unit?): MutableList<DocumentSymbol> {
        val children = acceptAll(n.members)
        return arrayListOf(
            DocumentSymbol(
                n.nameAsString,
                SymbolKind.Enum,
                n.asRange, n.name.asRange, "", children
            )
        )
    }

    override fun visit(n: FieldDeclaration, arg: Unit?): MutableList<DocumentSymbol>? {
        return n.variables.map {
            DocumentSymbol(
                it.nameAsString,
                SymbolKind.Field,
                it.asRange, it.name.asRange, it.typeAsString, arrayListOf()
            )
        }.toMutableList()
    }

    override fun visit(n: MethodDeclaration, arg: Unit?): MutableList<DocumentSymbol>? {
        val children = acceptAllo(n.contracts)
        return arrayListOf(
            DocumentSymbol(
                n.nameAsString,
                SymbolKind.Method,
                n.asRange, n.name.asRange, "", children
            )
        )
    }

    override fun visit(n: JmlMethodDeclaration, arg: Unit?): MutableList<DocumentSymbol>? {
        return n.methodDeclaration.accept(this, arg)
    }

    override fun visit(n: VariableDeclarationExpr?, arg: Unit?): MutableList<DocumentSymbol>? {
        return super.visit(n, arg)
    }

    override fun visit(n: ModuleDeclaration, arg: Unit?): MutableList<DocumentSymbol>? {
        return arrayListOf(
            DocumentSymbol(
                n.nameAsString,
                SymbolKind.Module,
                n.asRange, n.name.asRange, "", arrayListOf()
            )
        )
    }

    override fun visit(n: JmlContract, arg: Unit?): MutableList<DocumentSymbol>? {
        val children = acceptAll(n.subContracts)
        return arrayListOf(
            DocumentSymbol(
                n.name.map { it.asString() }.orElse(n.behavior.asString()),
                SymbolKind.Key,
                n.asRange, n.asRange, "", children
            )
        )
    }
}
