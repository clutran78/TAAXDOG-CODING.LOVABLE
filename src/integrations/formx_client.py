import requests
import os
import mimetypes
from dotenv import load_dotenv

load_dotenv()

FORMFAI_API_ENDPOINT = "https://worker.formextractorai.com/v2/extract"

def get_env_variable(name, required=True):
    value = os.getenv(name)
    if required and not value:
        raise ValueError(f"Environment variable '{name}' is not set.")
    return value

def build_headers(token: str, extractor_id: str, extra_headers: dict = None) -> dict:
    headers = {
        "accept": "application/json",
        "X-WORKER-TOKEN": token,
        "X-WORKER-EXTRACTOR-ID": extractor_id,
        "X-WORKER-ENCODING": "raw",
        "X-WORKER-PDF-DPI": "150",
        "X-WORKER-ASYNC": "false",
        "X-WORKER-AUTO-ADJUST-IMAGE-SIZE": "true",
        "X-WORKER-OUTPUT-OCR": "false",
        "X-WORKER-PROCESSING-MODE": "per-page",
    }
    if extra_headers:
        headers.update(extra_headers)
    return headers

def extract_data_from_image(image_path: str, token=None, extractor_id=None, extra_headers=None) -> dict:
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found at: {image_path}")

    token = token or get_env_variable("FORMFAI_ACCESS_TOKEN")
    extractor_id = extractor_id or get_env_variable("FORMFAI_EXTRACTOR_ID")

    content_type, _ = mimetypes.guess_type(image_path)
    content_type = content_type or 'image/jpeg'

    headers = build_headers(token, extractor_id, extra_headers)

    try:
        with open(image_path, 'rb') as image_file:
            response = requests.post(
                FORMFAI_API_ENDPOINT,
                headers=headers,
                data=image_file
            )
            response.raise_for_status()
            return response.json()

    except requests.exceptions.RequestException as e:
        print(f"[ERROR] API Request failed: {e}")
        raise
    except ValueError as e:
        print(f"[ERROR] Failed to parse API response: {e}")
        raise ValueError(f"Invalid JSON received: {response.text}") from e
    except Exception as e:
        print(f"[ERROR] Unexpected error: {e}")
        raise

# Example usage
if __name__ == "__main__":
    try:
        image_path = 'path/to/your/test_receipt.jpg'  # Update with your path
        result = extract_data_from_image(image_path)
        import json
        print(json.dumps(result, indent=2))
    except Exception as e:
        print(f"Extraction failed: {e}")
