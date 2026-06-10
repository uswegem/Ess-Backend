#!/bin/bash

# ESS Grafana Monitoring Setup Script
# This script sets up Grafana + Loki stack for ESS log monitoring

set -e

ESS_HOME="/home/uswege/ess"
MONITORING_DIR="$ESS_HOME/monitoring"

echo "🚀 Setting up ESS Grafana Monitoring Stack..."

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists docker; then
    echo "❌ Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installed. Please log out and back in to apply group changes."
    exit 1
fi

if ! command_exists docker-compose; then
    echo "❌ Docker Compose is not installed. Installing..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
    echo "✅ Docker Compose installed."
fi

# Create monitoring directory if it doesn't exist
if [ ! -d "$MONITORING_DIR" ]; then
    echo "📁 Creating monitoring directory..."
    mkdir -p "$MONITORING_DIR"
fi

cd "$MONITORING_DIR"

# Start the monitoring stack
echo "🔄 Starting Grafana monitoring stack..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to start..."
sleep 30

# Check if services are running
echo "🔍 Checking service status..."
docker-compose ps

# Show access information
echo ""
echo "✅ ESS Grafana Monitoring Setup Complete!"
echo ""
echo "📊 Access Information:"
echo "  • Grafana Dashboard: http://$(hostname -I | awk '{print $1}'):3001"
echo "  • Username: admin"
echo "  • Password: admin123"
echo "  • Loki API: http://$(hostname -I | awk '{print $1}'):3100"
echo "  • Prometheus: http://$(hostname -I | awk '{print $1}'):9090"
echo ""
echo "📋 Pre-configured Features:"
echo "  • ESS Application Logs Dashboard"
echo "  • LOAN_OFFER_REQUEST monitoring"
echo "  • LOAN_INITIAL_APPROVAL_NOTIFICATION tracking"
echo "  • Error log visualization"
echo "  • Real-time log streaming"
echo ""
echo "🔧 Management Commands:"
echo "  • View logs: docker-compose logs -f"
echo "  • Stop stack: docker-compose down"
echo "  • Restart: docker-compose restart"
echo "  • Update: docker-compose pull && docker-compose up -d"
echo ""
echo "📈 Next Steps:"
echo "  1. Open Grafana dashboard in your browser"
echo "  2. Explore the pre-built ESS logs dashboard"
echo "  3. Test LOAN_OFFER_REQUEST to see live logs"
echo "  4. Customize dashboards as needed"

# Create management script
cat > "$ESS_HOME/manage-monitoring.sh" << 'EOF'
#!/bin/bash
# ESS Monitoring Management Script

MONITORING_DIR="/home/uswege/ess/monitoring"

case "$1" in
    start)
        echo "🚀 Starting monitoring stack..."
        cd "$MONITORING_DIR" && docker-compose up -d
        ;;
    stop)
        echo "🛑 Stopping monitoring stack..."
        cd "$MONITORING_DIR" && docker-compose down
        ;;
    restart)
        echo "🔄 Restarting monitoring stack..."
        cd "$MONITORING_DIR" && docker-compose restart
        ;;
    status)
        echo "📊 Monitoring stack status:"
        cd "$MONITORING_DIR" && docker-compose ps
        ;;
    logs)
        echo "📋 Monitoring stack logs:"
        cd "$MONITORING_DIR" && docker-compose logs -f "${2:-}"
        ;;
    update)
        echo "⬆️ Updating monitoring stack..."
        cd "$MONITORING_DIR" && docker-compose pull && docker-compose up -d
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs|update}"
        echo ""
        echo "Examples:"
        echo "  $0 start          # Start all monitoring services"
        echo "  $0 logs grafana   # View Grafana logs"
        echo "  $0 status         # Show service status"
        exit 1
        ;;
esac
EOF

chmod +x "$ESS_HOME/manage-monitoring.sh"

echo "✅ Management script created at: $ESS_HOME/manage-monitoring.sh"