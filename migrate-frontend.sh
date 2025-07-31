#!/bin/bash

# TAAXDOG Frontend Migration Script
# Safely migrates next-frontend directory from development branch to main branch
# Handles conflicts and provides rollback options

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SOURCE_BRANCH="development"
TARGET_BRANCH="main"
SOURCE_DIR="next-frontend"
MIGRATION_TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
MIGRATION_LOG="migration_${MIGRATION_TIMESTAMP}.log"
TEMP_DIR=".migration_temp_${MIGRATION_TIMESTAMP}"

# Function to log messages
log() {
    echo -e "$1" | tee -a "$MIGRATION_LOG"
}

# Function to check prerequisites
check_prerequisites() {
    log "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        log "${RED}❌ Error: git is not installed${NC}"
        exit 1
    fi
    
    # Check current branch
    CURRENT_BRANCH=$(git branch --show-current)
    log "Current branch: $CURRENT_BRANCH"
    
    # Check for uncommitted changes
    if ! git diff-index --quiet HEAD --; then
        log "${RED}❌ Error: Uncommitted changes detected${NC}"
        log "Please commit or stash your changes first"
        exit 1
    fi
    
    # Check if development branch exists
    if ! git show-ref --verify --quiet refs/heads/$SOURCE_BRANCH; then
        log "${RED}❌ Error: Branch '$SOURCE_BRANCH' does not exist${NC}"
        exit 1
    fi
    
    # Check if next-frontend exists in development branch
    if ! git ls-tree -d $SOURCE_BRANCH:$SOURCE_DIR &> /dev/null; then
        log "${RED}❌ Error: Directory '$SOURCE_DIR' not found in $SOURCE_BRANCH branch${NC}"
        exit 1
    fi
    
    log "${GREEN}✅ Prerequisites check passed${NC}"
}

# Function to create backup
create_backup() {
    log "${BLUE}📦 Creating backup...${NC}"
    
    # Run the backup script if it exists
    if [ -f "./backup-main-branch.sh" ]; then
        log "Running backup script..."
        ./backup-main-branch.sh
    else
        log "${YELLOW}⚠️  Warning: backup-main-branch.sh not found, creating simple backup${NC}"
        BACKUP_DIR="backups/pre_migration_${MIGRATION_TIMESTAMP}"
        mkdir -p "$BACKUP_DIR"
        
        # Save current state info
        git log --oneline -n 10 > "$BACKUP_DIR/git-log.txt"
        git rev-parse HEAD > "$BACKUP_DIR/commit-hash.txt"
        
        # Backup existing next-frontend if it exists
        if [ -d "$SOURCE_DIR" ]; then
            log "Backing up existing $SOURCE_DIR directory..."
            cp -R "$SOURCE_DIR" "$BACKUP_DIR/"
        fi
    fi
    
    log "${GREEN}✅ Backup completed${NC}"
}

