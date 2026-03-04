from rembg import remove
from PIL import Image
import os

def main():
    img_dir = "images"
    backup_dir = "images_original"
    
    if not os.path.exists(backup_dir):
        os.makedirs(backup_dir)
        
    for i in range(1, 11):
        filename = f"enemy{i}.png"
        in_path = os.path.join(img_dir, filename)
        backup_path = os.path.join(backup_dir, filename)
        
        if not os.path.exists(in_path):
            continue
            
        print(f"Processing {filename}...")
        
        # Backup original
        if not os.path.exists(backup_path):
            import shutil
            shutil.copy2(in_path, backup_path)
            
        img = Image.open(in_path)
        out = remove(img)
        out.save(in_path)
        print(f"Saved transparent version to {in_path}")

if __name__ == "__main__":
    main()
