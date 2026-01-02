import os
import time
from io import BytesIO
import fitz  # PyMuPDF
import img2pdf
from PIL import Image
from pdf2image import convert_from_path
from concurrent.futures import ProcessPoolExecutor, as_completed

# ----------------------------- Configuration -----------------------------

PDF_DIRECTORY = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/Newfolder'
PROCESSED_DIRECTORY = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/processed'

DPI = 600           # Effective rendering DPI in pdf2image (can be adjusted)
TARGET_WIDTH = 2000 # We tell pdf2image to scale to ~2000 px wide
MAX_WORKERS = os.cpu_count() or 4

IMAGE_FORMAT = 'TIFF'
COMPRESSION = 'group4'  # Monochrome Group4 compression

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

def convert_pdf_page_to_tiff_in_memory(
    pdf_path, 
    page_number, 
    dpi=DPI, 
    target_width=TARGET_WIDTH
):
    """
    Convert a single PDF page to an in-memory, 1-bit monochrome TIFF (Group4).
    No disk I/O is performed. Returns (page_index, tiff_bytes) or (page_index, None) on error.
    """

    page_index = page_number + 1  # for display/logging
    
    try:
        # 1) Convert page to image (in memory) using pdf2image with poppler's native scaling:
        #    size=(target_width, None) forces the width ~2000px, adjusting height automatically.
        #    grayscale=True -> pdf2image will render in grayscale internally.
        images = convert_from_path(
            pdf_path,
            dpi=dpi,
            grayscale=True,
            first_page=page_index,
            last_page=page_index,
            size=(target_width, None),  # Poppler scales to ~2000 px wide
            fmt='ppm',                  # 'ppm' is often faster in memory than TIFF
            single_file=True
        )

        if not images:
            raise ValueError(f"No image returned for page {page_index} of '{pdf_path}'.")

        # 2) Get the first (and only) image
        image = images[0]
        
        # 3) Convert to 1-bit monochrome. 
        #    If needed, you can chain a separate resize() call. However, 
        #    since we already sized via pdf2image, we skip the Pillow resize step.
        monochrome_image = image.convert('1', dither=Image.NONE)

        # 4) Save to a BytesIO as TIFF/Group4
        tiff_buffer = BytesIO()
        monochrome_image.save(tiff_buffer, format=IMAGE_FORMAT, compression=COMPRESSION)

        # 5) Print success
        print(f"Processed page {page_index}")
        return (page_index, tiff_buffer.getvalue())  # Return raw bytes

    except Exception as e:
        print(f"Error processing page {page_index}: {e}")
        return (page_index, None)

def process_pdf_in_memory(pdf_path):
    """
    Processes a single PDF entirely in memory:
    1. Reads page count via PyMuPDF.
    2. Converts each page to 1-bit Group4 TIFF bytes in parallel.
    3. Combines the in-memory TIFF bytes into a single PDF (still in memory).
    4. Returns the final PDF bytes (or None on error).
    """
    base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    print(f"Processing '{base_name}' in memory...")

    start_time = time.time()
    page_count = 0
    
    try:
        # 1) Determine number of pages using PyMuPDF
        with fitz.open(pdf_path) as doc:
            page_count = doc.page_count

        if page_count == 0:
            print(f"No pages found in '{base_name}'.")
            return None

        # 2) Prepare concurrent tasks
        tasks = []
        with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
            for p in range(page_count):
                tasks.append(executor.submit(convert_pdf_page_to_tiff_in_memory, pdf_path, p, DPI, TARGET_WIDTH))

            # Gather results (page_number, tiff_bytes)
            tiff_pages = []
            for future in as_completed(tasks):
                page_idx, tiff_data = future.result()
                if tiff_data is not None:
                    tiff_pages.append((page_idx, tiff_data))

        if not tiff_pages:
            print(f"No TIFF data produced for '{base_name}'.")
            return None

        # 3) Sort by page index, so we combine them in correct order
        tiff_pages_sorted = sorted(tiff_pages, key=lambda x: x[0])
        tiff_bytes_list = [data for (_, data) in tiff_pages_sorted]

        # 4) Combine in memory using img2pdf
        final_pdf_buffer = BytesIO()
        final_pdf_buffer.write(img2pdf.convert(tiff_bytes_list))
        final_pdf_buffer.seek(0)  # reset pointer

        end_time = time.time()
        total_time = end_time - start_time
        avg_time_per_page = total_time / page_count if page_count else 0

        print(f"Finished processing '{base_name}'.")
        print(f"  Total processing time: {total_time:.2f} sec.")
        print(f"  Average time per page: {avg_time_per_page:.2f} sec.\n")

        # Return the final PDF bytes
        return final_pdf_buffer.getvalue()

    except Exception as e:
        print(f"An error occurred while processing '{base_name}': {e}")
        return None

def main():
    """
    Main function to process all PDFs in the specified directory, 
    storing final PDFs on disk (but all intermediate steps in memory).
    """
    start_time = time.time()

    # Gather PDFs
    pdf_files = [
        os.path.join(PDF_DIRECTORY, f)
        for f in os.listdir(PDF_DIRECTORY)
        if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(PDF_DIRECTORY, f))
    ]
    if not pdf_files:
        print(f"No PDF files found in '{PDF_DIRECTORY}'. Exiting.")
        return

    print(f"Found {len(pdf_files)} PDF(s) to process.\n")

    # Ensure output directory exists
    os.makedirs(PROCESSED_DIRECTORY, exist_ok=True)

    # Process each PDF and save final PDF
    for pdf_path in pdf_files:
        final_pdf_bytes = process_pdf_in_memory(pdf_path)
        if final_pdf_bytes is not None:
            # Write final PDF to disk
            base_name = os.path.splitext(os.path.basename(pdf_path))[0]
            out_path = os.path.join(PROCESSED_DIRECTORY, f"{base_name}.pdf")
            with open(out_path, "wb") as f:
                f.write(final_pdf_bytes)
            print(f"Saved final PDF: {out_path}\n")

    total_time = time.time() - start_time
    print(f"All PDFs processed in {total_time:.2f} seconds total.")

if __name__ == "__main__":
    main()