# Function to analyze conflicts
analyze_conflicts() {
    log "${BLUE}🔍 Analyzing potential conflicts...${NC}"
    
    # Create temporary directory
    mkdir -p "$TEMP_DIR"
    
    # Get list of files in next-frontend from development branch
    git ls-tree -r $SOURCE_BRANCH:$SOURCE_DIR --name-only > "$TEMP_DIR/source_files.txt"
    
    # Check for existing files that would be overwritten
    CONFLICTS=()
    if [ -d "$SOURCE_DIR" ]; then
        while IFS= read -r file; do
            if [ -f "$SOURCE_DIR/$file" ]; then
                CONFLICTS+=("$file")
            fi
        done < "$TEMP_DIR/source_files.txt"
    fi
    
    if [ ${#CONFLICTS[@]} -gt 0 ]; then
        log "${YELLOW}⚠️  Found ${#CONFLICTS[@]} potential file conflicts:${NC}"
        for conflict in "${CONFLICTS[@]}"; do
            log "  - $conflict"
        done
        
        # Save conflict list
        printf '%s\n' "${CONFLICTS[@]}" > "$TEMP_DIR/conflicts.txt"
        
        # Ask for confirmation
        echo ""
        read -p "Do you want to proceed? Existing files will be backed up. (yes/no): " confirm
        if [ "$confirm" != "yes" ]; then
            log "${RED}Migration cancelled by user${NC}"
            cleanup_and_exit 1
        fi
    else
        log "${GREEN}✅ No conflicts detected${NC}"
    fi
}

# Function to perform migration
perform_migration() {
    log "${BLUE}🚀 Starting migration...${NC}"
    
    # Switch to main branch if not already there
    if [ "$CURRENT_BRANCH" != "$TARGET_BRANCH" ]; then
        log "Switching to $TARGET_BRANCH branch..."
        git checkout "$TARGET_BRANCH"
    fi
    
    # Create a migration branch
    MIGRATION_BRANCH="migration/frontend_${MIGRATION_TIMESTAMP}"
    log "Creating migration branch: $MIGRATION_BRANCH"
    git checkout -b "$MIGRATION_BRANCH"
    
    # Export next-frontend from development branch
    log "Exporting $SOURCE_DIR from $SOURCE_BRANCH branch..."
    
    # Remove existing directory if it exists
    if [ -d "$SOURCE_DIR" ]; then
        log "Backing up existing $SOURCE_DIR to $TEMP_DIR/old_frontend..."
        mv "$SOURCE_DIR" "$TEMP_DIR/old_frontend"
    fi
    
    # Export the directory from development branch
    git checkout $SOURCE_BRANCH -- $SOURCE_DIR
    
    # Check if export was successful
    if [ ! -d "$SOURCE_DIR" ]; then
        log "${RED}❌ Error: Failed to export $SOURCE_DIR${NC}"
        
        # Restore old directory if it existed
        if [ -d "$TEMP_DIR/old_frontend" ]; then
            mv "$TEMP_DIR/old_frontend" "$SOURCE_DIR"
        fi
        
        cleanup_and_exit 1
    fi
    
    log "${GREEN}✅ Successfully exported $SOURCE_DIR${NC}"
    
    # Handle package.json conflicts if both exist
    if [ -f "package.json" ] && [ -f "$SOURCE_DIR/package.json" ]; then
        log "${YELLOW}⚠️  Detected package.json in both root and $SOURCE_DIR${NC}"
        log "Creating comparison file..."
        
        # Create a comparison report
        cat > "$TEMP_DIR/package_json_comparison.md" << EOF
# Package.json Comparison Report

## Root package.json
\`\`\`json
$(cat package.json | head -20)
...
\`\`\`

## $SOURCE_DIR/package.json
\`\`\`json
$(cat $SOURCE_DIR/package.json | head -20)
...
\`\`\`

## Action Required
You may need to merge dependencies and scripts manually.
EOF
        
        log "Comparison saved to: $TEMP_DIR/package_json_comparison.md"
    fi
    
    # Create migration summary
    create_migration_summary
    
    log "${GREEN}✅ Migration completed successfully!${NC}"
    log ""
    log "${YELLOW}Next steps:${NC}"
    log "1. Review the changes: git status"
    log "2. Test the migrated frontend: npm install && npm run dev"
    log "3. If everything works, commit the changes:"
    log "   git add ."
    log "   git commit -m 'feat: Migrate next-frontend from development branch'"
    log "4. Create a pull request to merge into main"
    log ""
    log "To rollback:"
    log "   git checkout $TARGET_BRANCH"
    log "   git branch -D $MIGRATION_BRANCH"
}

# Function to create migration summary
create_migration_summary() {
    log "${BLUE}📝 Creating migration summary...${NC}"
    
    SUMMARY_FILE="MIGRATION_SUMMARY_${MIGRATION_TIMESTAMP}.md"
    
    cat > "$SUMMARY_FILE" << EOF
# Frontend Migration Summary

**Date**: $(date)  
**Migration ID**: ${MIGRATION_TIMESTAMP}  
**Source Branch**: ${SOURCE_BRANCH}  
**Target Branch**: ${TARGET_BRANCH}  
**Migration Branch**: ${MIGRATION_BRANCH}

## Migration Details

### Files Migrated
$(find $SOURCE_DIR -type f | wc -l) files migrated from $SOURCE_DIR

### Directory Structure
\`\`\`
$(tree $SOURCE_DIR -L 2 2>/dev/null || find $SOURCE_DIR -type d | head -20)
\`\`\`

### Conflicts Handled
$(if [ -f "$TEMP_DIR/conflicts.txt" ]; then echo "$(cat "$TEMP_DIR/conflicts.txt" | wc -l) conflicts resolved"; else echo "No conflicts"; fi)

### Git Information
- Source Commit: $(git rev-parse $SOURCE_BRANCH)
- Target Commit: $(git rev-parse $TARGET_BRANCH)

## Post-Migration Checklist

- [ ] Review all migrated files
- [ ] Run \`npm install\` in $SOURCE_DIR directory
- [ ] Test the frontend application
- [ ] Update any import paths if necessary
- [ ] Merge or update configuration files
- [ ] Run linting and type checking
- [ ] Execute test suite
- [ ] Update documentation

## Rollback Instructions

If you need to rollback this migration:

\`\`\`bash
git checkout $TARGET_BRANCH
git branch -D $MIGRATION_BRANCH
\`\`\`

## Notes

Add any additional notes or observations here:
- 
- 

---
Generated by migrate-frontend.sh
EOF
    
    log "Migration summary saved to: $SUMMARY_FILE"
}

# Cleanup function
cleanup_and_exit() {
    log "${BLUE}🧹 Cleaning up...${NC}"
    
    # Remove temporary directory
    if [ -d "$TEMP_DIR" ]; then
        rm -rf "$TEMP_DIR"
    fi
    
    exit ${1:-0}
}

# Main execution
main() {
    log "${GREEN}═══════════════════════════════════════════════════${NC}"
    log "${GREEN}   TAAXDOG Frontend Migration Script${NC}"
    log "${GREEN}═══════════════════════════════════════════════════${NC}"
    log ""
    
    # Check prerequisites
    check_prerequisites
    
    # Create backup
    create_backup
    
    # Analyze conflicts
    analyze_conflicts
    
    # Perform migration
    perform_migration
    
    # Cleanup
    cleanup_and_exit 0
}

# Trap errors and cleanup
trap 'cleanup_and_exit 1' ERR INT TERM

# Run main function
main