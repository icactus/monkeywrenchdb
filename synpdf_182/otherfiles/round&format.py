import re
from tkinter import Tk

# Define the rounding function
def round_numbers_in_string(s):
    def replace_with_rounded(match):
        rounded = round(float(match.group()))
        return str(rounded)

    pattern = r"-?[0-9]+\.\d{2,}"
    result = re.sub(pattern, replace_with_rounded, s)
    return result

# Collect multi-line input
print("Please paste your code here. Enter an empty line to finish input.")
lines = []
while True:
    line = input()
    if line:
        lines.append(line)
    else:
        break
code = "\n".join(lines)

#Clipboard prep - create Tkinter object and prevent window opening
r = Tk()
r.withdraw()

# Apply text formatting changes
code = code.replace('\n', '')
code = code.replace('{"cs"', '\n{"cs"')
code = code.replace(',[', ',\n[')
code = code.replace(',"bxs":[', ',\n"bxs":[\n')
code = code.replace(',{"cxs":', ',\n{"cxs":')

# Apply the rounding function
rounded_code = round_numbers_in_string(code)

# Print the output##
print(rounded_code)    ##don't need to round if 1000wide
r.clipboard_clear()
r.clipboard_append(rounded_code)   #changed from (rounded_code)
r.update()    
