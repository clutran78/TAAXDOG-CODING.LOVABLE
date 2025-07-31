#!/bin/bash
BACKUP_DIR="backup-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp -r pages components styles lib "$BACKUP_DIR/"
cp package.json next.config.js tsconfig.json "$BACKUP_DIR/"
echo "Backup created in $BACKUP_DIR"
git branch backup-main-$(date +%Y%m%d-%H%M%S)
git add . && git commit -m "Backup before frontend migration"