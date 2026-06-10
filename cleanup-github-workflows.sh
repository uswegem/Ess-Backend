#!/bin/bash

# Script to delete failed and long-running GitHub Actions workflow runs
# Author: GitHub Copilot
# Date: 2025-12-18

REPO_OWNER="uswegem"
REPO_NAME="MiraCore_New"

echo "🧹 Cleaning up GitHub Actions workflow runs"
echo "Repository: $REPO_OWNER/$REPO_NAME"
echo ""

# Check if GitHub CLI is installed
if ! command -v gh &> /dev/null; then
    echo "❌ GitHub CLI (gh) is not installed."
    echo "Install from: https://cli.github.com/"
    echo ""
    echo "For Windows: winget install --id GitHub.cli"
    echo "For Linux: sudo apt install gh"
    exit 1
fi

# Check if authenticated
if ! gh auth status &> /dev/null; then
    echo "🔐 Not authenticated with GitHub CLI"
    echo "Authenticating now..."
    gh auth login
fi

echo "✅ Authenticated with GitHub CLI"
echo ""

# Get all workflow runs
echo "📋 Fetching workflow runs..."
WORKFLOW_RUNS=$(gh api "repos/$REPO_OWNER/$REPO_NAME/actions/runs?per_page=100" --jq '.workflow_runs[] | {id: .id, status: .status, conclusion: .conclusion, created_at: .created_at, name: .name}')

if [ -z "$WORKFLOW_RUNS" ]; then
    echo "ℹ️  No workflow runs found"
    exit 0
fi

# Get current timestamp
CURRENT_TIME=$(date +%s)
THIRTY_MINUTES_AGO=$((CURRENT_TIME - 1800))

deleted_count=0

# Process each workflow run
gh api "repos/$REPO_OWNER/$REPO_NAME/actions/runs?per_page=100" --jq '.workflow_runs[] | @json' | while read -r run; do
    RUN_ID=$(echo "$run" | jq -r '.id')
    STATUS=$(echo "$run" | jq -r '.status')
    CONCLUSION=$(echo "$run" | jq -r '.conclusion')
    CREATED_AT=$(echo "$run" | jq -r '.created_at')
    NAME=$(echo "$run" | jq -r '.name')
    
    # Convert created_at to timestamp
    RUN_TIMESTAMP=$(date -d "$CREATED_AT" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%SZ" "$CREATED_AT" +%s 2>/dev/null)
    
    SHOULD_DELETE=false
    REASON=""
    
    # Check if failed
    if [ "$CONCLUSION" == "failure" ]; then
        SHOULD_DELETE=true
        REASON="failed"
    fi
    
    # Check if cancelled
    if [ "$CONCLUSION" == "cancelled" ]; then
        SHOULD_DELETE=true
        REASON="cancelled"
    fi
    
    # Check if running for more than 30 minutes
    if [ "$STATUS" == "in_progress" ] || [ "$STATUS" == "queued" ]; then
        if [ "$RUN_TIMESTAMP" -lt "$THIRTY_MINUTES_AGO" ]; then
            SHOULD_DELETE=true
            REASON="running > 30 min"
        fi
    fi
    
    # Delete if needed
    if [ "$SHOULD_DELETE" == "true" ]; then
        echo "🗑️  Deleting run #$RUN_ID: $NAME ($REASON)"
        
        if gh api -X DELETE "repos/$REPO_OWNER/$REPO_NAME/actions/runs/$RUN_ID" &> /dev/null; then
            echo "   ✅ Deleted successfully"
            ((deleted_count++))
        else
            echo "   ⚠️  Failed to delete (might require admin permissions)"
        fi
    fi
done

echo ""
echo "✨ Cleanup complete!"
echo "📊 Deleted $deleted_count workflow runs"
echo ""
echo "View remaining runs at: https://github.com/$REPO_OWNER/$REPO_NAME/actions"
