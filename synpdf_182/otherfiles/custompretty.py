import re
import json

lines = []
while True:
    line = input()
    if line:
        lines.append(line)
    else:
        break
text = '\n'.join(lines)

#new lines formatting
text = text.replace('\n', '')

text = text.replace('{"cs"', '\n{"cs"')

text = text.replace(',[', ',\n[')

text = text.replace(',"bxs":[', ',\n"bxs":[\n')

text = text.replace(',{"cxs":', ',\n{"cxs":')


print(text)
