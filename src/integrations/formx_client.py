import os
import json
from PIL import Image
from io import BytesIO
from flask import jsonify
from google.generativeai import GenerativeModel, configure
from dotenv import load_dotenv
# Load .env variables

load_dotenv()
configure(api_key=os.environ.get('GOOGLE_API_KEY'))

model = GenerativeModel("gemini-1.5-flash")

# FormX legacy setup (optional)
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

# ✅ GEMINI 2.0 Receipt Extractor
def extract_data_from_image_with_gemini(image_path: str) -> dict:
    try:
        with Image.open(image_path) as img:
            prompt = """
            You are a receipt parser. Extract and return the following as valid JSON:
            {
              "merchant_name": string,
              "date": string (in YYYY-MM-DD format if possible),
              "time": string (optional),
              "total_amount": number,
              "category": string,
              "items": [
                {
                  "name": string,
                  "price": number
                }
              ]
            }

            Only return valid JSON with no extra commentary or formatting.
            """

            response = model.generate_content([prompt, img])
            raw_text = response.text.strip()

            # Try to extract only the JSON part (for extra safety)
            json_start = raw_text.find('{')
            json_end = raw_text.rfind('}')
            if json_start == -1 or json_end == -1:
                raise ValueError("No JSON structure found in Gemini response.")

            json_str = raw_text[json_start:json_end+1]
            data = json.loads(json_str)

            return {
                "success": True,
                "documents": [{
                    "data": data
                }]
            }
    except Exception as e:
        return {"success": False, "error": str(e)}

# Optional CLI test
if __name__ == "__main__":
    try:
        test_path = "path/to/your/test_receipt.jpg"
        result = extract_data_from_image_with_gemini(test_path)
        import json
        print(json.dumps(result, indent=2))
    except Exception as err:
        print("Error:", err)
