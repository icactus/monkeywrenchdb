
import os
import subprocess
from PyPDF2 import PdfReader, PdfWriter
from concurrent.futures import ProcessPoolExecutor

pdf_directory = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/Newfolder'
temp_directory = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/temp'
processed_directory = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/processed'
magick_path = '/home/jengaship/monkeywrenchdb/magick'

# Ensure directories exist
os.makedirs(temp_directory, exist_ok=True)
os.makedirs(processed_directory, exist_ok=True)

def extract_and_convert_pdf_page(args):
    magick_path, pdf_path, output_pdf_path, temp_directory, image_base_name, page_number = args
    # Extract PDF page
    pdf = PdfReader(pdf_path)
    page = pdf.pages[page_number]
    output_filename = f'{temp_directory}/{image_base_name}-page{page_number + 1:03d}.pdf'
    output_pdf = PdfWriter()
    output_pdf.add_page(page)
    with open(output_filename, 'wb') as output_file:
        output_pdf.write(output_file)
    
    # Convert to TIFF 
    # other options: '-deskew', '40%', '+repage', 
    jpg_output_filename = f'{temp_directory}/{image_base_name}-page{page_number + 1:03d}.jpg'
    subprocess.run([magick_path, '-verbose', '-density', '300', output_filename, '-background', 'white', '-alpha', 'remove', '-quality', '50', jpg_output_filename])
    subprocess.run([magick_path, '-verbose', '-density', '150', jpg_output_filename, '-deskew', '40%', '+repage', '-resize', '2000x', '-compress', 'JPEG', jpg_output_filename])

    
    # Clean up
    os.remove(output_filename)
    return jpg_output_filename

def process_pdf_file(pdf_path, magick_path, temp_directory, processed_directory):
    image_base_name = os.path.splitext(os.path.basename(pdf_path))[0]
    pdf = PdfReader(pdf_path)
    page_count = len(pdf.pages)

    # Prepare arguments for parallel processing
    args = [(magick_path, pdf_path, pdf_path, temp_directory, image_base_name, page_number) for page_number in range(page_count)]

    # Process each page in parallel
    with ProcessPoolExecutor() as executor:
        tiff_files = list(executor.map(extract_and_convert_pdf_page, args))
    
    # Combine TIFF files into one PDF
    processed_pdf_path = os.path.join(processed_directory, f'{image_base_name}.pdf')
    subprocess.run([magick_path, f'{temp_directory}/{image_base_name}-page*.jpg', processed_pdf_path])

    # Clean up TIFF files
    for tiff_file in tiff_files:
        os.remove(tiff_file)

# Main processing loop
for filename in os.listdir(pdf_directory):
    if filename.lower().endswith('.pdf'):
        pdf_path = os.path.join(pdf_directory, filename)
        process_pdf_file(pdf_path, magick_path, temp_directory, processed_directory)
