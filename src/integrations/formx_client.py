import requests
import os
import mimetypes
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Retrieve sensitive information from environment variables
FORMFAI_ACCESS_TOKEN = os.getenv("FORMFAI_ACCESS_TOKEN")
FORMFAI_EXTRACTOR_ID = os.getenv("FORMFAI_EXTRACTOR_ID")
FORMFAI_API_ENDPOINT = "https://worker.formextractorai.com/v2/extract"

def extract_data_from_image(image_path: str) -> dict:
    """
    Sends an image to the FormX.AI API for data extraction.

    Args:
        image_path: The local path to the image file.

    Returns:
        A dictionary containing the extracted data from the API response.

    Raises:
        FileNotFoundError: If the image_path does not exist.
        ValueError: If environment variables are not set or the API response is invalid.
        requests.exceptions.RequestException: For issues during the API request.
    """
    # Validate environment variables
    if not FORMFAI_ACCESS_TOKEN:
        raise ValueError("FORMFAI_ACCESS_TOKEN environment variable not set.")
    if not FORMFAI_EXTRACTOR_ID:
        raise ValueError("FORMFAI_EXTRACTOR_ID environment variable not set.")

    # Check if the image file exists
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"Image file not found at: {image_path}")

    # Determine the content type based on the file extension
    content_type, _ = mimetypes.guess_type(image_path)
    if not content_type:
        # Default to jpeg if type cannot be guessed
        content_type = 'image/jpeg'
        print(f"Warning: Could not determine content type for {image_path}. Defaulting to {content_type}.")

    # Prepare headers and payload
    headers = {
        'X-WORKER-TOKEN': FORMFAI_ACCESS_TOKEN,
        'X-WORKER-EXTRACTOR-ID': FORMFAI_EXTRACTOR_ID,
        'Content-Type': content_type,
    }

    try:
        # Open the image file in binary read mode
        with open(image_path, 'rb') as payload:
            # Send the POST request to the FormX.AI API
            response = requests.post(FORMFAI_API_ENDPOINT, headers=headers, data=payload)

            # Raise an exception for bad status codes (4xx or 5xx)
            response.raise_for_status()

            # Parse and return the JSON response
            return response.json()

    except requests.exceptions.RequestException as e:
        # Handle potential request errors (network issues, timeout, etc.)
        print(f"API Request failed: {e}")
        raise  # Re-raise the exception after logging
    except ValueError as e:
        # Handle JSON decoding errors
        print(f"Failed to decode API response: {e}")
        raise ValueError(f"Invalid JSON received from API: {response.text}") from e
    except Exception as e:
        # Catch any other unexpected errors during file handling or processing
        print(f"An unexpected error occurred: {e}")
        raise

# Example usage (for testing purposes):
# if __name__ == "__main__":
#     try:
#         # Make sure to create a dummy .env file with your credentials
#         # and place a test image (e.g., test_receipt.jpg) in the same directory
#         # or provide the full path.
#         image_file = 'path/to/your/test_receipt.jpg' # CHANGE THIS PATH
#         extracted_data = extract_data_from_image(image_file)
#         print("Extraction Successful:")
#         import json
#         print(json.dumps(extracted_data, indent=2))
#     except (FileNotFoundError, ValueError, requests.exceptions.RequestException) as error:
#         print(f"Extraction Failed: {error}") 