import json

data = [
    
]



for item in data:
    #item['t'] = round(item['t'] + 4537.20, 2)
    item['mix'] += 140

json_data = json.dumps(data, separators=(',', ':'))
print(json_data)

