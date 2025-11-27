#!/usr/bin/env python3

from picamera2 import Picamera2
from PIL import Image
import io
import time

print("Initializing camera...")
picam2 = Picamera2()

# Choose still image config (best for photo capture)
config = picam2.create_still_configuration()
picam2.configure(config)

picam2.start()
time.sleep(1)  # allow camera to warm up

print("Capturing image...")

# Capture as numpy array
frame = picam2.capture_array()

# Convert to image and save
img = Image.fromarray(frame)
img.save("test.jpg", format="JPEG", quality=90)

print("Saved image: test.jpg")