import json

with open('synpdf_182/editmode/test-page-ground-truth-barlines.json') as f:
    data = json.load(f)

for st in data:
    if st['system_index'] == 3:
        for b in st['barlines']:
            if b['x'] in [661, 808]:
                print(f"System 3: Found suspect GT barline at x={b['x']}")
    elif st['system_index'] == 4:
        for b in st['barlines']:
            if b['x'] in [288]:
                print(f"System 4: Found suspect GT barline at x={b['x']}")
