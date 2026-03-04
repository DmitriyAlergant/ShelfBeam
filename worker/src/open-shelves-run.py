"""
Model: capjamesg/open-shelves (Roboflow Universe)
URL:   https://universe.roboflow.com/capjamesg/open-shelves

Runs inference on all images in src_pics/ and saves cropped book images to results/.
"""
import os
import sys
import glob
from dotenv import load_dotenv
from inference_sdk import InferenceHTTPClient, InferenceConfiguration

# Allow importing shared utils from project root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))
from utils.crop import crop_and_save

load_dotenv()

MODEL_ID     = "open-shelves/9"
SRC_PICS_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "src_pics")

client = InferenceHTTPClient(
    api_url="https://serverless.roboflow.com",
    api_key=os.environ["ROBOFLOW_API_KEY"],
)


def run(confidence: float = 0.4):
    images = glob.glob(os.path.join(SRC_PICS_DIR, "*.jpg")) + \
             glob.glob(os.path.join(SRC_PICS_DIR, "*.png"))

    if not images:
        print(f"No images found in {SRC_PICS_DIR}")
        return

    client.configure(InferenceConfiguration(confidence_threshold=confidence))
    results_dir = os.path.join(os.path.dirname(__file__), "results", f"conf_{int(confidence * 100)}")

    for image_path in sorted(images):
        print(f"Processing: {os.path.basename(image_path)}")
        result = client.infer(image_path, model_id=MODEL_ID)
        predictions = result.get("predictions", [])
        print(f"  Detected {len(predictions)} book(s)")

        saved = crop_and_save(image_path, predictions, results_dir)
        for p in saved:
            print(f"  Saved: {os.path.basename(p)}")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--confidence", type=float, default=0.4)
    args = parser.parse_args()
    run(confidence=args.confidence)
