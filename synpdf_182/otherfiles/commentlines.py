# Original data
metric_arr = [1263, {"cxs":[{"cs":[295.5,306.9,317.0,327.1,338.5],"xs":{"x1":152.8,"x2":1193.5}}, ...], "bxs":[...]}]

# Extract the 'cxs' list
cxs_list = metric_arr[1]["cxs"]

# Initialize a counter
counter = 1

# Iterate over the 'cxs' list
for cxs_item in cxs_list:
    # Extract the 'cs' list
    cs_list = cxs_item["cs"]
    
    # Iterate over the 'cs' list
    for i in range(len(cs_list)):
        # Add a newline and a comment to each value
        cs_list[i] = f"{cs_list[i]}\n# {counter}"
        
        # Increment the counter
        counter += 1
    
    # Replace the original 'cs' list with the modified one
    cxs_item["cs"] = cs_list

# Replace the original 'cxs' list with the modified one
metric_arr[1]["cxs"] = cxs_list
