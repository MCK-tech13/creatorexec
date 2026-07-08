#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
INPUT="${ROOT}/public/videos/product-scout-walkthrough.mov"
OUTPUT="${ROOT}/public/videos/product-scout-walkthrough.mp4"

if [[ ! -f "$INPUT" ]]; then
  echo "Missing input: public/videos/product-scout-walkthrough.mov" >&2
  exit 1
fi

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to convert the walkthrough video." >&2
  exit 1
fi

INPUT_SIZE_MB=$(du -m "$INPUT" | cut -f1)
echo "Converting walkthrough video (${INPUT_SIZE_MB}MB MOV → MP4)..."

HAS_AUDIO=$(ffprobe -v error -select_streams a -show_entries stream=codec_type -of csv=p=0 "$INPUT" | head -1 || true)

FFMPEG_ARGS=(
  -y
  -i "$INPUT"
  -c:v libx264
  -preset medium
  -crf 26
  -profile:v main
  -pix_fmt yuv420p
  -vf "scale='if(gt(iw,1080),1080,iw)':-2"
  -movflags +faststart
)

if [[ -n "$HAS_AUDIO" ]]; then
  FFMPEG_ARGS+=(-c:a aac -b:a 96k)
else
  FFMPEG_ARGS+=(-an)
fi

FFMPEG_ARGS+=("$OUTPUT")

ffmpeg "${FFMPEG_ARGS[@]}"

OUTPUT_SIZE_MB=$(du -m "$OUTPUT" | cut -f1)
echo "Wrote ${OUTPUT} (${OUTPUT_SIZE_MB}MB)"

if [[ "$OUTPUT_SIZE_MB" -gt 15 ]]; then
  echo "Output is still large; re-encoding with stronger compression..."
  TMP="${OUTPUT}.tmp.mp4"
  if [[ -n "$HAS_AUDIO" ]]; then
    ffmpeg -y -i "$OUTPUT" \
      -c:v libx264 -preset slow -crf 30 -profile:v main -pix_fmt yuv420p \
      -movflags +faststart -c:a aac -b:a 64k \
      "$TMP"
  else
    ffmpeg -y -i "$OUTPUT" \
      -c:v libx264 -preset slow -crf 30 -profile:v main -pix_fmt yuv420p \
      -movflags +faststart -an \
      "$TMP"
  fi
  mv "$TMP" "$OUTPUT"
  OUTPUT_SIZE_MB=$(du -m "$OUTPUT" | cut -f1)
  echo "Re-encoded to ${OUTPUT_SIZE_MB}MB"
fi

echo "Done. Product Scout uses /videos/product-scout-walkthrough.mp4"
