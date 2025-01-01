import os
import time
import img2pdf
import shutil
from pdf2image import convert_from_path
from PIL import Image
from concurrent.futures import ProcessPoolExecutor, as_completed
import fitz  # PyMuPDF

# ----------------------------- Configuration -----------------------------

# Define directories
PDF_DIRECTORY = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/Newfolder'
TEMP_DIRECTORY = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/temp'
PROCESSED_DIRECTORY = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/processed'

# DPI setting for pdf2image
DPI = 600  # Reverted back to 600 for higher resolution

# Target width in pixels
TARGET_WIDTH = 2000

# Maximum number of worker processes
MAX_WORKERS = os.cpu_count() or 4

# Image format and compression
IMAGE_FORMAT = 'tiff'
COMPRESSION = 'group4'  # Group4 compression for monochrome TIFF

# ----------------------------- Helper Functions -----------------------------

def get_resampling_filter():
    """
    Determines the appropriate resampling filter based on the Pillow version.

    Returns:
        int: The resampling filter to use.
    """
    try:
        # For Pillow >=10.0.0
        return Image.Resampling.LANCZOS
    except AttributeError:
        try:
            # For Pillow <10.0.0
            return Image.LANCZOS
        except AttributeError:
            # Fallback if LANCZOS is not available
            return Image.ANTIALIAS

RESAMPLE_FILTER = get_resampling_filter()

def clear_temp_directory(temp_directory):
    """
    Clears the temporary directory by deleting all its contents.

    Parameters:
        temp_directory (str): Path to the temporary directory.

    Returns:
        None
    """
    try:
        if os.path.exists(temp_directory):
            shutil.rmtree(temp_directory)
            print(f"Cleared temporary directory: '{temp_directory}'")
        os.makedirs(temp_directory, exist_ok=True)
        print(f"Created temporary directory: '{temp_directory}'")
    except Exception as e:
        print(f"Failed to clear/create temporary directory '{temp_directory}': {e}")
        raise

def convert_pdf_page_to_tiff(pdf_path, image_base_name, page_number, temp_directory, target_width=TARGET_WIDTH, dpi=DPI):
    """
    Converts a single PDF page to a 1-bit monochrome TIFF with Group4 compression.

    Parameters:
        pdf_path (str): Path to the input PDF file.
        image_base_name (str): Base name for the output image files.
        page_number (int): Page number to process (0-based index).
        temp_directory (str): Directory to store temporary TIFF files.
        target_width (int): Desired width in pixels for the output image.
        dpi (int): DPI setting for pdf2image conversion.

    Returns:
        tuple: (page_number, tiff_output_path) if successful, (page_number, None) otherwise.
    """
    try:
        # Convert specific page to image using pdf2image
        images = convert_from_path(
            pdf_path,
            dpi=dpi,
            first_page=page_number + 1,
            last_page=page_number + 1,
            fmt=IMAGE_FORMAT,
            output_folder=temp_directory,
            output_file=f'{image_base_name}-page{page_number + 1:03d}',
            grayscale=True,
            thread_count=1,
            single_file=True
        )

        if not images:
            raise ValueError(f"No image returned for page {page_number + 1} of '{pdf_path}'.")

        image = images[0]

        # Resize image to target width while maintaining aspect ratio
        width_percent = (target_width / float(image.size[0]))
        height_size = int((float(image.size[1]) * float(width_percent)))
        resized_image = image.resize((target_width, height_size), RESAMPLE_FILTER)

        # Convert to 1-bit monochrome without dithering to prevent stippling
        monochrome_image = resized_image.convert('1', dither=Image.NONE)  # '1' mode with no dithering

        # Define output TIFF path
        tiff_output_filename = f'{image_base_name}-page{page_number + 1:03d}.tif'
        tiff_output_path = os.path.join(temp_directory, tiff_output_filename)

        # Save as TIFF with Group4 compression
        monochrome_image.save(tiff_output_path, format=IMAGE_FORMAT, compression=COMPRESSION)

        # Print success message
        print(f"Processed page {page_number + 1}")

        return (page_number + 1, tiff_output_path)
    except Exception as e:
        print(f"Error processing page {page_number + 1}: {e}")
        return (page_number + 1, None)

