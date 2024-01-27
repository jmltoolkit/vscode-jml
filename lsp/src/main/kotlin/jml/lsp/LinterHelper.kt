package jml.lsp

import com.github.javaparser.ast.Node
import com.github.jmlparser.lint.JmlLintingConfig
import com.github.jmlparser.lint.JmlLintingFacade
import com.github.jmlparser.lint.LintProblem
import com.github.jmlparser.lint.LintProblemReporter
import com.github.jmlparser.lint.LintRule
import groovy.lang.GroovyClassLoader
import java.io.File

/**
 *
 * @author Alexander Weigl
 * @version 1 (21.10.22)
 */
object LinterHelper {
    private val config = JmlLintingConfig()
    private val linter = JmlLintingFacade(config).getLinter(config)

    private val loadedFolders = mutableSetOf<String>()
    private fun enableFolder(folder: String) {
        if (folder !in loadedFolders) {
            loadedFolders.add(folder)
            val loader = GroovyClassLoader(javaClass.classLoader)
            File(folder).walkTopDown().forEach {
                val clazz = loader.parseClass(it)
                if (clazz.isInstance(LintRule::class.java)) {
                    val instance = clazz.newInstance()
                    linter.add(instance as LintRule?)
                }
            }
        }
    }

    fun lint(n: List<Node>): List<LintProblem> {
        val result = arrayListOf<LintProblem>()
        val reporter = LintProblemReporter(result::add)
        for (rule in linter) {
            n.forEach { rule.accept(it, reporter) }
        }
        return result
    }
}