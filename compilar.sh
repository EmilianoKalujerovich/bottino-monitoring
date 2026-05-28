#!/bin/bash

echo "========================================"
echo "Compiling Bottino Monitoring System"
echo "========================================"
echo ""

# Use the project-local Maven settings so the build works on machines
# configured with a custom ~/.m2/settings.xml (e.g. Lakaut Artifactory).
SETTINGS_FILE="$(dirname "$0")/maven-settings.xml"
MVN_OPTS="-s $SETTINGS_FILE"

echo "[1/3] Cleaning previous builds..."
mvn $MVN_OPTS clean

echo ""
echo "[2/3] Compiling and packaging..."
mvn $MVN_OPTS package -DskipTests

echo ""
echo "[3/3] Verifying result..."
if [ -f "target/bottino-monitoring.jar" ]; then
    echo ""
    echo "========================================"
    echo "COMPILATION SUCCESSFUL!"
    echo "========================================"
    echo ""
    echo "Generated file: target/bottino-monitoring.jar"
    echo ""
    echo "To run:"
    echo "  java -jar target/bottino-monitoring.jar"
    echo ""
    echo "Or simply double-click the JAR file"
    echo ""
else
    echo ""
    echo "========================================"
    echo "COMPILATION ERROR"
    echo "========================================"
    echo ""
    echo "Check error messages above."
    echo ""
fi
