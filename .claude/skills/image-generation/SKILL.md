---
name: image-generation
description: Images Generation via an AI model
when_to_use: When you need to generate an image, or a presentable infographics, or a picture slide based on some inputs or context
dependencies: openai, requests (pre-installed in sandbox)
helper_scripts: yes
---

As an agent operating within the SecondStack platform, you have API access to a private LLM API endpoint via LiteLLM that provides powerful image generation models. You have env variables available.
- $OPENAI_BASE_URL (private API Base URL to our LiteLLM instance)
- $OPENAI_API_KEY

**Before running any script:** load env vars and set SKILL_DIR:
```bash
set -a && source "$(git rev-parse --show-toplevel)/.env" && set +a
SKILL_DIR=".claude/skills/image-generation"
```

Image generation models can generate an image from scratch (based on a prompt) or accept existing images as inputs which will influence the generation and may be used for "image editing", or to generate a stylistically consistent series of images.

## Image Generation Models

### Default: Gemini 3.1 Flash Image

Model: `gemini-3.1-flash-image-preview`

Fast and capable image generation model. Supports variable aspect ratio. Use it by default.

```bash
python "$SKILL_DIR/scripts/generate_image_litellm_chat_completions.py" \
  "Professional infographic showing climate change statistics with charts and icons, blue color scheme. Statistics data (such and such, details provided)" \
  --model gemini-3.1-flash-image-preview \
  --aspect 16:9 \
  --size 2K \
  --output climate_infographic.png
```

**With Input Images (for editing or style reference):**
```bash
python "$SKILL_DIR/scripts/generate_image_litellm_chat_completions.py" \
  "Add a rainbow to this landscape photo" \
  --input landscape.jpg \
  --model gemini-3.1-flash-image-preview \
  --output landscape_with_rainbow.png

# Multiple input images
python "$SKILL_DIR/scripts/generate_image_litellm_chat_completions.py" \
  "Create a collage combining these images" \
  --input photo1.jpg --input photo2.jpg \
  --output collage.png
```

**Arguments:**
- `prompt` (required): Text description of the image to generate
- `--model`: Model to use
- `--output`: Output file path
- `--aspect`: Aspect ratio hint - `1:1`, `16:9`, `9:16`, `4:3`, `3:4` (default: `1:1`)
- `--size`: Image size hint - `512px`, `1K`, `2K` (default: `1K`)
- `--input`, `-i`: Input image file path (can be specified multiple times for image editing or style transfer)

Note: For Gemini models, aspect ratio and size are passed as prompt hints. The model will do its best to honor them but results may vary.

### Alternative: GPT Image 1.5

Model: `gpt-image-1.5` via LiteLLM Image Generation API

Supports wide (1536x1024), tall (1024x1536), and square (1024x1024) sizes. Quality tiers: low, medium, high.

```bash
python "$SKILL_DIR/scripts/generate_image_litellm_image_generations.py" \
  "A ship sailing on a calm ocean at sunset, photorealistic" \
  --size 1536x1024 \
  --quality high \
  --output ship.png
```

**With Input Image (for editing):**
```bash
python "$SKILL_DIR/scripts/generate_image_litellm_image_generations.py" \
  "Add dramatic clouds to this sky" \
  --input photo.jpg \
  --output edited_photo.png
```

**Arguments:**
- `prompt` (required): Text description of the image to generate
- `--model`: Model to use (default: `gpt-image-1.5`)
- `--output`: Output file path
- `--size`: Image size - `1024x1024`, `1024x1536`, `1536x1024`
- `--quality`: Image quality - `low`, `medium`, `high`
- `--format`: Output format - `png`, `webp`, `jpeg` (default: `png`)
- `--background`: Background type - `transparent`, `opaque`, `auto` (default: `auto`)
- `--input`, `-i`: Input image file path for editing (only first image is used)

## Tips

- Provide detailed and nuanced prompts to the image generation model