import os
import subprocess

def rescale_pdf_with_ghostscript(input_pdf, output_pdf, width_pts=595, height_pts=802):
    """
    Use Ghostscript to rescale PDF pages to specified width and height in points.
    Scales the content to fit the new page size.
    """
    try:
        subprocess.run([
            'gs',
            '-sDEVICE=pdfwrite',
            '-dCompatibilityLevel=1.4',
            '-dPDFSETTINGS=/prepress',
            f'-dDEVICEWIDTHPOINTS={width_pts}',
            f'-dDEVICEHEIGHTPOINTS={height_pts}',
            '-dFIXEDMEDIA',
            '-dPDFFitPage',
            '-dNOPAUSE',
            '-dBATCH',
            f'-sOutputFile={output_pdf}',
            input_pdf
        ], check=True)
        print(f"  Rescaled PDF: {output_pdf}")
    except subprocess.CalledProcessError as e:
        print(f"  Error rescaling {input_pdf}: {e}")

def main():
    # Directory paths
    pdf_directory = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/Newfolder'
    processed_directory = '/home/jengaship/monkeywrenchdb/synpdf_182/smallerpdfs/processed'
    os.makedirs(processed_directory, exist_ok=True)

    # Process each PDF in the directory
    for filename in os.listdir(pdf_directory):
        if filename.lower().endswith('.pdf'):
            input_pdf = os.path.join(pdf_directory, filename)
            output_pdf = os.path.join(processed_directory, filename)
            print(f"Rescaling PDF with Ghostscript: {filename}")
            rescale_pdf_with_ghostscript(input_pdf, output_pdf, width_pts=595, height_pts=802)
            print(f"Finished rescaling {filename}\n")

if __name__ == "__main__":
    main()
