import re
from tkinter import Tk

########## THIS SEEMS USELESS - SYNPDF OVERRIDES #############
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

def normalize(match):
    max_val = 1999
    new_max = 1000
    num = float(match.group())
    normalized_num = (num/max_val)*new_max
    return str(round(normalized_num, 1))

# Normalize the numbers in 'cs' and 'bxs' lists
normalized_string = re.sub(r'\b\d+\.?\d*\b', lambda x: normalize(x), code)

print(normalized_string)
r.clipboard_clear()
r.clipboard_append(normalized_string)
r.update()    
