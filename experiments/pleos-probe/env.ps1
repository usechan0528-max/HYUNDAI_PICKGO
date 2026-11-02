$ProbeRepo = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$ProbeTools = Join-Path $ProbeRepo 'work/pleos-environment'
$env:JAVA_HOME = (Get-ChildItem (Join-Path $ProbeTools 'jdk') -Directory | Select-Object -First 1).FullName
$env:ANDROID_HOME = Join-Path $ProbeTools 'android-sdk'
$env:ANDROID_USER_HOME = Join-Path $ProbeTools 'android-user'
$env:ANDROID_AVD_HOME = Join-Path $ProbeTools 'avd'
$env:PATH = "$env:JAVA_HOME/bin;$env:ANDROID_HOME/platform-tools;$env:ANDROID_HOME/emulator;$ProbeTools/gradle/gradle-8.9/bin;$env:PATH"
