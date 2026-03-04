#!/usr/bin/env python3
"""
Image Generation Script using Nano Banana (Gemini) models via Chat Completions API

Uses $OPENAI_BASE_URL and $OPENAI_API_KEY environment variables.

Usage:
    python generate_image.py "A photo of a sunset over mountains" --output sunset.png
    python generate_image.py "Infographic about climate change" --model gemini-3-pro-image-preview --aspect 16:9
    python generate_image.py "Edit this image to add a rainbow" --input photo.jpg --output edited.png
"""

import argparse
import base64
import mimetypes
import os
import sys
from pathlib import Path

import requests


def load_input_image(image_path: str) -> dict:
    """
    Load an image file and convert it to OpenAI image_url format.

    Args:
        image_path: Path to the image file

    Returns:
        dict in OpenAI image_url content format

    Raises:
        SystemExit: If file cannot be read or is not a valid image
    """
    path = Path(image_path)
    if not path.exists():
        print(f"Error: Input image not found: {image_path}", file=sys.stderr)
        sys.exit(1)

    # Determine MIME type
    mime_type, _ = mimetypes.guess_type(str(path))
    if not mime_type or not mime_type.startswith("image/"):
        # Default to common types based on extension
        ext_to_mime = {
            ".jpg": "image/jpeg",
            ".jpeg": "image/jpeg",
            ".png": "image/png",
            ".gif": "image/gif",
            ".webp": "image/webp",
            ".bmp": "image/bmp",
        }
        mime_type = ext_to_mime.get(path.suffix.lower(), "image/png")

    try:
        with open(path, "rb") as f:
            image_bytes = f.read()
    except IOError as e:
        print(f"Error reading image file {image_path}: {e}", file=sys.stderr)
        sys.exit(1)

    base64_data = base64.b64encode(image_bytes).decode("utf-8")
    data_url = f"data:{mime_type};base64,{base64_data}"

    return {
        "type": "image_url",
        "image_url": {
            "url": data_url,
        },
    }


