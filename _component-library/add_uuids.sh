#!/bin/bash

# Adds the per-instance `_uuid` field to any component blueprint that is missing
# it, with a null default. CloudCannon fills the value in from
# `instance_value: UUID` (declared once in cloudcannon.config.yml) as blocks are
# created; components emit it as `data-rosey-ns` to scope translation keys.
#
# Usage:
#   ./add_uuids.sh             write the changes
#   ./add_uuids.sh --dry-run   report what would change, write nothing

dry_run=false
if [ "$1" = "--dry-run" ]; then
    dry_run=true
fi

# 1. Loop through all files ending in .bookshop.yml recursively
find . -type f -name "*.bookshop.yml" | while read -r file; do

    filename=$(basename "$file")

    # 2. Skip components that already declare _uuid on the blueprint itself.
    #    Two spaces pins the match to a direct child of `blueprint:`, so a nested
    #    `_uuid` inside a list item doesn't count as the component having one.
    if grep -q "^  _uuid:" "$file"; then
        echo "Skipping $filename: _uuid already exists."
        continue
    fi

    # 3. Pick the line to insert after: below _componentId when present,
    #    otherwise as the first key of the blueprint.
    if grep -q "^  _componentId:" "$file"; then
        anchor="^  _componentId:"
    elif grep -q "^blueprint:[[:space:]]*$" "$file"; then
        anchor="^blueprint:[[:space:]]*$"
    else
        echo "Skipping $filename: no blueprint to add _uuid to."
        continue
    fi

    if [ "$dry_run" = true ]; then
        echo "Would update $filename with _uuid."
        continue
    fi

    # 4. Insert the key after the first match of the anchor. Writing through a
    #    temp file keeps the original intact if awk fails partway.
    tmp="${file}.uuidtmp"
    awk -v anchor="$anchor" '
        !inserted && $0 ~ anchor { print; print "  _uuid:"; inserted = 1; next }
        { print }
        END { if (!inserted) exit 3 }
    ' "$file" > "$tmp"

    if [ $? -ne 0 ]; then
        rm -f "$tmp"
        echo "Failed $filename: anchor not found."
        continue
    fi

    mv "$tmp" "$file"
    echo "Updated $filename with _uuid."

done
