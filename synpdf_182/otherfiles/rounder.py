import re

def round_numbers_in_string(s):
    def replace_with_rounded(match):
        rounded = round(float(match.group()), 1)
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

# Call the function with the user input
print(round_numbers_in_string(code))
