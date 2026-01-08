#!/usr/bin/env python3
"""
Convert a PDF to a PDF of JPG images at 2500px wide.
Based on the optimized compresspdfs script.

Usage:
    python pdf-to-jpg-pdf.py input.pdf [output.pdf]
    
If output.pdf is not specified, it will be saved as input_jpg.pdf
"""

import os
import sys
import time
from io import BytesIO
import fitz  # PyMuPDF
import img2pdf
from PIL import Image
from pdf2image import convert_from_path
from concurrent.futures import ProcessPoolExecutor, as_completed

# ----------------------------- Configuration -----------------------------

DPI = 300           # Rendering DPI (higher = better quality before resize)
TARGET_WIDTH = 2000 # Output width in pixels
JPEG_QUALITY = 50   # JPEG quality (1-100, higher = better quality, larger file)
MAX_WORKERS = os.cpu_count() or 4

# ------------------------------------------------------------------------

def get_resampling_filter():
    """Get the best available Pillow resampling filter."""
    try:
        return Image.Resampling.LANCZOS  # Pillow >=10
    except AttributeError:
        try:
            return Image.LANCZOS        # Pillow <10
        except AttributeError:
            return Image.ANTIALIAS

RESAMPLE_FILTER = get_resampling_filter()

def convert_pdf_page_to_jpg_in_memory(
    pdf_path, 
    page_number, 
    dpi=DPI, 
    target_width=TARGET_WIDTH,
    quality=JPEG_QUALITY
):
    """
    Convert a single PDF page to an in-memory JPEG image.
    No disk I/O is performed. Returns (page_index, jpg_bytes) or (page_index, None) on error.
    """

    page_index = page_number + 1  # for display/logging (1-based)
    
    try:
        # 1) Convert page to image (in memory) using pdf2image with poppler's native scaling:
        #    size=(target_width, None) forces the width to target_width, adjusting height automatically.
        images = convert_from_path(
            pdf_path,
            dpi=dpi,
            first_page=page_index,
            last_page=page_index,
            size=(target_width, None),  # Poppler scales to target width
            fmt='ppm',                  # 'ppm' is often faster in memory
            single_file=True
        )

        if not images:
            raise ValueError(f"No image returned for page {page_index} of '{pdf_path}'.")

        # 2) Get the first (and only) image
        image = images[0]
        
        # 3) Convert to RGB if necessary (JPEG doesn't support RGBA)
        if image.mode in ('RGBA', 'LA', 'P'):
            # Create white background and paste
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if 'A' in image.mode else None)
            image = background
        elif image.mode != 'RGB':
            image = image.convert('RGB')

        # 4) Save to a BytesIO as JPEG
        jpg_buffer = BytesIO()
        image.save(jpg_buffer, format='JPEG', quality=quality, optimize=True)

        # 5) Print success
        print(f"Processed page {page_index}")
        return (page_index, jpg_buffer.getvalue())  # Return raw bytes

    except Exception as e:
        print(f"Error processing page {page_index}: {e}")
        return (page_index, None)

def process_pdf_to_jpg_pdf(pdf_path, output_path=None):
    """
    Processes a single PDF entirely in memory:
    1. Reads page count via PyMuPDF.
    2. Converts each page to JPG bytes in parallel.
    3. Combines the in-memory JPG bytes into a single PDF (still in memory).
    4. Saves the final PDF to disk.
    """
    base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    
    if output_path is None:
        output_dir = os.path.dirname(pdf_path) or '.'
        output_path = os.path.join(output_dir, f"{base_name}_jpg.pdf")
    
    print(f"Processing '{base_name}' -> '{output_path}'")
    print(f"  Target width: {TARGET_WIDTH}px")
    print(f"  JPEG quality: {JPEG_QUALITY}")

    start_time = time.time()
    page_count = 0
    
    try:
        # 1) Determine number of pages using PyMuPDF
        with fitz.open(pdf_path) as doc:
            page_count = doc.page_count

        if page_count == 0:
            print(f"No pages found in '{base_name}'.")
            return None

        print(f"  Pages: {page_count}")

        # 2) Prepare concurrent tasks
        tasks = []
        with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
            for p in range(page_count):
                tasks.append(executor.submit(
                    convert_pdf_page_to_jpg_in_memory, 
                    pdf_path, p, DPI, TARGET_WIDTH, JPEG_QUALITY
                ))

            # Gather results (page_number, jpg_bytes)
            jpg_pages = []
            for future in as_completed(tasks):
                page_idx, jpg_data = future.result()
                if jpg_data is not None:
                    jpg_pages.append((page_idx, jpg_data))

        if not jpg_pages:
            print(f"No JPG data produced for '{base_name}'.")
            return None

        # 3) Sort by page index, so we combine them in correct order
        jpg_pages_sorted = sorted(jpg_pages, key=lambda x: x[0])
        jpg_bytes_list = [data for (_, data) in jpg_pages_sorted]

        # 4) Combine in memory using img2pdf
        final_pdf_bytes = img2pdf.convert(jpg_bytes_list)

        # 5) Write to disk
        with open(output_path, 'wb') as f:
            f.write(final_pdf_bytes)

        end_time = time.time()
        total_time = end_time - start_time
        avg_time_per_page = total_time / page_count if page_count else 0

        # Get file sizes
        input_size = os.path.getsize(pdf_path) / (1024 * 1024)  # MB
        output_size = os.path.getsize(output_path) / (1024 * 1024)  # MB

        print(f"\nFinished processing '{base_name}'.")
        print(f"  Input size:  {input_size:.2f} MB")
        print(f"  Output size: {output_size:.2f} MB")
        print(f"  Total time:  {total_time:.2f} sec")
        print(f"  Avg per page: {avg_time_per_page:.2f} sec")

        return output_path

    except Exception as e:
        print(f"An error occurred while processing '{base_name}': {e}")
        import traceback
        traceback.print_exc()
        return None

def main():
    """
    Main function - takes input PDF and optional output path from command line.
    """
    if len(sys.argv) < 2:
        print("Usage: python pdf-to-jpg-pdf.py input.pdf [output.pdf]")
        print("\nConverts a PDF to a PDF of JPG images at 2500px wide.")
        print("If output.pdf is not specified, saves as input_jpg.pdf")
        sys.exit(1)

    input_pdf = sys.argv[1]
    output_pdf = sys.argv[2] if len(sys.argv) > 2 else None

    if not os.path.exists(input_pdf):
        print(f"Error: Input file '{input_pdf}' not found.")
        sys.exit(1)

    if not input_pdf.lower().endswith('.pdf'):
        print(f"Warning: Input file doesn't have .pdf extension.")

    result = process_pdf_to_jpg_pdf(input_pdf, output_pdf)
    
    if result:
        print(f"\nSuccess! Output saved to: {result}")
    else:
        print("\nFailed to process PDF.")
        sys.exit(1)

if __name__ == "__main__":
    main()