def generate_image(
    prompt: str,
    model: str = "gemini-3.1-flash-image-preview",
    output_path: str | None = None,
    aspect_ratio: str = "1:1",
    image_size: str = "1K",
    input_images: list[str] | None = None,
) -> str:
    """
    Generate an image using Nano Banana (Gemini) models via Chat Completions API.

    Args:
        prompt: Text description of the image to generate
        model: Model to use (default: gemini-2.5-flash-image)
        output_path: Path to save the generated image (auto-generated if not provided)
        aspect_ratio: Aspect ratio (1:1, 16:9, 9:16, 4:3, 3:4)
        image_size: Image size (1K, 2K)
        input_images: List of paths to input images to include in the request

    Returns:
        Path to the saved image file

    Raises:
        SystemExit: If API call fails or no image is generated
    """
    base_url = os.environ["OPENAI_BASE_URL"]
    api_key = os.environ["OPENAI_API_KEY"]

    # Strip trailing /v1 if present to avoid double /v1/v1 in URL
    base = base_url.rstrip('/')
    if base.endswith('/v1'):
        base = base[:-3]
    url = f"{base}/v1/chat/completions"

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # Build message content with text and optional input images
    content_parts = []

    # Add input images first (if any)
    if input_images:
        for img_path in input_images:
            content_parts.append(load_input_image(img_path))
            print(f"Added input image: {img_path}")

    # Build enhanced prompt with format specifications
    # Since generationConfig conflicts with LiteLLM thinking config, we use prompt hints
    format_hints = []
    if aspect_ratio != "1:1":
        format_hints.append(f"aspect ratio {aspect_ratio}")
    if image_size == "512px":
        format_hints.append("small 512px resolution")
    elif image_size == "2K":
        format_hints.append("high resolution 2K")

    enhanced_prompt = prompt
    if format_hints:
        enhanced_prompt = f"[Image format: {', '.join(format_hints)}] {prompt}"

    # Add the text prompt
    content_parts.append({"type": "text", "text": enhanced_prompt})

    # Build request payload - use simple chat completion format that works with LiteLLM
    # Note: generationConfig is Gemini-native but conflicts with LiteLLM's thinking config
    # Simple chat completions work reliably as LiteLLM handles Gemini API translation
    payload = {
        "model": model,
        "messages": [
            {
                "role": "user",
                "content": content_parts,
            }
        ],
    }

    # For models with thinking enabled in LiteLLM, specify thinking budget for image gen
    # This prevents conflicts with generationConfig while allowing thinking to work
    if "-pro-" in model or "-flash-" in model:
        payload["thinking"] = {"type": "enabled", "budget_tokens": 1024}

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=120)
        response.raise_for_status()
    except requests.exceptions.Timeout:
        print("Error: Request timed out", file=sys.stderr)
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"Error calling API: {e}", file=sys.stderr)
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text[:1000]}", file=sys.stderr)
        sys.exit(1)

    result = response.json()

    # Extract image from response
    image_data = None
    choices = result.get("choices", [])

    if choices:
        message = choices[0].get("message", {})

        # Check for images array (Gemini format via LiteLLM)
        images = message.get("images", [])
        if images:
            for img in images:
                if isinstance(img, dict):
                    url_data = img.get("image_url", {}).get("url", "")
                    if url_data.startswith("data:image"):
                        image_data = url_data.split(",", 1)[1]
                        break

        # Fallback: check content field
        if not image_data:
            content = message.get("content")

            # Content can be string or list
            if isinstance(content, str):
                # Check if it's base64 image data or data URL
                if content.startswith("data:image"):
                    image_data = content.split(",", 1)[1] if "," in content else content
                elif len(content) > 1000:
                    # Might be raw base64
                    try:
                        base64.b64decode(content[:100])
                        image_data = content
                    except Exception:
                        pass

            elif isinstance(content, list):
                # Look for image parts in the content list
                for part in content:
                    if isinstance(part, dict):
                        part_type = part.get("type")

                        if part_type == "image_url":
                            url_data = part.get("image_url", {}).get("url", "")
                            if url_data.startswith("data:image"):
                                image_data = url_data.split(",", 1)[1]
                                break

                        elif "inline_data" in part:
                            image_data = part["inline_data"].get("data")
                            break

                        elif "image" in part:
                            img = part.get("image", {})
                            image_data = img.get("data") if isinstance(img, dict) else img
                            break

                        elif part_type == "text" and part.get("text", "").startswith("data:image"):
                            image_data = part["text"].split(",", 1)[1]
                            break

    if not image_data:
        print("Error: No image data found in response", file=sys.stderr)
        print(f"Response keys: {list(result.keys())}", file=sys.stderr)
        if choices:
            print(f"Content type: {type(choices[0].get('message', {}).get('content'))}", file=sys.stderr)
        sys.exit(1)

    # Decode and save image
    try:
        image_bytes = base64.b64decode(image_data)
    except Exception as e:
        print(f"Error decoding base64 image: {e}", file=sys.stderr)
        sys.exit(1)

    # Generate output path if not provided
    if not output_path:
        import hashlib
        import time

        hash_input = f"{prompt}{time.time()}".encode()
        file_hash = hashlib.md5(hash_input).hexdigest()[:8]
        output_path = f"generated_image_{file_hash}.png"

    # Ensure output directory exists
    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    # Write image file
    with open(output_file, "wb") as f:
        f.write(image_bytes)

    print(f"Image saved to: {output_file.absolute()}")
    return str(output_file.absolute())


def main():
    parser = argparse.ArgumentParser(
        description="Generate images using Nano Banana (Gemini) models",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "A sunset over mountains"
  %(prog)s "Professional infographic about AI" --model gemini-3-pro-image-preview --aspect 16:9
  %(prog)s "Logo design for tech startup" --output logo.png --size 2K
  %(prog)s "Add a rainbow to this photo" --input photo.jpg --output edited.png
  %(prog)s "Combine these images into a collage" --input img1.jpg --input img2.jpg
        """,
    )

    parser.add_argument("prompt", help="Text description of the image to generate")
    parser.add_argument(
        "--model",
        default="gemini-3.1-flash-image-preview",
        help="Model to use (default: gemini-3.1-flash-image-preview, alt: gpt-image-1.5)",
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output file path (auto-generated if not provided)",
    )
    parser.add_argument(
        "--aspect",
        default="1:1",
        choices=["1:1", "16:9", "9:16", "4:3", "3:4"],
        help="Aspect ratio (default: 1:1)",
    )
    parser.add_argument(
        "--size",
        default="1K",
        choices=["512px", "1K", "2K"],
        help="Image size (default: 1K)",
    )
    parser.add_argument(
        "--input",
        "-i",
        action="append",
        dest="input_images",
        metavar="IMAGE",
        help="Input image file path (can be specified multiple times for multiple images)",
    )

    args = parser.parse_args()

    generate_image(
        prompt=args.prompt,
        model=args.model,
        output_path=args.output,
        aspect_ratio=args.aspect,
        image_size=args.size,
        input_images=args.input_images,
    )


if __name__ == "__main__":
    main()
