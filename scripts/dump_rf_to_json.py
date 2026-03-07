import json

def rf_to_json(rf, feature_names=None):
    trees = []
    for tree_idx, est in enumerate(rf.estimators_):
        tree = est.tree_
        
        def node_to_dict(node_id):
            if tree.children_left[node_id] == tree.children_right[node_id]: # Leaf node
                return {
                    "v": tree.value[node_id].tolist()
                }
            else:
                return {
                    "f": int(tree.feature[node_id]), # Python int
                    "t": float(tree.threshold[node_id]),
                    "l": node_to_dict(tree.children_left[node_id]),
                    "r": node_to_dict(tree.children_right[node_id])
                }
        trees.append(node_to_dict(0))
        
    return json.dumps(trees)

