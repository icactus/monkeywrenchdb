from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
import time

# Replace 'YOUR_API_KEY' with your actual YouTube Data API key
api_key = 'AIzaSyBM3hG5DRZFXivbw9IJL0QWY9oFBwUcx6E'
youtube = build('youtube', 'v3', developerKey=api_key)

# Function to chunk the video ID list
def chunk_list(lst, n):
    """Yield successive n-sized chunks from lst."""
    for i in range(0, len(lst), n):
        yield lst[i:i + n]

# Function to handle API requests with exponential backoff
def make_request_with_backoff(api_request, max_retries=5):
    for attempt in range(max_retries):
        try:
            return api_request.execute()
        except HttpError as e:
            if e.resp.status in [403, 503]:  # Quota exceeded or service unavailable
                sleep_time = 2 ** attempt  # Exponential backoff
                print(f"Request quota exceeded or service unavailable, retrying in {sleep_time} seconds.")
                time.sleep(sleep_time)
            else:
                print(f"An HTTP error occurred: {e.resp.status} {e.content}")
                break  # Break the loop on other errors
    print("Failed to retrieve data after multiple attempts.")
    return None

# Read YouTube video IDs from file
file_path = 'youtube_ids.txt'
with open(file_path, 'r') as file:
    youtube_ids = [line.strip() for line in file if line.strip()]

# Split the YouTube IDs into chunks of 50
id_chunks = list(chunk_list(youtube_ids, 50))

# Process each chunk
for chunk in id_chunks:
    request = youtube.videos().list(
        part="id,snippet,status",
        id=','.join(chunk)
    )
    response = make_request_with_backoff(request)
    
    if response:
        found_ids = set(video['id'] for video in response.get('items', []))
        missing_ids = set(chunk) - found_ids
        
        print("Available Videos:")
        for video in response.get('items', []):
            print(f"ID: {video['id']}, Title: {video['snippet']['title']}")
        
        print("\nMissing or Removed Videos:")
        for id in missing_ids:
            print(f"ID: {id}")
