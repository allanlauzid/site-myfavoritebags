import cv2
import numpy as np

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def process_logo():
    # Define control points for the gradient map
    points = [
        (0, hex_to_rgb('#111111')),      # deep shadow
        (30, hex_to_rgb('#262626')),     # dark tone (text/title)
        (110, hex_to_rgb('#9C7A34')),    # midtone (accent old gold)
        (180, hex_to_rgb('#D4AF37')),    # lighter gold
        (255, hex_to_rgb('#FFFFFF'))     # pure shine highlight
    ]

    # Create LUT
    lut = np.zeros((256, 3), dtype=np.uint8)
    for i in range(256):
        # find the segment
        for j in range(len(points) - 1):
            if points[j][0] <= i <= points[j+1][0]:
                p1 = points[j]
                p2 = points[j+1]
                t = (i - p1[0]) / float(p2[0] - p1[0]) if p2[0] != p1[0] else 0
                r = int(p1[1][0] * (1 - t) + p2[1][0] * t)
                g = int(p1[1][1] * (1 - t) + p2[1][1] * t)
                b = int(p1[1][2] * (1 - t) + p2[1][2] * t)
                lut[i] = [r, g, b]
                break

    # Load image with alpha channel
    filepath = 'LogoMFL_B - Copia.webp'
    img = cv2.imread(filepath, cv2.IMREAD_UNCHANGED)
    if img is None:
        print("Error loading image")
        return

    if img.shape[2] == 3:
        alpha = np.full((img.shape[0], img.shape[1], 1), 255, dtype=np.uint8)
        img = np.concatenate((img, alpha), axis=2)

    b, g, r, a = cv2.split(img)

    # Calculate luminance
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    
    # Normalize luminance only for non-transparent parts
    mask = a > 10
    if np.any(mask):
        lum_min = lum[mask].min()
        lum_max = lum[mask].max()
        if lum_max > lum_min:
            lum_norm = np.zeros_like(lum, dtype=np.float32)
            lum_norm[mask] = (lum[mask] - lum_min) / (lum_max - lum_min) * 255
            lum = np.clip(lum_norm, 0, 255).astype(np.uint8)
        else:
            lum = lum.astype(np.uint8)
    else:
        lum = lum.astype(np.uint8)

    # Apply LUT
    mapped = lut[lum]
    mapped_r = mapped[:,:,0]
    mapped_g = mapped[:,:,1]
    mapped_b = mapped[:,:,2]

    # Increase shine by adjusting gamma slightly
    # Not strictly necessary if the LUT does it, but we can boost it
    # We'll rely on the normalized LUT for now

    out = cv2.merge((mapped_b, mapped_g, mapped_r, a))
    cv2.imwrite('LogoMFL_B_OuroVelho_Transparente.webp', out)

    # Save a version with the background #FAF7F1
    bg_color = hex_to_rgb('#FAF7F1')
    bg = np.zeros_like(img[:,:,:3])
    bg[:] = (bg_color[2], bg_color[1], bg_color[0]) # cv2 uses BGR

    alpha_float = a.astype(float) / 255.0
    alpha_float = np.expand_dims(alpha_float, axis=2)

    fg = cv2.merge((mapped_b, mapped_g, mapped_r))
    out_bg = (fg * alpha_float + bg * (1 - alpha_float)).astype(np.uint8)
    cv2.imwrite('LogoMFL_B_OuroVelho_Fundo.webp', out_bg)
    print("Success")

if __name__ == '__main__':
    process_logo()
