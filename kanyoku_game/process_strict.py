from rembg import remove
from PIL import Image
import os
import numpy as np

def process_image_strict(src_path, dest_path):
    print(f"Strict processing: {src_path} -> {dest_path}")
    img = Image.open(src_path).convert("RGBA")
    
    # Remove background
    out = remove(img)
    
    # Convert to numpy to manipulate channels
    data = np.array(out)
    
    # Force all pixels with alpha below a threshold to be completely transparent [0,0,0,0]
    # This kills any "ghost" checkerboards or edge artifacts
    threshold = 120
    mask = data[:, :, 3] < threshold
    data[mask] = [0, 0, 0, 0]
    
    # For remaining pixels, if they are VERY close to white or gray (often where artifacts are), 
    # we can't easily fix without harming the subject, but thresholding alpha usually suffices.
    
    clean_out = Image.fromarray(data)
    
    # Trim
    bbox = clean_out.getbbox()
    if bbox:
        clean_out = clean_out.crop(bbox)
        
    clean_out.save(dest_path, "PNG")
    print(f"Saved strict version to {dest_path}")

if __name__ == "__main__":
    brain_dir = r"C:\Users\niiro\.gemini\antigravity\brain\4ced800f-9485-44a5-a826-7718162634a5"
    dest_dir = r"c:\Users\niiro\OneDrive\ドキュメント\python_project\kanyoku_game\images"
    
    mapping = {
        1: "enemy1_v3_nanobanana_1772638303204.png",
        2: "enemy2_v3_nanobanana_1772638319802.png",
        3: "enemy3_v3_nanobanana_1772638333922.png",
        4: "enemy4_v3_nanobanana_1772638348321.png"
    }
    
    for i, src_name in mapping.items():
        src_path = os.path.join(brain_dir, src_name)
        dest_path = os.path.join(dest_dir, f"enemy{i}.png")
        if os.path.exists(src_path):
            process_image_strict(src_path, dest_path)
