import numpy as np
from tkinter import Tk

def generate_points(input_str):
    # Parse the input string to get X, Y, and Z
    xy_str, z_str = input_str.split(' ')
    x_str, y_str = xy_str.split(',')
    x, y, z = map(float, [x_str, y_str, z_str])

    # Generate Z+1 points from X to Y, split evenly
    points = np.linspace(x, y, int(z + 1))

    # Round the points to 1 decimal place if necessary
    rounded_points = [round(point) for point in points]

    # Format the output as a string of numbers separated by commas
    return ','.join(map(str, rounded_points))

#Clipboard prep - create Tkinter object and prevent window opening
r = Tk()
r.withdraw()


input_str = input("Enter three numbers in the format 'X,Y Z': ")
result = generate_points(input_str)
print(result)
r.clipboard_clear()
r.clipboard_append(result)
r.update()    
