#!/bin/bash

# ESS XML Request/Response Monitor
# This script provides real-time monitoring of XML messages with formatted output

echo "🔍 ESS XML Request/Response Monitor"
echo "=================================="
echo "Monitoring: $(pwd)/logs/app-$(date +%Y-%m-%d).log"
echo "Press Ctrl+C to stop monitoring"
echo ""

# Function to format XML content
format_xml_log() {
    while read -r line; do
        if [[ $line == *"DASHBOARD_XML_REQUEST"* ]]; then
            timestamp=$(echo "$line" | jq -r '.timestamp' 2>/dev/null || echo "$(date)")
            method=$(echo "$line" | jq -r '.method' 2>/dev/null || echo "N/A")
            path=$(echo "$line" | jq -r '.path' 2>/dev/null || echo "N/A")
            messageType=$(echo "$line" | jq -r '.messageType' 2>/dev/null || echo "N/A")
            sender=$(echo "$line" | jq -r '.sender' 2>/dev/null || echo "N/A")
            contentLength=$(echo "$line" | jq -r '.contentLength' 2>/dev/null || echo "N/A")
            
            echo "📥 INCOMING REQUEST [$timestamp]"
            echo "   Method: $method | Path: $path"
            echo "   Message Type: $messageType | Sender: $sender"
            echo "   Content Length: $contentLength bytes"
            echo ""
            
            # Extract and format XML (first 500 chars for readability)
            xmlContent=$(echo "$line" | jq -r '.xmlContent' 2>/dev/null)
            if [[ $xmlContent != "null" && $xmlContent != "" ]]; then
                echo "   XML Content (preview):"
                echo "   $(echo "$xmlContent" | head -c 500)..."
                echo ""
            fi
            
        elif [[ $line == *"DASHBOARD_XML_RESPONSE"* ]]; then
            timestamp=$(echo "$line" | jq -r '.timestamp' 2>/dev/null || echo "$(date)")
            statusCode=$(echo "$line" | jq -r '.statusCode' 2>/dev/null || echo "N/A")
            messageType=$(echo "$line" | jq -r '.messageType' 2>/dev/null || echo "N/A")
            responseCode=$(echo "$line" | jq -r '.responseCode' 2>/dev/null || echo "N/A")
            contentLength=$(echo "$line" | jq -r '.contentLength' 2>/dev/null || echo "N/A")
            
            echo "📤 OUTGOING RESPONSE [$timestamp]"
            echo "   Status Code: $statusCode | Response Code: $responseCode"
            echo "   Message Type: $messageType"
            echo "   Content Length: $contentLength bytes"
            echo ""
            
            # Extract and format XML (first 500 chars for readability)
            xmlContent=$(echo "$line" | jq -r '.xmlContent' 2>/dev/null)
            if [[ $xmlContent != "null" && $xmlContent != "" ]]; then
                echo "   XML Content (preview):"
                echo "   $(echo "$xmlContent" | head -c 500)..."
                echo ""
            fi
        fi
        echo "----------------------------------------"
    done
}

# Start monitoring
cd /c/laragon/www/ess
tail -f "logs/app-$(date +%Y-%m-%d).log" | grep --line-buffered "DASHBOARD_XML" | format_xml_log