def combine_tiffs_to_pdf(tiff_files, output_pdf_path):
    """
    Combines multiple TIFF files into a single PDF using img2pdf.

    Parameters:
        tiff_files (list of str): List of paths to TIFF files.
        output_pdf_path (str): Path to the output PDF file.

    Returns:
        bool: True if successful, False otherwise.
    """
    try:
        # Ensure all TIFF files exist
        for tiff in tiff_files:
            if not os.path.isfile(tiff):
                raise FileNotFoundError(f"TIFF file '{tiff}' not found.")

        # Open TIFF files in binary mode and combine them into a PDF
        with open(output_pdf_path, "wb") as f:
            f.write(img2pdf.convert(tiff_files))

        print(f"Successfully created '{output_pdf_path}'.")
        return True
    except Exception as e:
        print(f"Error combining TIFFs into PDF '{output_pdf_path}': {e}")
        return False

def process_pdf(pdf_path, temp_directory, processed_directory):
    """
    Processes a single PDF: converts each page to TIFF and combines them into a processed PDF.

    Parameters:
        pdf_path (str): Path to the input PDF file.
        temp_directory (str): Directory to store temporary TIFF files.
        processed_directory (str): Directory to store processed PDF files.

    Returns:
        None
    """
    image_base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    print(f"Processing '{image_base_name}'...")

    start_time = time.time()

    try:
        # Determine number of pages using PyMuPDF (fitz)
        with fitz.open(pdf_path) as doc:
            page_count = doc.page_count

        # Prepare arguments for each page
        args_list = [
            (pdf_path, image_base_name, page_number, temp_directory)
            for page_number in range(page_count)
        ]

        tiff_files = []
        processed_pages = 0

        # Process pages in parallel
        with ProcessPoolExecutor(max_workers=MAX_WORKERS) as executor:
            futures = {
                executor.submit(convert_pdf_page_to_tiff, *args): args
                for args in args_list
            }
            for future in as_completed(futures):
                page_num, tiff_file = future.result()
                if tiff_file:
                    tiff_files.append(tiff_file)
                    processed_pages += 1
                else:
                    pass  # Already handled in convert_pdf_page_to_tiff

        if not tiff_files:
            print(f"No TIFF files were created for '{image_base_name}'. Skipping PDF assembly.\n")
            return

        # Sort TIFF files based on page number
        tiff_files_sorted = sorted(
            tiff_files,
            key=lambda x: int(os.path.splitext(os.path.basename(x))[0].split('-page')[-1])
        )

        # Define output PDF path
        output_pdf_path = os.path.join(processed_directory, f'{image_base_name}.pdf')

        # Combine TIFFs into PDF
        combine_tiffs_to_pdf(tiff_files_sorted, output_pdf_path)

        # Clean up TIFF files
        for tiff_file in tiff_files_sorted:
            try:
                os.remove(tiff_file)
            except Exception as e:
                print(f"Failed to remove temporary file '{tiff_file}': {e}")

        end_time = time.time()
        total_time = end_time - start_time
        avg_time_per_page = total_time / page_count if page_count else 0

        print(f"Finished processing '{image_base_name}'.")
        print(f"Total processing time: {total_time:.2f} seconds.")
        print(f"Average time per page: {avg_time_per_page:.2f} seconds.\n")

    except Exception as e:
        print(f"An error occurred while processing '{image_base_name}': {e}\n")

def main():
    """
    Main function to process all PDFs in the specified directory.
    """
    start_time = time.time()

    # Clear temporary directory before each run
    try:
        clear_temp_directory(TEMP_DIRECTORY)
    except Exception as e:
        print(f"Failed to clear temporary directory '{TEMP_DIRECTORY}': {e}")
        return

    # List all PDF files in the input directory
    pdf_files = [
        os.path.join(PDF_DIRECTORY, f)
        for f in os.listdir(PDF_DIRECTORY)
        if f.lower().endswith('.pdf') and os.path.isfile(os.path.join(PDF_DIRECTORY, f))
    ]

    if not pdf_files:
        print(f"No PDF files found in '{PDF_DIRECTORY}'. Exiting.")
        return

    print(f"Found {len(pdf_files)} PDF(s) to process.\n")

    # Process each PDF sequentially
    for pdf_path in pdf_files:
        process_pdf(pdf_path, TEMP_DIRECTORY, PROCESSED_DIRECTORY)

    end_time = time.time()
    total_time = end_time - start_time
    print(f"All PDFs processed in {total_time:.2f} seconds.")

if __name__ == "__main__":
    main()
