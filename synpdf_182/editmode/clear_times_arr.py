import os
import re
import shutil

# === Hard-Coded Folder Paths ===
INPUT_FOLDER = "/home/jengaship/monkeywrenchdb/synpdf_182/editmode-loadfiles/"   # <-- Replace with your input folder path
OUTPUT_FOLDER = "/home/jengaship/monkeywrenchdb/synpdf_182/editmode-loadfiles/cleaned/" # <-- Replace with your output folder path
# ==================================

def modify_js_content(content):
    # Replace times_arr with an empty array
    content, times_count = re.subn(
        r'times_arr\s*=\s*\[.*?\];', 'times_arr = [];', content, flags=re.DOTALL
    )

    # Replace lastSynced value with -1
    content, synced_count = re.subn(
        r'"lastSynced"\s*:\s*\d+', '"lastSynced": -1', content
    )

    return content, times_count, synced_count

def process_file(input_path, output_path):
    try:
        with open(input_path, 'r', encoding='utf-8') as infile:
            content = infile.read()

        modified_content, times_changed, synced_changed = modify_js_content(content)

        if times_changed > 0 or synced_changed > 0:
            # Ensure the output directory exists
            os.makedirs(os.path.dirname(output_path), exist_ok=True)

            with open(output_path, 'w', encoding='utf-8') as outfile:
                outfile.write(modified_content)
            print(f"Modified and saved: {output_path}")
        else:
            # If no changes, copy the original file
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            shutil.copy2(input_path, output_path)
            print(f"No changes needed. Copied original to: {output_path}")

    except Exception as e:
        print(f"Error processing {input_path}: {e}")

def process_folder(input_folder, output_folder):
    if not os.path.exists(input_folder):
        print(f"Input folder does not exist: {input_folder}")
        return

    for root, dirs, files in os.walk(input_folder):
        # Compute the relative path from the input folder
        rel_path = os.path.relpath(root, input_folder)
        if rel_path == '.':
            rel_path = ''
        # Compute the corresponding output folder
        current_output_folder = os.path.join(output_folder, rel_path)

        for file in files:
            if file.endswith('.js'):
                input_file_path = os.path.join(root, file)
                output_file_path = os.path.join(current_output_folder, file)
                process_file(input_file_path, output_file_path)
            else:
                # Optionally, copy non-JS files as is
                input_file_path = os.path.join(root, file)
                output_file_path = os.path.join(current_output_folder, file)
                os.makedirs(os.path.dirname(output_file_path), exist_ok=True)
                shutil.copy2(input_file_path, output_file_path)
                print(f"Copied non-JS file to: {output_file_path}")

if __name__ == "__main__":
    process_folder(INPUT_FOLDER, OUTPUT_FOLDER)
    print("Processing completed.")
