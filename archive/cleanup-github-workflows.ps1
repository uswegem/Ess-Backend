# PowerShell script to clean up GitHub Actions workflows
# Deletes failed runs and runs that have been running for more than 30 minutes

$REPO_OWNER = "uswegem"
$REPO_NAME = "MiraCore_New"

Write-Host "Cleaning up GitHub Actions workflow runs" -ForegroundColor Cyan
Write-Host "Repository: $REPO_OWNER/$REPO_NAME"
Write-Host ""

# Prompt for GitHub Personal Access Token
Write-Host "GitHub Personal Access Token required" -ForegroundColor Yellow
Write-Host "Create one at: https://github.com/settings/tokens/new" -ForegroundColor Gray
Write-Host "Required scope: repo (full control of private repositories)" -ForegroundColor Gray
Write-Host ""

$GITHUB_TOKEN = Read-Host "Enter your GitHub PAT" -AsSecureString
$BSTR = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($GITHUB_TOKEN)
$TOKEN = [System.Runtime.InteropServices.Marshal]::PtrToStringAuto($BSTR)

if ([string]::IsNullOrWhiteSpace($TOKEN)) {
    Write-Host "❌ No token provided" -ForegroundColor Red
    exit 1
}

Write-Host "Token received" -ForegroundColor Green
Write-Host ""

# Headers for GitHub API
$headers = @{
    "Authorization" = "token $TOKEN"
    "Accept" = "application/vnd.github.v3+json"
    "User-Agent" = "PowerShell-GitHubActions-Cleanup"
}

try {
    Write-Host "Fetching workflow runs..." -ForegroundColor Cyan
    
    # Get workflow runs
    $apiUrl = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/runs?per_page=100"
    $response = Invoke-RestMethod -Uri $apiUrl -Headers $headers -Method Get
    
    if ($response.workflow_runs.Count -eq 0) {
        Write-Host "No workflow runs found" -ForegroundColor Yellow
        exit 0
    }
    
    Write-Host "Found $($response.workflow_runs.Count) workflow runs" -ForegroundColor Gray
    Write-Host ""
    
    # Get current time and 30 minutes ago threshold
    $currentTime = Get-Date
    $thirtyMinutesAgo = $currentTime.AddMinutes(-30)
    
    $deletedCount = 0
    
    foreach ($run in $response.workflow_runs) {
        $runId = $run.id
        $status = $run.status
        $conclusion = $run.conclusion
        $createdAt = [DateTime]::Parse($run.created_at)
        $name = $run.name
        
        $shouldDelete = $false
        $reason = ""
        
        # Check if failed
        if ($conclusion -eq "failure") {
            $shouldDelete = $true
            $reason = "failed"
        }
        
        # Check if cancelled
        if ($conclusion -eq "cancelled") {
            $shouldDelete = $true
            $reason = "cancelled"
        }
        
        # Check if timed out
        if ($conclusion -eq "timed_out") {
            $shouldDelete = $true
            $reason = "timed out"
        }
        
        # Check if running for more than 30 minutes
        if (($status -eq "in_progress" -or $status -eq "queued") -and $createdAt -lt $thirtyMinutesAgo) {
            $shouldDelete = $true
            $reason = "running > 30 min"
        }
        
        # Delete if needed
        if ($shouldDelete) {
            Write-Host "Deleting run #$runId : $name ($reason)" -ForegroundColor Yellow
            
            try {
                $deleteUrl = "https://api.github.com/repos/$REPO_OWNER/$REPO_NAME/actions/runs/$runId"
                Invoke-RestMethod -Uri $deleteUrl -Headers $headers -Method Delete | Out-Null
                Write-Host "   Deleted successfully" -ForegroundColor Green
                $deletedCount++
            }
            catch {
                Write-Host "   Failed to delete: $($_.Exception.Message)" -ForegroundColor Red
            }
        }
    }
    
    Write-Host ""
    Write-Host "Cleanup complete!" -ForegroundColor Green
    Write-Host "Deleted $deletedCount workflow runs" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "View remaining runs at: https://github.com/$REPO_OWNER/$REPO_NAME/actions" -ForegroundColor Gray
}
catch {
    Write-Host ""
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "Authentication failed. Please check your token." -ForegroundColor Yellow
    }
    elseif ($_.Exception.Response.StatusCode -eq 403) {
        Write-Host "Permission denied. Ensure your token has repo scope." -ForegroundColor Yellow
    }
    
    exit 1
}
