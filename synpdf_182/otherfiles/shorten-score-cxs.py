import re
from tkinter import Tk

print("Please paste your code here. Enter an empty line to finish input.")
lines = []
while True:
    line = input()
    if line:
        lines.append(line)
    else:
        break
s = "\n".join(lines)

#Clipboard prep - create Tkinter object and prevent window opening
r = Tk()
r.withdraw()


pattern = r'("cs":\[([\d]+),)((.|\n)*?)(([\d]+)\])'

def replacer(match):
    return match.group(1) + match.group(5)

result = re.sub(pattern, replacer, s)


print(result)


r.clipboard_clear()
r.clipboard_append(result)
r.update()    
