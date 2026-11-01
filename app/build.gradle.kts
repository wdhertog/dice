plugins {
    id("com.android.application")
}

// Version code increases with every CI build so a new APK installs over the old one.
val buildNumber = (System.getenv("GITHUB_RUN_NUMBER") ?: "1").toInt()

// Test builds (from branches other than main) get their own app id and name,
// so they install next to the normal app.
val testBuild = System.getenv("DICE_TEST_BUILD") == "true"

android {
    namespace = "nl.wdhertog.dice"
    compileSdk = 35

    defaultConfig {
        applicationId = "nl.wdhertog.dice"
        minSdk = 26
        targetSdk = 34
        versionCode = buildNumber
        versionName = "1.0.$buildNumber"
        manifestPlaceholders["appLabel"] = if (testBuild) "Dobbelstenen (test)" else "Dobbelstenen"
        if (testBuild) {
            applicationIdSuffix = ".test"
            versionNameSuffix = "-test"
        }
    }

    signingConfigs {
        create("release") {
            // A private keystore can be supplied through environment variables
            // (GitHub secrets). Otherwise the public keystore in the repo is used,
            // which keeps updates installable but is not secret.
            val customStore = System.getenv("DICE_KEYSTORE_FILE")
            storeFile = file(customStore ?: "keystore/dice-public.jks")
            storePassword = System.getenv("DICE_KEYSTORE_PASSWORD") ?: "dobbelstenen"
            keyAlias = System.getenv("DICE_KEY_ALIAS") ?: "dice"
            keyPassword = System.getenv("DICE_KEY_PASSWORD") ?: "dobbelstenen"
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = signingConfigs.getByName("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
}

// Builds the web app (three.js + physics) into src/main/assets/www.
val buildWeb by tasks.registering(Exec::class) {
    group = "build"
    description = "Bundles the web app into the Android assets"
    workingDir = rootProject.file("web")
    val npm = if (System.getProperty("os.name").lowercase().contains("windows")) "npm.cmd" else "npm"
    commandLine(npm, "run", "build")
    inputs.dir(rootProject.file("web/src"))
    inputs.dir(rootProject.file("web/public"))
    outputs.dir(file("src/main/assets/www"))
}

tasks.named("preBuild") {
    dependsOn(buildWeb)
}
