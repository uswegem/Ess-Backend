# PowerShell script to cancel long-running GitHub Actions workflows
# Cancels runs that have been running for more than 30 minutes

$REPO_OWNER = "uswegem"
$REPO_NAME = "MiraCore_New"

Write-Host "Cancelling long-running GitHub Actions workflows" -ForegroundColor Cyan
Write-Host "Repository: $REPO_OWNER/$REPO_NAME"
Write-Host ""

# Prompt for GitHub Personal Access Token
$GITHUB_TOKEN = Read-Host "Enter your GitHub PAT" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($GITHUB_TOKEN)
$TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

if ([string]::IsNullOrWhiteSpace($TOKEN)) {
    Write-Host "No token provided" -ForegroundColor Red
    exit 1
}

# Headers for GitHub API
$headers = @{
    "Authorization" = "token $TOKEN"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "PowerShell-GitHubActions-Cancel"
}

try {
    Write-Host "Fetching workflow runs..." -ForegroundColor Cyan
    
    # Get workflow runs
    $apiUrl = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/runs?status=in_progress&per_page=100"
    $response = Invoke-RestMethod -Uri $apiUrl -Headers $headers -Method Get
    
    if ($response.workflow_runs.Count -eq 0) {
        Write-Host "No running workflows found" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Found $($response.workflow_runs.Count) running workflows" -ForegroundColor Gray
    Write-Host ""
    
    # Get current time and 30 minutes ago threshold
    $currentTime = Get-Date
    $thirtyMinutesAgo = $currentTime.AddMinutes(-30)
    
    $cancelledCount = 0
    
    foreach ($run in $response.workflow_runs) {
        $runId = $run.id
        $status = $run.status
        $createdAt = [DateTime]::Parse($run.created_at)
        $name = $run.name
        $duration = ($currentTime - $createdAt).TotalMinutes
        
        # Cancel if running for more than 30 minutes
        if ($createdAt -lt $thirtyMinutesAgo) {
            Write-Host "Cancelling run #$runId : $name (running for $([Math]::Round($duration, 1)) minutes)" -ForegroundColor Yellow
            
            try {
                $cancelUrl = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/runs/$runId/cancel"
                Invoke-RestMethod -Uri $cancelUrl -Headers $headers -Method Post | Out-Null
                Write-Host "   Cancelled successfully" -ForegroundColor Green
                $cancelledCount++
                Start-Sleep -Seconds 1  # Rate limiting
            }
            catch {
                Write-Host "   Failed to cancel: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "Cleanup complete!" -ForegroundColor Green
    Write-Host "Cancelled $cancelledCount workflow runs" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Now run cleanup-github-workflows.ps1 again to delete the cancelled runs" -ForegroundColor Gray
}
catch {
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
