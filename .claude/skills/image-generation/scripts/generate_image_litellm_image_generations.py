#!/usr/bin/env python3
"""
Image Generation Script using GPT Image models via LiteLLM Image Generation API

Uses $OPENAI_BASE_URL and $OPENAI_API_KEY environment variables.

Usage:
    python generate_image_gpt.py "A ship sailing on the ocean" --output ship.png
    python generate_image_gpt.py "Futuristic cityscape at night"
    python generate_image_gpt.py "Edit this image to add clouds" --input photo.jpg --output edited.png
"""

import argparse
import base64
import mimetypes
import os
import sys
from pathlib import Path

import requests


def load_input_image_base64(image_path: str) -> str:
    """
    Load an image file and return as base64 data URL string.
    """
    path = Path(image_path)
    if not path.exists():
        print(f"Error: Input image not found: {image_path}", file=sys.stderr)
        sys.exit(1)

    # Determine MIME type
    mime_type, _ = mimetypes.guess_type(str(path))
    if not mime_type or not mime_type.startswith("image/"):
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
    return f"data:{mime_type};base64,{base64_data}"


def load_input_image_responses(image_path: str) -> dict:
    """
    Load an image file for Responses API format (undocumented, kept for compatibility).
    """
    data_url = load_input_image_base64(image_path)
    return {
        "type": "input_image",
        "image_url": data_url,
    }


def generate_image_gpt(
    prompt: str,
    model: str = "gpt-image-1.5",
    output_path: str | None = None,
    size: str = "auto",
    quality: str = "auto",
    output_format: str = "png",
    background: str = "auto",
    input_images: list[str] | None = None,
    use_responses_api: bool = False,
    reasoning_effort: str = "low",
) -> str:
    """
    Generate an image using GPT Image models via LiteLLM Image Generation API.
    """
    base_url = os.environ["OPENAI_BASE_URL"]
    api_key = os.environ["OPENAI_API_KEY"]

    # Strip trailing /v1 if present to avoid double /v1/v1 in URL
    base = base_url.rstrip('/')
    if base.endswith('/v1'):
        base = base[:-3]

    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }

    # Use Responses API if explicitly requested (undocumented)
    if use_responses_api:
        return _generate_via_responses_api(
            prompt=prompt,
            model=model,
            output_path=output_path,
            size=size,
            quality=quality,
            output_format=output_format,
            background=background,
            input_images=input_images,
            reasoning_effort=reasoning_effort,
            base=base,
            headers=headers,
        )

    # Use LiteLLM Image Generation API (default)
    if input_images:
        # Image editing: use /v1/images/edits
        url = f"{base}/v1/images/edits"

        # Load first input image as base64 data URL
        image_data_url = load_input_image_base64(input_images[0])
        print(f"Using input image: {input_images[0]}")

        if len(input_images) > 1:
            print(f"Warning: Only first input image is used for editing, ignoring {len(input_images) - 1} additional images")

        payload = {
            "model": model,
            "prompt": prompt,
            "image": image_data_url,
        }
    else:
        # Image generation from scratch: use /v1/images/generations
        url = f"{base}/v1/images/generations"

        payload = {
            "model": model,
            "prompt": prompt,
        }

    # Add optional parameters (skip 'auto' values to let model decide)
    if size and size != "auto":
        payload["size"] = size
    if quality and quality != "auto":
        payload["quality"] = quality
    if background and background != "auto":
        payload["background"] = background

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=300)
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

    # Extract image from LiteLLM response (format: {data: [{b64_json: ...} or {url: ...}]})
    image_data = None
    data_items = result.get("data", [])

    for item in data_items:
        # Check for b64_json (preferred)
        if item.get("b64_json"):
            image_data = item["b64_json"]
            break
        # Check for URL
        if item.get("url"):
            # Download image from URL
            try:
                img_response = requests.get(item["url"], timeout=60)
                img_response.raise_for_status()
                image_bytes = img_response.content
                # Skip base64 decode, write directly
                return _save_image_bytes(image_bytes, output_path, prompt, output_format)
            except Exception as e:
                print(f"Error downloading image from URL: {e}", file=sys.stderr)
                continue

    if not image_data:
        print("Error: No image data found in response", file=sys.stderr)
        print(f"Response: {result}", file=sys.stderr)
        sys.exit(1)

    # Clean up image data if it has a data URL prefix
    if isinstance(image_data, str) and image_data.startswith("data:image"):
        image_data = image_data.split(",", 1)[1]

    # Decode and save image
    try:
        image_bytes = base64.b64decode(image_data)
    except Exception as e:
        print(f"Error decoding base64 image: {e}", file=sys.stderr)
        sys.exit(1)

    return _save_image_bytes(image_bytes, output_path, prompt, output_format)


def _save_image_bytes(image_bytes: bytes, output_path: str | None, prompt: str, output_format: str) -> str:
    """Save image bytes to file and return the path."""
    if not output_path:
        import hashlib
        import time

        hash_input = f"{prompt}{time.time()}".encode()
        file_hash = hashlib.md5(hash_input).hexdigest()[:8]
        ext = output_format if output_format in ["png", "webp", "jpeg"] else "png"
        output_path = f"generated_image_gpt_{file_hash}.{ext}"

    output_file = Path(output_path)
    output_file.parent.mkdir(parents=True, exist_ok=True)

    with open(output_file, "wb") as f:
        f.write(image_bytes)

    print(f"Image saved to: {output_file.absolute()}")
    return str(output_file.absolute())


