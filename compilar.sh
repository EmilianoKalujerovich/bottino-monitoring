#!/bin/bash

echo "========================================"
echo "Compiling Bottino Monitoring System"
echo "========================================"
echo ""

echo "[1/3] Cleaning previous builds..."
mvn clean

echo ""
echo "[2/3] Compiling and packaging..."
mvn package -DskipTests

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
