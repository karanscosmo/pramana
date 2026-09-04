import os
from PIL import Image, ImageDraw, ImageFont

os.makedirs("public/sample_docs", exist_ok=True)

def get_font(size):
    try:
        return ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", size)
    except:
        try:
            return ImageFont.truetype("/Library/Fonts/Arial.ttf", size)
        except:
            return ImageFont.load_default()

font_title = get_font(22)
font_sub = get_font(14)
font_body = get_font(16)
font_bold = get_font(18)
font_mono = get_font(20)

# 1. GENERATE DELIBERATELY ALTERED PAN CARD
w, h = 850, 540
img_pan_alt = Image.new("RGB", (w, h), color=(220, 238, 248))
draw = ImageDraw.Draw(img_pan_alt)

# Header banner
draw.rectangle([0, 0, w, 90], fill=(24, 76, 120))
draw.text((30, 18), "INCOME TAX DEPARTMENT", fill=(255, 255, 255), font=font_title)
draw.text((30, 48), "GOVERNMENT OF INDIA", fill=(210, 230, 250), font=font_sub)
draw.text((w - 240, 32), "Permanent Account Card", fill=(255, 255, 255), font=font_bold)

# Content
draw.text((50, 120), "Permanent Account Number", fill=(100, 120, 140), font=font_sub)
draw.text((50, 145), "ABCDE1234F", fill=(15, 23, 42), font=font_mono)

draw.text((50, 190), "Name on Card", fill=(100, 120, 140), font=font_sub)

# THE TAMPERED SECTION: Draw an unnatural white correction box over original name
draw.rectangle([46, 212, 380, 248], fill=(255, 255, 255), outline=(200, 200, 200))
# Misaligned, overly sharp modern text placed inside the patch
draw.text((52, 218), "VIKRAM S MALHOTRA", fill=(0, 0, 0), font=font_bold)
draw.text((390, 222), "[EDITED OVERLAY]", fill=(220, 38, 38), font=get_font(12))

draw.text((50, 270), "Father's Name", fill=(100, 120, 140), font=font_sub)
draw.text((50, 295), "MUKESH VERMA", fill=(30, 41, 59), font=font_body)

draw.text((50, 340), "Date of Birth", fill=(100, 120, 140), font=font_sub)
draw.text((50, 365), "15/06/1985", fill=(30, 41, 59), font=font_body)

# Photo placeholder
draw.rectangle([w - 220, 130, w - 50, 330], fill=(200, 215, 225), outline=(100, 130, 150), width=2)
draw.text((w - 180, 215), "PHOTO", fill=(100, 130, 150), font=font_bold)

# Signature line
draw.rectangle([w - 220, 380, w - 50, 450], fill=(245, 250, 255), outline=(140, 160, 180), width=1)
draw.text((w - 200, 405), "Signature", fill=(120, 140, 160), font=font_sub)

# Save with Adobe Photoshop metadata marker string
pan_alt_path = "public/sample_docs/pan_card_altered.jpg"
img_pan_alt.save(pan_alt_path, quality=90, comment="Software: Adobe Photoshop CC 2024 (Macintosh) - Altered Name Layer")

# 2. GENERATE GENUINE PAN CARD
img_pan_gen = Image.new("RGB", (w, h), color=(220, 238, 248))
draw_gen = ImageDraw.Draw(img_pan_gen)
draw_gen.rectangle([0, 0, w, 90], fill=(24, 76, 120))
draw_gen.text((30, 18), "INCOME TAX DEPARTMENT", fill=(255, 255, 255), font=font_title)
draw_gen.text((30, 48), "GOVERNMENT OF INDIA", fill=(210, 230, 250), font=font_sub)
draw_gen.text((w - 240, 32), "Permanent Account Card", fill=(255, 255, 255), font=font_bold)
draw_gen.text((50, 120), "Permanent Account Number", fill=(100, 120, 140), font=font_sub)
draw_gen.text((50, 145), "ABCDE1234F", fill=(15, 23, 42), font=font_mono)
draw_gen.text((50, 190), "Name on Card", fill=(100, 120, 140), font=font_sub)
draw_gen.text((50, 218), "ACME VENTURES PVT LTD", fill=(15, 23, 42), font=font_bold)
draw_gen.text((50, 270), "Date of Incorporation", fill=(100, 120, 140), font=font_sub)
draw_gen.text((50, 295), "15/06/2018", fill=(30, 41, 59), font=font_body)
draw_gen.rectangle([w - 220, 130, w - 50, 330], fill=(200, 215, 225), outline=(100, 130, 150), width=2)
draw_gen.text((w - 180, 215), "PHOTO", fill=(100, 130, 150), font=font_bold)
img_pan_gen.save("public/sample_docs/pan_card_genuine.jpg", quality=95)

