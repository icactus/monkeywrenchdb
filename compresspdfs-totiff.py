
# import os
# import subprocess

# pdf_directory = 'C:/xampp/htdocs/synpdf_182/smallerpdfs/Newfolder'
# for filename in os.listdir(pdf_directory):
#     if filename.endswith('.pdf'):
#         pdf_path = os.path.join(pdf_directory, filename)
#         image_path = pdf_path.replace('.pdf', '.tif')
#         subprocess.run(['magick', '-density', '600', pdf_path, '-resize', '2000x', '-quality', '100', image_path])
        
#         # Deskew the image
#         subprocess.run(['magick', image_path, '-deskew', '40%', image_path])
        
#         subprocess.run(['magick', image_path, '-monochrome', '-compress', 'Group4', image_path])

# # Execute the command line command using subprocess
# for filename in os.listdir(pdf_directory):
#     if filename.endswith('.tif'):
#         tif_file = os.path.join(pdf_directory, filename)
#         pdf_file = tif_file.replace('.tif', '.pdf')
#         subprocess.run(['magick', tif_file, pdf_file])
#         # Remove the .tif file after converting it back to .pdf
#         os.remove(tif_file)

# import os
# import subprocess
# from PyPDF2 import PdfReader, PdfWriter

# pdf_directory = 'C:/xampp/htdocs/synpdf_182/smallerpdfs/Newfolder'
# temp_directory = 'C:/xampp/htdocs/synpdf_182/smallerpdfs/temp'

# # Create a temporary directory to store the TIFF files
# os.makedirs(temp_directory, exist_ok=True)

# # Loop through the PDF directory and split each PDF
# for filename in os.listdir(pdf_directory):
#     if filename.endswith('.pdf'):
#         pdf_path = os.path.join(pdf_directory, filename)
#         image_base_name = os.path.splitext(filename)[0]  # Get the base name without extension
        
#         # Extract each page of the PDF as a separate PDF file
#         with open(pdf_path, 'rb') as pdf_file:
#             pdf = PdfReader(pdf_file)
#             for page_number, page in enumerate(pdf.pages):
#                 output_filename = f'{temp_directory}/{image_base_name}-page{page_number + 1:03d}.pdf'
#                 print(f"Extracting page {page_number+1} to {output_filename}")
                
#                 # Create a new PDF writer and add the page to it
#                 output_pdf = PdfWriter()
#                 output_pdf.add_page(page)
                
#                 # Save the output PDF file
#                 with open(output_filename, 'wb') as output_file:
#                     output_pdf.write(output_file)

# # Loop through the temp directory and convert each page to TIFF
# for filename in os.listdir(temp_directory):
#     if filename.endswith('.pdf'):
#         pdf_path = os.path.join(temp_directory, filename)
#         image_base_name = os.path.splitext(filename)[0]  # Get the base name without extension
        
#         # Convert each page to TIFF
#         tiff_output_filename = f'{temp_directory}/{image_base_name}.tif'
#         print(f"Converting {tiff_output_filename}")
#         subprocess.run(['magick', '-density', '600', pdf_path, '-deskew', '40%', '+repage', '-resize', '4000x', '-quality', '100', tiff_output_filename])
#         subprocess.run(['magick', '-density', '300', tiff_output_filename, '-resize', '2000x', '-monochrome', '-compress', 'Group4', tiff_output_filename])

#         os.remove(pdf_path)

# # Combine the TIFF files into one PDF
# subprocess.run(['magick', f'{temp_directory}/*.tif', os.path.join(pdf_directory, 'combined.pdf')])

# # Clean up the temporary TIFF files
# for filename in os.listdir(temp_directory):
#     if filename.endswith('.tif'):
#         tif_file = os.path.join(temp_directory, filename)
#         os.remove(tif_file)

# # Remove the temporary directory
# os.rmdir(temp_directory)

import os
import subprocess
from PyPDF2 import PdfReader, PdfWriter

pdf_directory = 'C:/xampp/htdocs/synpdf_182/smallerpdfs/Newfolder'
temp_directory = 'C:/xampp/htdocs/synpdf_182/smallerpdfs/temp'
processed_directory = 'C:/xampp/htdocs/synpdf_182/smallerpdfs/processed'

# Create directories if they don't exist
os.makedirs(temp_directory, exist_ok=True)
os.makedirs(processed_directory, exist_ok=True)

# Loop through the PDF directory and handle each PDF
for filename in os.listdir(pdf_directory):
    if filename.endswith('.pdf' or '.PDF'):
        pdf_path = os.path.join(pdf_directory, filename)
        image_base_name = os.path.splitext(filename)[0]  # Get the base name without extension

        # Extract each page of the PDF as a separate PDF file
        with open(pdf_path, 'rb') as pdf_file:
            pdf = PdfReader(pdf_file)
            for page_number, page in enumerate(pdf.pages):
                output_filename = f'{temp_directory}/{image_base_name}-page{page_number + 1:03d}.pdf'
                print(f"Extracting page {page_number+1} to {output_filename}")

                # Create a new PDF writer and add the page to it
                output_pdf = PdfWriter()
                output_pdf.add_page(page)

                # Save the output PDF file
                with open(output_filename, 'wb') as output_file:
                    output_pdf.write(output_file)

        # Now, convert the extracted pages to TIFF
        for page_filename in os.listdir(temp_directory):
            if page_filename.startswith(image_base_name) and page_filename.endswith('.pdf'):
                pdf_page_path = os.path.join(temp_directory, page_filename)
                
                # Convert each page to TIFF
                #USEFUL OTHER THINGS:  '-kuwahara', '2', ALSO '-deskew', '40%', '+repage',
                tiff_output_filename = f'{temp_directory}/{os.path.splitext(page_filename)[0]}.tif'
                print(f"Converting {tiff_output_filename}")
                subprocess.run(['magick', '-density', '600', pdf_page_path, '-resize', '4000x', '-quality', '100', tiff_output_filename])
                subprocess.run(['magick', '-density', '300', tiff_output_filename, '-resize', '2000x', '-monochrome', '-compress', 'Group4', tiff_output_filename])

                os.remove(pdf_page_path)

        # After handling a single PDF, combine the TIFF files into one PDF and save it to the processed directory
        processed_pdf_path = os.path.join(processed_directory, f'{image_base_name}.pdf')
        subprocess.run(['magick', f'{temp_directory}/*.tif', processed_pdf_path])

        # Clean up the temporary TIFF files
        for page_filename in os.listdir(temp_directory):
            if page_filename.startswith(image_base_name) and page_filename.endswith('.tif'):
                tif_file = os.path.join(temp_directory, page_filename)
                os.remove(tif_file)
