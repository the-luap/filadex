#!/usr/bin/env bash
#
# scripts/upload-pr-asset.sh
#
# Uploads image and video screenshots directly to GitHub's native user-attachments
# storage and outputs canonical URLs and Markdown embed tags.
#
# Usage:
#   ./scripts/upload-pr-asset.sh <file1> [file2 ...]
#   npm run upload:pr-asset -- <file1> [file2 ...]
#
# Requirements:
#   - gh CLI installed and authenticated (gh auth login)
#   - curl
#   - node (available in project environment for JSON parsing and URL encoding)
#
# Note:
#   Uploads to GitHub's 'user-attachments/assets' backend. This endpoint requires
#   an authenticated user session or personal access token with repo scope.
#

set -euo pipefail

if [ "$#" -lt 1 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
  echo "Usage: $0 <image-or-video-file> [more-files...]"
  echo ""
  echo "Uploads assets to GitHub's native attachment storage (user-attachments)"
  echo "and outputs canonical Markdown embed snippets for PR descriptions."
  exit 0
fi

TOKEN=$(gh auth token 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  echo "Error: gh CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

get_repo_name() {
  local remote="$1"
  local url
  url=$(git config --get "remote.${remote}.url" 2>/dev/null || true)
  url="${url%/}"
  url="${url%.git}"
  url="${url%/}"
  if [[ "$url" =~ github\.com[:/]([^/]+/[^/]+)$ ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

# Resolve repository context. In a GitHub fork workflow, contributors have write
# access to their fork ('origin') rather than 'upstream', while maintainers have
# write access to 'origin' directly.
ACTIVE_REPO=""
for CANDIDATE in "$(get_repo_name "origin")" "$(get_repo_name "upstream")" "${GITHUB_REPOSITORY:-}" "$(gh repo view --json nameWithOwner -q .nameWithOwner 2>/dev/null || true)"; do
  if [ -n "$CANDIDATE" ]; then
    ACTIVE_REPO="$CANDIDATE"
    break
  fi
done

if [ -z "$ACTIVE_REPO" ]; then
  echo "Error: Could not determine GitHub repository from git remotes or gh CLI." >&2
  exit 1
fi

# The user-attachments endpoint requires GitHub's numeric REST database ID (bigint)
# rather than GraphQL node ID ('R_kg...'). Query the REST API for the ID.
REPO_ID=$(gh api "repos/${ACTIVE_REPO}" --jq .id 2>/dev/null || true)
if [ -z "$REPO_ID" ]; then
  echo "Error: Could not retrieve repository ID for '${ACTIVE_REPO}'." >&2
  exit 1
fi

get_file_size() {
  local file="$1"
  local size=""
  if [ "$(uname -s)" = "Darwin" ]; then
    size=$(stat -f %z "$file" 2>/dev/null || wc -c < "$file")
  else
    size=$(stat -c %s "$file" 2>/dev/null || wc -c < "$file")
  fi
  printf '%s' "$size" | tr -d '[:space:]'
}

get_mime() {
  local ext="${1##*.}"
  case "$(printf '%s' "$ext" | tr '[:upper:]' '[:lower:]')" in
    png) echo "image/png" ;;
    jpg|jpeg) echo "image/jpeg" ;;
    gif) echo "image/gif" ;;
    webp) echo "image/webp" ;;
    svg) echo "image/svg+xml" ;;
    mp4) echo "video/mp4" ;;
    webm) echo "video/webm" ;;
    mov) echo "video/quicktime" ;;
    *) echo "application/octet-stream" ;;
  esac
}

echo "Uploading using repository context: ${ACTIVE_REPO} (ID: ${REPO_ID})" >&2

FAILED_COUNT=0

for FILE in "$@"; do
  if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    FAILED_COUNT=$((FAILED_COUNT + 1))
    continue
  fi

  FILE_SIZE=$(get_file_size "$FILE")
  # GitHub user attachments are capped at 10MB (10,485,760 bytes)
  if [ -n "$FILE_SIZE" ] && [ "$FILE_SIZE" -gt 10485760 ]; then
    MB=$((FILE_SIZE / 1048576))
    DEC=$(( (FILE_SIZE % 1048576) * 100 / 1048576 ))
    echo "Error: File exceeds GitHub 10MB attachment limit: ${FILE} ($(printf "%d.%02dMB" "$MB" "$DEC") / ${FILE_SIZE} bytes)" >&2
    FAILED_COUNT=$((FAILED_COUNT + 1))
    continue
  fi

  BASENAME=$(basename "$FILE")
  NAME_WITHOUT_EXT="${BASENAME%.*}"
  MIME=$(get_mime "$FILE")
  ENCODED_NAME=$(node -e 'console.log(encodeURIComponent(process.argv[1]))' "$BASENAME")

  RESPONSE=""
  if ! RESPONSE=$(curl -sS -X POST "https://uploads.github.com/user-attachments/assets?name=${ENCODED_NAME}&content_type=${MIME}&repository_id=${REPO_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/json" \
    --data-binary "@${FILE}" 2>&1); then
    echo "Error uploading ${FILE}: Network/curl failure: ${RESPONSE}" >&2
    FAILED_COUNT=$((FAILED_COUNT + 1))
    continue
  fi

  PARSED_OUTPUT=""
  if ! PARSED_OUTPUT=$(node -e '
    const raw = process.argv[1];
    try {
      const res = JSON.parse(raw);
      if (res.url) {
        console.log(res.url);
      } else {
        console.error("Upload error:", JSON.stringify(res));
        process.exit(1);
      }
    } catch (e) {
      console.error("Failed to parse response:", raw);
      process.exit(1);
    }
  ' "$RESPONSE" 2>&1); then
    echo "Error uploading ${FILE}: ${PARSED_OUTPUT}" >&2
    FAILED_COUNT=$((FAILED_COUNT + 1))
    continue
  fi

  URL="$PARSED_OUTPUT"

  if [ -n "$URL" ]; then
    if [[ "$MIME" == video/* ]]; then
      echo "Uploaded: ${FILE}"
      echo "URL: ${URL}"
      echo "Markdown: <video src=\"${URL}\" controls></video>"
    else
      echo "Uploaded: ${FILE}"
      echo "URL: ${URL}"
      echo "Markdown: ![${NAME_WITHOUT_EXT}](${URL})"
    fi
    echo ""
  fi
done

if [ "$FAILED_COUNT" -gt 0 ]; then
  echo "Finished with ${FAILED_COUNT} upload error(s)." >&2
  exit 1
fi
