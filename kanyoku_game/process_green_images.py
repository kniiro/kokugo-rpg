from rembg import remove
from PIL import Image
import os

def process_image(src_path, dest_path):
    print(f"Processing {src_path} -> {dest_path}")
    img = Image.open(src_path).convert("RGBA")
    
    # Use rembg to remove the green background
    out = remove(img)
    
    # Trim
    bbox = out.getbbox()
    if bbox:
        out = out.crop(bbox)
        
    out.save(dest_path, "PNG")
    print(f"Saved to {dest_path}")

if __name__ == "__main__":
    process_image(r"C:\Users\niiro\.gemini\antigravity\brain\4ced800f-9485-44a5-a826-7718162634a5\enemy1_3d_green_1772638163108.png", 
                  r"c:\Users\niiro\OneDrive\ドキュメント\python_project\kanyoku_game\images\enemy1.png")
    process_image(r"C:\Users\niiro\.gemini\antigravity\brain\4ced800f-9485-44a5-a826-7718162634a5\enemy2_3d_green_1772638179433.png", 
                  r"c:\Users\niiro\OneDrive\ドキュメント\python_project\kanyoku_game\images\enemy2.png")