# 3. GENERATE GENUINE GST CERTIFICATE
w_gst, h_gst = 900, 700
img_gst = Image.new("RGB", (w_gst, h_gst), color=(253, 251, 247))
draw_gst = ImageDraw.Draw(img_gst)
draw_gst.rectangle([20, 20, w_gst - 20, h_gst - 20], outline=(180, 160, 130), width=2)
draw_gst.text((w_gst // 2 - 140, 45), "Government of India", fill=(20, 30, 40), font=font_title)
draw_gst.text((w_gst // 2 - 150, 75), "Form GST REG-06 (See Rule 10(1))", fill=(80, 90, 100), font=font_sub)
draw_gst.text((w_gst // 2 - 120, 95), "Registration Certificate", fill=(20, 30, 40), font=font_bold)

draw_gst.line([50, 135, w_gst - 50, 135], fill=(200, 190, 175), width=1)
draw_gst.text((60, 160), "Registration Number (GSTIN):", fill=(70, 75, 80), font=font_body)
draw_gst.text((320, 158), "27ABCDE1234F1Z5", fill=(11, 102, 77), font=font_mono)

draw_gst.text((60, 220), "Legal Name:", fill=(70, 75, 80), font=font_body)
draw_gst.text((320, 220), "ACME VENTURES PRIVATE LIMITED", fill=(15, 23, 42), font=font_bold)

draw_gst.text((60, 280), "Trade Name:", fill=(70, 75, 80), font=font_body)
draw_gst.text((320, 280), "ACME VENTURES", fill=(15, 23, 42), font=font_body)

draw_gst.text((60, 340), "Principal Place of Business:", fill=(70, 75, 80), font=font_body)
draw_gst.text((320, 340), "104 Nariman Point, Marine Drive, Mumbai, MH 400021", fill=(15, 23, 42), font=font_body)

draw_gst.text((60, 400), "Date of Registration:", fill=(70, 75, 80), font=font_body)
draw_gst.text((320, 400), "01/07/2018", fill=(15, 23, 42), font=font_body)

draw_gst.rectangle([w_gst - 220, h_gst - 180, w_gst - 60, h_gst - 60], outline=(11, 102, 77), width=2)
draw_gst.text((w_gst - 200, h_gst - 130), "OFFICIAL SEAL", fill=(11, 102, 77), font=font_sub)

img_gst.save("public/sample_docs/gst_certificate_genuine.jpg", quality=95)

# 4. GENERATE GENUINE CANCELLED CHEQUE
w_chk, h_chk = 900, 420
img_chk = Image.new("RGB", (w_chk, h_chk), color=(240, 247, 244))
draw_chk = ImageDraw.Draw(img_chk)

draw_chk.rectangle([15, 15, w_chk - 15, h_chk - 15], outline=(120, 160, 140), width=2)
draw_chk.text((40, 35), "HDFC BANK LTD", fill=(15, 76, 129), font=font_title)
draw_chk.text((40, 68), "KORAMANGALA BRANCH, BANGALORE 560034", fill=(80, 100, 110), font=font_sub)
draw_chk.text((40, 90), "RTGS / NEFT / UPI IFSC: HDFC0000053", fill=(11, 102, 77), font=font_mono)

draw_chk.text((60, 150), "Pay:", fill=(80, 90, 100), font=font_body)
draw_chk.text((120, 148), "CANCELLED", fill=(220, 38, 38), font=font_title)

draw_chk.text((60, 220), "A/C No.:", fill=(80, 90, 100), font=font_body)
draw_chk.text((150, 216), "50100294819284", fill=(15, 23, 42), font=font_mono)

draw_chk.text((60, 280), "Account Holder:", fill=(80, 90, 100), font=font_body)
draw_chk.text((190, 280), "ACME VENTURES PRIVATE LIMITED", fill=(15, 23, 42), font=font_bold)

# Crossed CANCELLED line
draw_chk.line([100, 110, 450, 320], fill=(220, 38, 38), width=4)
draw_chk.line([100, 130, 450, 340], fill=(220, 38, 38), width=4)

img_chk.save("public/sample_docs/cancelled_cheque_genuine.jpg", quality=95)

print("Sample documents generated successfully in public/sample_docs/")
