$repo = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $repo

$lastState = ""

while ($true) {
    try {
        $state = (git status --porcelain 2>&1) | Out-String

        if ($state.Trim() -ne "" -and $state -ne $lastState) {
            git add -A 2>&1 | Out-Null
            $staged = (git diff --cached --name-only 2>&1 | Measure-Object -Line).Lines
            if ($staged -gt 0) {
                $msg = "Auto-commit: $((Get-Date -Format 'yyyy-MM-dd HH:mm:ss'))"
                git commit -m $msg 2>&1 | Out-Null
                git push 2>&1 | Out-Null
                Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Committed + pushed $staged file(s)"
                $lastState = $state
            }
        }
    } catch {
        Write-Host "[$(Get-Date -Format 'HH:mm:ss')] Error: $_"
    }

    Start-Sleep -Seconds 30
}
