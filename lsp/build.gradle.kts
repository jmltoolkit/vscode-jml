import org.jetbrains.kotlin.gradle.tasks.KotlinCompile

plugins {
    kotlin("jvm") version "2.0.0-Beta3"
    id("com.github.johnrengelman.shadow") version "7.1.2"
    id("application")
}

repositories {
    maven {
        url = uri("https://maven.pkg.github.com/wadoon/jmlparser")
        credentials {
            username = project.findProperty("gpr.user") as String? ?: System.getenv("USERNAME")
            password = project.findProperty("gpr.key") as String? ?: System.getenv("TOKEN")
        }
    }
}

group = "io.wadoon.jmlparser.lsp"
version = "1.0-SNAPSHOT"

repositories {
    mavenCentral()
    maven(url = "https://s01.oss.sonatype.org/content/repositories/snapshots/")
}

dependencies {
    testImplementation(kotlin("test"))
    implementation("org.tinylog:tinylog-api-kotlin:2.5.0")
    implementation("org.tinylog:tinylog-api:2.5.0-M2.1")
    implementation("org.tinylog:tinylog-impl:2.5.0")
    implementation("org.eclipse.lsp4j:org.eclipse.lsp4j:0.21.2")
    implementation("com.github.ajalt.clikt:clikt:3.5.0")

    implementation("io.github.jmltoolkit:jmlparser-symbol-solver-core:3.25.8-SNAPSHOT")
    implementation("io.github.jmltoolkit:jmlparser-jml-tools:3.25.8-SNAPSHOT")

    implementation("org.apache.groovy:groovy:4.0.6")

    testImplementation("com.google.truth:truth:1.1.3")
    testImplementation("org.junit.jupiter:junit-jupiter-api:5.9.0")
    testRuntimeOnly("org.junit.jupiter:junit-jupiter-engine:5.9.0")
}

tasks.test {
    useJUnitPlatform()
}

tasks.withType<KotlinCompile> {
    kotlinOptions.jvmTarget = "21"
}

application {
    mainClass = "jml.lsp.Main"
}