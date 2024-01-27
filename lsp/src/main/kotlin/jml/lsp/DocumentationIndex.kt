package jml.lsp

import java.net.URI
import java.util.*

class DocumentationIndex {
    private val index by lazy {
        javaClass.getResourceAsStream("/doc/index.properties")
            ?.bufferedReader()
            ?.let { r -> Properties().also { it.load(r) } }
            ?.map { (a, b) -> a.toString() to b.toString() }
            ?.toMap()
            ?: error("Could not load /doc/index.properties")
    }

    fun get(entry: String): String? {
        fun resolveEntry(entry: String): String =
            index[entry]?.let {
                if (it.isNotBlank()) resolveEntry(it)
                else entry
            } ?: entry

        return retrieve(resolveEntry(entry))
    }

    private fun retrieve(uri: String): String? {
        return try {
            URI(uri).toURL().openStream().bufferedReader().readText()
        } catch (e: Exception) {
            javaClass.getResourceAsStream("/doc/$uri.md")
                ?.bufferedReader()
                ?.readText()
        }
    }
}
