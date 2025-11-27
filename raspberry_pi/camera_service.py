# camera_service.py
from picamera2 import Picamera2
import base64
import time
import io
from PIL import Image

class CameraService:
    def __init__(self, width=1280, height=720):
        self.picam2 = Picamera2()
        config = self.picam2.create_still_configuration(
            main={"size": (width, height)}
        )
        self.picam2.configure(config)
        self.picam2.start()
        time.sleep(1)

    def capture_base64(self):
        try:
            frame = self.picam2.capture_array()

            # Convert to JPEG in-memory
            buffer = io.BytesIO()
            img = Image.fromarray(frame)
            img.save(buffer, format="JPEG")
            jpeg_bytes = buffer.getvalue()

            return base64.b64encode(jpeg_bytes).decode("utf-8")

        except Exception as e:
            print("[CAMERA ERROR]", e)
            return ""