import os
import subprocess

pdf_directory = 'C:/xampp/htdocs/synpdf_182/smallerpdfs/Newfolder'
for filename in os.listdir(pdf_directory):
    if filename.endswith('.pdf'):
        pdf_path = os.path.join(pdf_directory, filename)
        image_path = pdf_path.replace('.pdf', '.tif')
        subprocess.run(['magick', '-density', '300', pdf_path, '-resize', '2400x', '-quality', '100', image_path])
        subprocess.run(['magick', image_path, '-monochrome', '-compress', 'Group4', image_path])

# Execute the command line command using subprocess
for filename in os.listdir(pdf_directory):
    if filename.endswith('.tif'):
        tif_file = os.path.join(pdf_directory, filename)
        pdf_file = tif_file.replace('.tif', '.pdf')
        subprocess.run(['magick', tif_file, pdf_file])
        # Remove the .tif file after converting it back to .pdf
        os.remove(tif_file)
