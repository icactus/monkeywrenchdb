import os
import time
import json
import math
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from tqdm import tqdm
from dotenv import load_dotenv

# --- Setup ---
# Best practice is to keep secrets out of the code.
# 1. Create a file named .env in the same directory as your script.
# 2. Add your API key to the .env file:
#    YOUTUBE_API_KEY="AIzaSy...your...actual...key"
load_dotenv()

# --- Configuration ---
API_KEY = os.getenv('YOUTUBE_API_KEY')
# The default quota is 10,000, but can be requested to be higher.
# See your usage here: https://console.cloud.google.com/apis/dashboard
DAILY_QUOTA_LIMIT = 10000
# Cost for a videos().list call with part="id,snippet,status"
COST_PER_REQUEST = 5 
CHUNK_SIZE = 50 # Max allowed by the API
IDS_FILE_PATH = 'youtube_ids.txt'
MISSING_IDS_OUTPUT_FILE = 'missing_ids.txt'


def chunk_list(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

def make_request_with_backoff(api_request, max_retries=5):
    """Executes an API request with exponential backoff."""
    for attempt in range(max_retries + 1):
        try:
            return api_request.execute()
        except HttpError as e:
            # Try to parse the error reason for more specific handling
            try:
                error_details = json.loads(e.content.decode('utf-8'))['error']
                error_reason = error_details['errors'][0]['reason']
            except (json.JSONDecodeError, KeyError):
                error_reason = "unknown"

            print(f"\nHTTP Error: {e.resp.status}, Reason: {error_reason}")

            if error_reason == 'quotaExceeded':
                print("Daily quota has been exceeded. Cannot make more requests today.")
                print("Quota resets at Midnight Pacific Time.")
                return None # Fatal error, stop trying

            if e.resp.status in [403, 500, 503]: # Retriable errors
                if attempt < max_retries:
                    sleep_time = 2 ** attempt + 0.1 # Exponential backoff
                    print(f"Retriable error. Waiting for {sleep_time:.1f}s before retry {attempt+1}/{max_retries}...")
                    time.sleep(sleep_time)
                else:
                    print("Max retries reached. Failing the request.")
                    return None
            else: # Non-retriable errors (e.g., 400 Bad Request)
                print(f"A non-retriable HTTP error occurred: {e.content}")
                return None
    return None

def main():
    """Main function to process video IDs with a pre-flight quota check."""
    if not API_KEY:
        raise ValueError("API key not found. Please set YOUTUBE_API_KEY in your .env file.")

    try:
        with open(IDS_FILE_PATH, 'r') as file:
            youtube_ids = [line.strip() for line in file if line.strip()]
        if not youtube_ids:
            print(f"No video IDs found in {IDS_FILE_PATH}. Exiting.")
            return
    except FileNotFoundError:
        print(f"Error: The file '{IDS_FILE_PATH}' was not found.")
        return

    # --- PRE-FLIGHT QUOTA CHECK ---
    num_requests = math.ceil(len(youtube_ids) / CHUNK_SIZE)
    estimated_cost = num_requests * COST_PER_REQUEST
    
    print("--- YouTube ID Validator ---")
    print(f"Found {len(youtube_ids)} video IDs to check.")
    print(f"This will require {num_requests} API requests.")
    print(f"Estimated quota cost: {estimated_cost} units.")
    print(f"Your project's daily quota limit is ~{DAILY_QUOTA_LIMIT} units.")
    
    if estimated_cost > DAILY_QUOTA_LIMIT:
        print("\n*** WARNING: The estimated cost exceeds the default daily quota. ***")
        print("The script will likely fail with a 'quotaExceeded' error.")
        proceed = input("Do you want to proceed anyway? (y/n): ").lower()
        if proceed != 'y':
            print("Execution cancelled by user.")
            return
    
    print("-" * 30)

    youtube = build('youtube', 'v3', developerKey=API_KEY)
    id_chunks = list(chunk_list(youtube_ids, CHUNK_SIZE))
    all_missing_ids = []

    for chunk in tqdm(id_chunks, desc="Processing batches"):
        request = youtube.videos().list(
            part="id,snippet,status",
            id=','.join(chunk)
        )
        response = make_request_with_backoff(request)
        
        if response is None:
            print("\nStopping processing due to a critical API error (e.g., quota exceeded).")
            break

        found_ids = set(video['id'] for video in response.get('items', []))
        missing_ids_in_chunk = set(chunk) - found_ids
        all_missing_ids.extend(list(missing_ids_in_chunk))

    print("\n--- Processing Complete ---")
    if all_missing_ids:
        print(f"\nFound {len(all_missing_ids)} invalid or removed video IDs.")
        with open(MISSING_IDS_OUTPUT_FILE, 'w') as f:
            for missing_id in all_missing_ids:
                f.write(f"{missing_id}\n")
        print(f"A list of these IDs has been saved to '{MISSING_IDS_OUTPUT_FILE}'.")
    else:
        print("\nAll YouTube video IDs were validated successfully.")

if __name__ == '__main__':
    main()