def _generate_via_responses_api(
    prompt: str,
    model: str,
    output_path: str | None,
    size: str,
    quality: str,
    output_format: str,
    background: str,
    input_images: list[str] | None,
    reasoning_effort: str,
    base: str,
    headers: dict,
) -> str:
    """
    Generate image via Responses API (undocumented, kept for compatibility).
    """
    url = f"{base}/v1/responses"

    # Build image_generation tool with parameters
    image_gen_tool = {
        "type": "image_generation",
        "size": size,
        "quality": quality,
        "output_format": output_format,
        "background": background,
    }

    # Build message content with text and optional input images
    content_parts = []

    if input_images:
        for img_path in input_images:
            content_parts.append(load_input_image_responses(img_path))
            print(f"Added input image: {img_path}")

    content_parts.append({"type": "input_text", "text": prompt})

    payload = {
        "model": model,
        "input": [{"role": "user", "content": content_parts}],
        "reasoning": {"effort": reasoning_effort, "summary": "auto"},
        "tools": [image_gen_tool],
    }

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=300)
        response.raise_for_status()
    except requests.exceptions.Timeout:
        print("Error: Request timed out", file=sys.stderr)
        sys.exit(1)
    except requests.exceptions.RequestException as e:
        print(f"Error calling API: {e}", file=sys.stderr)
        if hasattr(e, "response") and e.response is not None:
            print(f"Response: {e.response.text[:500]}", file=sys.stderr)
        sys.exit(1)

    result = response.json()

    # Extract image from Responses API output
    image_data = None
    output_items = result.get("output", [])

    for item in output_items:
        item_type = item.get("type")
        if item_type == "image_generation_call":
            image_data = item.get("result")
            break
        if item_type == "message":
            content = item.get("content", [])
            for part in content:
                if isinstance(part, dict):
                    part_type = part.get("type")
                    if part_type == "output_image":
                        image_data = part.get("image", {}).get("data")
                        break
                    elif part_type == "image":
                        image_data = part.get("data") or part.get("image", {}).get("data")
                        break
            if image_data:
                break

    if not image_data:
        for item in output_items:
            if "image" in item:
                img = item.get("image", {})
                image_data = img.get("data") or img.get("b64_json")
                if image_data:
                    break

    if not image_data:
        print("Error: No image data found in response", file=sys.stderr)
        print(f"Response structure: {list(result.keys())}", file=sys.stderr)
        if output_items:
            print(f"Output types: {[item.get('type') for item in output_items]}", file=sys.stderr)
        sys.exit(1)

    if isinstance(image_data, str) and image_data.startswith("data:image"):
        image_data = image_data.split(",", 1)[1]

    try:
        image_bytes = base64.b64decode(image_data)
    except Exception as e:
        print(f"Error decoding base64 image: {e}", file=sys.stderr)
        sys.exit(1)

    return _save_image_bytes(image_bytes, output_path, prompt, output_format)


def main():
    parser = argparse.ArgumentParser(
        description="Generate images using GPT Image models via LiteLLM",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  %(prog)s "A ship sailing on the ocean"
  %(prog)s "Futuristic cityscape at night" --output city.png
  %(prog)s "Wide landscape panorama" --size 1536x1024 --quality high
  %(prog)s "Logo design" --background transparent --format png
  %(prog)s "Add clouds to this sky" --input photo.jpg --output edited.png
        """,
    )

    parser.add_argument("prompt", help="Text description of the image to generate")
    parser.add_argument(
        "--model",
        default="gpt-image-1.5",
        help="Model to use (default: gpt-image-1.5)",
    )
    parser.add_argument(
        "--output",
        "-o",
        help="Output file path (auto-generated if not provided)",
    )
    parser.add_argument(
        "--size",
        default="auto",
        choices=["1024x1024", "1024x1536", "1536x1024", "auto"],
        help="Image size (default: auto)",
    )
    parser.add_argument(
        "--quality",
        default="auto",
        choices=["low", "medium", "high", "auto"],
        help="Image quality: high ~= Nano Banana Pro, medium ~= Nano Banana Flash (default: auto)",
    )
    parser.add_argument(
        "--format",
        dest="output_format",
        default="png",
        choices=["png", "webp", "jpeg"],
        help="Output format (default: png)",
    )
    parser.add_argument(
        "--background",
        default="auto",
        choices=["transparent", "opaque", "auto"],
        help="Background type (default: auto)",
    )
    parser.add_argument(
        "--input",
        "-i",
        action="append",
        dest="input_images",
        metavar="IMAGE",
        help="Input image file path for editing (only first image is used)",
    )

    args = parser.parse_args()

    generate_image_gpt(
        prompt=args.prompt,
        model=args.model,
        output_path=args.output,
        size=args.size,
        quality=args.quality,
        output_format=args.output_format,
        background=args.background,
        input_images=args.input_images,
    )


if __name__ == "__main__":
    main()
