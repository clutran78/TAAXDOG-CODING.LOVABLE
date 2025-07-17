#!/bin/bash

# Docker build script for optimized Next.js images
set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
IMAGE_NAME="taaxdog-nextjs"
TAG="latest"
TARGET="runner"
DOCKERFILE="Dockerfile"
BUILD_ARGS=""
PLATFORM=""

# Help function
show_help() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  -n, --name NAME      Image name (default: taaxdog-nextjs)"
    echo "  -t, --tag TAG        Image tag (default: latest)"
    echo "  -f, --file FILE      Dockerfile to use (default: Dockerfile)"
    echo "  -s, --stage STAGE    Target stage (runner|development)"
    echo "  -p, --platform PLAT  Platform (linux/amd64|linux/arm64)"
    echo "  --no-cache           Build without cache"
    echo "  --push               Push to registry after build"
    echo "  --size               Show image size analysis"
    echo "  -h, --help           Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0                                    # Basic production build"
    echo "  $0 -t v1.0.0 --push                  # Build and push version"
    echo "  $0 -s development                     # Build development image"
    echo "  $0 -f Dockerfile.optimized --size     # Use optimized Dockerfile"
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -n|--name)
            IMAGE_NAME="$2"
            shift 2
            ;;
        -t|--tag)
            TAG="$2"
            shift 2
            ;;
        -f|--file)
            DOCKERFILE="$2"
            shift 2
            ;;
        -s|--stage)
            TARGET="$2"
            shift 2
            ;;
        -p|--platform)
            PLATFORM="--platform $2"
            shift 2
            ;;
        --no-cache)
            BUILD_ARGS="$BUILD_ARGS --no-cache"
            shift
            ;;
        --push)
            PUSH_IMAGE=true
            shift
            ;;
        --size)
            ANALYZE_SIZE=true
            shift
            ;;
        -h|--help)
            show_help
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            show_help
            exit 1
            ;;
    esac
done

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Docker is not running!${NC}"
    exit 1
fi

# Check if Dockerfile exists
if [ ! -f "$DOCKERFILE" ]; then
    echo -e "${RED}Dockerfile not found: $DOCKERFILE${NC}"
    exit 1
fi

echo -e "${GREEN}Building Next.js Docker image...${NC}"
echo "Image: $IMAGE_NAME:$TAG"
echo "Target: $TARGET"
echo "Dockerfile: $DOCKERFILE"

# Build image
BUILD_CMD="docker build $PLATFORM $BUILD_ARGS -f $DOCKERFILE -t $IMAGE_NAME:$TAG --target $TARGET ."
echo -e "${YELLOW}Running: $BUILD_CMD${NC}"

if $BUILD_CMD; then
    echo -e "${GREEN}✓ Build successful!${NC}"
    
    # Show image info
    echo ""
    echo "Image details:"
    docker images $IMAGE_NAME:$TAG
    
    # Analyze size if requested
    if [ "$ANALYZE_SIZE" = true ]; then
        echo ""
        echo -e "${YELLOW}Analyzing image layers...${NC}"
        docker history $IMAGE_NAME:$TAG
        
        echo ""
        echo -e "${YELLOW}Layer size breakdown:${NC}"
        docker inspect $IMAGE_NAME:$TAG | jq '.[0].RootFS.Layers | length' | xargs echo "Total layers:"
        docker inspect $IMAGE_NAME:$TAG | jq '.[0].Size' | numfmt --to=iec-i --suffix=B | xargs echo "Total size:"
    fi
    
    # Push if requested
    if [ "$PUSH_IMAGE" = true ]; then
        echo ""
        echo -e "${YELLOW}Pushing image to registry...${NC}"
        docker push $IMAGE_NAME:$TAG
        echo -e "${GREEN}✓ Push successful!${NC}"
    fi
    
    # Security scan suggestion
    echo ""
    echo -e "${YELLOW}Tips:${NC}"
    echo "• Run security scan: docker scan $IMAGE_NAME:$TAG"
    echo "• Test the image: docker run --rm -p 3000:3000 $IMAGE_NAME:$TAG"
    echo "• Check logs: docker logs <container-id>"
    
else
    echo -e "${RED}✗ Build failed!${NC}"
    exit 1
fi