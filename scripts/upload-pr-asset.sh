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
#   - node (available in project environment for JSON parsing)
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
  if [[ "$url" =~ github\.com[:/]([^/]+/[^/.]+)(\.git)?$ ]]; then
    echo "${BASH_REMATCH[1]}"
  fi
}

get_repo_id() {
  local repo="$1"
  gh api "repos/${repo}" 2>/dev/null | node -e '
    let d = "";
    process.stdin.on("data", c => d += c);
    process.stdin.on("end", () => {
      try {
        const obj = JSON.parse(d);
        if (obj && obj.id) console.log(obj.id);
      } catch {}
    });
  '
}

# Find a repository where the authenticated user can upload assets.
# Prefer user's fork (origin), then upstream repository.
REPO_CANDIDATES=()
if [ -n "${GITHUB_REPOSITORY:-}" ]; then
  REPO_CANDIDATES+=("${GITHUB_REPOSITORY}")
fi
ORIGIN_REPO=$(get_repo_name "origin")
if [ -n "$ORIGIN_REPO" ]; then
  REPO_CANDIDATES+=("$ORIGIN_REPO")
fi
UPSTREAM_REPO=$(get_repo_name "upstream")
if [ -n "$UPSTREAM_REPO" ]; then
  REPO_CANDIDATES+=("$UPSTREAM_REPO")
fi
REPO_CANDIDATES+=("the-luap/filadex")

REPO_ID=""
ACTIVE_REPO=""

for CANDIDATE in "${REPO_CANDIDATES[@]}"; do
  CANDIDATE_ID=$(get_repo_id "$CANDIDATE")
  if [ -n "$CANDIDATE_ID" ]; then
    REPO_ID="$CANDIDATE_ID"
    ACTIVE_REPO="$CANDIDATE"
    break
  fi
done

if [ -z "$REPO_ID" ]; then
  echo "Error: Could not determine GitHub repository ID from candidates: ${REPO_CANDIDATES[*]}" >&2
  exit 1
fi

get_mime() {
  case "${1##*.}" in
    png) echo "image/png" ;;
    jpg|jpeg) echo "image/jpeg" ;;
    gif) echo "image/gif" ;;
    webp) echo "image/webp" ;;
    svg) echo "image/svg+xml" ;;
    mp4) echo "video/mp4" ;;
    mov) echo "video/quicktime" ;;
    *) echo "application/octet-stream" ;;
  esac
}

echo "Uploading using repository context: ${ACTIVE_REPO} (ID: ${REPO_ID})" >&2

for FILE in "$@"; do
  if [ ! -f "$FILE" ]; then
    echo "Error: File not found: $FILE" >&2
    continue
  fi

  BASENAME=$(basename "$FILE")
  EXT="${FILE##*.}"
  NAME_WITHOUT_EXT="${BASENAME%.*}"
  MIME=$(get_mime "$FILE")

  RESPONSE=$(curl -s -X POST "https://uploads.github.com/user-attachments/assets?name=${BASENAME}&content_type=${MIME}&repository_id=${REPO_ID}" \
    -H "Authorization: Bearer ${TOKEN}" \
    -H "Accept: application/json" \
    --data-binary "@${FILE}")

  URL=$(node -e '
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
  ' "$RESPONSE")

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
