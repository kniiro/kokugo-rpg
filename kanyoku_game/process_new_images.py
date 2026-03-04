from rembg import remove
from PIL import Image
import os

def main():
    mapping = {
        "enemy1_3d_1772636824160.png": "enemy1.png",
        "enemy2_3d_1772636841125.png": "enemy2.png",
        "enemy3_3d_1772636857429.png": "enemy3.png",
        "enemy4_3d_1772636869623.png": "enemy4.png",
        "enemy5_3d_1772636882223.png": "enemy5.png",
        "enemy6_3d_1772636906861.png": "enemy6.png",
        "enemy7_3d_1772636921454.png": "enemy7.png",
        "enemy8_3d_1772636936176.png": "enemy8.png",
        "enemy9_3d_1772636951311.png": "enemy9.png",
        "enemy10_3d_1772636966403.png": "enemy10.png"
    }
    
    src_dir = r"C:\Users\niiro\.gemini\antigravity\brain\4ced800f-9485-44a5-a826-7718162634a5"
    dest_dir = r"c:\Users\niiro\OneDrive\ドキュメント\python_project\kanyoku_game\images"
    
    for src_name, dest_name in mapping.items():
        src_path = os.path.join(src_dir, src_name)
        dest_path = os.path.join(dest_dir, dest_name)
        
        if not os.path.exists(src_path):
            print(f"File not found: {src_path}")
            continue
            
        print(f"Removing background from {src_name}...")
        img = Image.open(src_path)
        # We can also crop the image as DALL-E tends to put small objects in large canvas
        out = remove(img)
        
        # Trim transparent edges
        bbox = out.getbbox()
        if bbox:
            out = out.crop(bbox)
            
        out.save(dest_path)
        print(f"Saved to {dest_path}")

if __name__ == "__main__":
    main()
