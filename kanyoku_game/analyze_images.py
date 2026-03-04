from PIL import Image

def analyze_image(path):
    img = Image.open(path).convert("RGBA")
    w, h = img.size
    print(f"{path}: {w}x{h}, mode={img.mode}")
    # Check top-left pixel color which is often the background
    bg_color = img.getpixel((0, 0))
    print(f"Top-left pixel color: {bg_color}")
    
    # Optional: simple test to see if we can do basic floodfill/chroma key
    # Let's count how many pixels match the bg color exactly
    match_count = sum(1 for p in img.getdata() if p == bg_color)
    print(f"Pixels matching bg color: {match_count} / {w*h} ({(match_count/(w*h))*100:.1f}%)")

if __name__ == "__main__":
    for i in range(1, 11):
        analyze_image(f"images/enemy{i}.png")
