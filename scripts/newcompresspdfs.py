import os
import subprocess
from PyPDF2 import PdfReader, PdfWriter
from concurrent.futures import ProcessPoolExecutor

# Directories
pdf_directory = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/Newfolder'
temp_directory = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/temp'
processed_directory = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/processed'

# Ensure directories exist
os.makedirs(temp_directory, exist_ok=True)
os.makedirs(processed_directory, exist_ok=True)

def extract_and_convert_pdf_page(args):
    pdf_path, output_pdf_path, temp_directory, image_base_name, page_number = args
    try:
        # Extract PDF page
        pdf = PdfReader(pdf_path)
        page = pdf.pages[page_number]
        output_filename = f'{temp_directory}/{image_base_name}-page{page_number + 1:03d}.pdf'
        output_pdf = PdfWriter()
        output_pdf.add_page(page)
        with open(output_filename, 'wb') as output_file:
            output_pdf.write(output_file)
        
        # Convert to TIFF using global 'magick'
        tiff_output_filename = f'{temp_directory}/{image_base_name}-page{page_number + 1:03d}.tif'
        subprocess.run(['magick', '-verbose', '-density', '600', output_filename, '-background', 'white', '-alpha', 'remove', '-quality', '90', tiff_output_filename], check=True)
        subprocess.run(['magick', '-verbose', '-density', '300', tiff_output_filename, '-resize', '2000x', '-monochrome', '-compress', 'Group4', tiff_output_filename], check=True)
        
        # Clean up
        os.remove(output_filename)
        return tiff_output_filename
    except subprocess.CalledProcessError as e:
        print(f"Error processing page {page_number + 1} of {pdf_path}: {e}")
        return None
    except Exception as e:
        print(f"Unexpected error processing page {page_number + 1} of {pdf_path}: {e}")
        return None

def process_pdf_file(pdf_path, temp_directory, processed_directory):
    image_base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    pdf = PdfReader(pdf_path)
    page_count = len(pdf.pages)

    # Prepare arguments for parallel processing
    args = [(pdf_path, pdf_path, temp_directory, image_base_name, page_number) for page_number in range(page_count)]

    # Determine the number of workers
    num_cpus = os.cpu_count() or 4
    max_workers = max(1, num_cpus - 1)  # Adjust as needed

    # Process each page in parallel with limited workers
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        tiff_files = list(executor.map(extract_and_convert_pdf_page, args))
    
    # Filter out any failed conversions
    tiff_files = [tiff for tiff in tiff_files if tiff is not None]
    
    if not tiff_files:
        print(f"No TIFF files were created for {pdf_path}. Skipping.")
        return
    
    # Combine TIFF files into one PDF
    processed_pdf_path = os.path.join(processed_directory, f'{image_base_name}.pdf')
    try:
        subprocess.run(['magick', f'{temp_directory}/{image_base_name}-page*.tif', processed_pdf_path], check=True)
    except subprocess.CalledProcessError as e:
        print(f"Error combining TIFF files into PDF for {pdf_path}: {e}")
        return
    
    # Clean up TIFF files
    for tiff_file in tiff_files:
        os.remove(tiff_file)

# Main processing loop
for filename in os.listdir(pdf_directory):
    if filename.lower().endswith('.pdf'):
        pdf_path = os.path.join(pdf_directory, filename)
        print(f"Processing {pdf_path}...")
        process_pdf_file(pdf_path, temp_directory, processed_directory)
        print(f"Finished processing {pdf_path}.")
