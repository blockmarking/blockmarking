from flask import Flask, request, jsonify, render_template, send_from_directory
from flask_cors import CORS
import os
from pathlib import Path
from PIL import Image
import numpy as np
import cv2
from skimage.metrics import peak_signal_noise_ratio, structural_similarity
import requests
from io import BytesIO

# Định nghĩa tên file cố định cho từng vai trò
def get_ext(filename):
    return os.path.splitext(filename)[1].lower()

def fixed_name(ext, role):
    mapping = {
        'logo':        f'watermark_original{ext}',
        'image':       f'image_original{ext}',
        'watermarked': f'encoded_image_filename{ext}',
        'extracted':   f'watermark_extracted{ext}',
    }
    return mapping.get(role)

# Cấu hình Flask
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})
UPLOAD = os.path.join(os.path.dirname(__file__), 'uploads')
os.makedirs(UPLOAD, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD

# Lớp LSB watermark
class LSB:
    def encode_image(self, img: Image.Image, msg_bytes: bytes) -> Image.Image:
        validate_png_rgb(img)
        encoded = img.copy()
        w, h = img.size
        total_bits = len(msg_bytes) * 8
        capacity = w * h * 3  # RGB

        if total_bits > capacity:
            raise ValueError(f"Cover image too small: required {total_bits} bits, but only {capacity} available.")

        idx = 0
        for y in range(h):
            for x in range(w):
                if idx >= total_bits:
                    return encoded
                pix = list(img.getpixel((x, y)))
                for c in range(3):
                    if idx >= total_bits:
                        break
                    bit = (msg_bytes[idx // 8] >> (7 - (idx % 8))) & 1
                    pix[c] = (pix[c] & 0xFE) | bit
                    idx += 1
                encoded.putpixel((x, y), tuple(pix))
        return encoded

    def decode_image(self, img: Image.Image, w: int, h: int, ch: int) -> Image.Image:
        #validate_png_rgb(img)
        iw, ih = img.size
        req_bits = w * h * ch * 8
        bits = []
        for y in range(ih):
            for x in range(iw):
                if len(bits) >= req_bits:
                    break
                pix = img.getpixel((x, y))
                for c in range(3):
                    if len(bits) < req_bits:
                        bits.append(pix[c] & 1)
                    else:
                        break
        msg = bytearray()
        for i in range(0, req_bits, 8):
            byte = 0
            for j in range(8):
                byte = (byte << 1) | bits[i + j]
            msg.append(byte)
        return Image.frombytes('RGB', (w, h), bytes(msg))

lsb = LSB()

def validate_png_rgb(image: Image.Image):
    if image.format != 'PNG' or image.mode != 'RGB':
        raise ValueError("Only 24-bit RGB PNG images are supported.")


def safe_open_rgb_image(path):
    try:
        img = Image.open(path)
        img.load()  # Bắt buộc để .format hoạt động đúng với ảnh PNG
        validate_png_rgb(img)
        return img
    except Exception as e:
        raise ValueError(f"Invalid image '{path}': {e}")


# API thêm watermark
@app.route('/api/v1/add_watermark', methods=['POST'])
def add_watermark():
    orig_f = request.files.get('original_file')
    logo_f = request.files.get('logo_file')
    if not orig_f or not logo_f:
        return jsonify(error="Missing original_file or logo_file"), 400
    ext_img = get_ext(orig_f.filename)
    ext_logo = get_ext(logo_f.filename)
    img_fn = fixed_name(ext_img, 'image')
    logo_fn = fixed_name(ext_logo, 'logo')
    orig_path = os.path.join(UPLOAD, img_fn)
    logo_path = os.path.join(UPLOAD, logo_fn)
    orig_f.save(orig_path)
    logo_f.save(logo_path)
    try:
        orig_img = safe_open_rgb_image(orig_path)
        logo_img = safe_open_rgb_image(logo_path)
        msg_bytes = np.array(logo_img).tobytes()
        encoded = lsb.encode_image(orig_img, msg_bytes)
    except Exception as e:
        return jsonify(error=str(e)), 400
    wm_fn = fixed_name(ext_img, 'watermarked')
    encoded.save(os.path.join(UPLOAD, wm_fn))
    return jsonify(message="success", encoded_image_filename=wm_fn), 200

# API kiểm tra watermark
@app.route('/api/v1/check_watermark', methods=['POST'])
def check_watermark():
    try:
        logo_fn = next((f for f in os.listdir(UPLOAD) if f.startswith('watermark_original')), None)
        img_fn = next((f for f in os.listdir(UPLOAD) if f.startswith('image_original')), None)
        if not logo_fn or not img_fn:
            return jsonify(error="Required files missing"), 400
        logo_img = safe_open_rgb_image(os.path.join(UPLOAD, logo_fn))
        wm_img = safe_open_rgb_image(os.path.join(UPLOAD, fixed_name(get_ext(img_fn), 'watermarked')))
        decoded = lsb.decode_image(wm_img, *logo_img.size, len(logo_img.getbands()))
        ex_fn = fixed_name(get_ext(logo_fn), 'extracted')
        decoded.save(os.path.join(UPLOAD, ex_fn))
        match = np.array_equal(np.array(logo_img), np.array(decoded))
        return jsonify(message=("match" if match else "mismatch"), watermark_extracted=ex_fn), 200
    except Exception as e:
        return jsonify(error=str(e)), 400

# API tải và trích logo từ ảnh đã nhúng
@app.route('/api/v1/download_and_extract_logo', methods=['POST'])
def download_and_extract_logo():
    data = request.get_json() or {}
    image_url = data.get('image_url')
    if not image_url:
        return jsonify(error="Missing image_url"), 400
    try:
        resp = requests.get(image_url)
        resp.raise_for_status()
        img_data = BytesIO(resp.content)
        cover = Image.open(img_data)
        validate_png_rgb(cover)
    except Exception as e:
        return jsonify(error=f"Invalid downloaded image: {e}"), 400
    ext = Path(image_url).suffix or '.png'
    cover_fn = fixed_name(ext, 'watermarked')
    cover_path = os.path.join(UPLOAD, cover_fn)
    cover.save(cover_path)
    logo_fn = next((f for f in os.listdir(UPLOAD) if f.startswith('watermark_original')), None)
    if not logo_fn:
        return jsonify(error="No watermark_original found"), 500
    try:
        logo_img = safe_open_rgb_image(os.path.join(UPLOAD, logo_fn))
        wm_img = safe_open_rgb_image(cover_path)
        decoded = lsb.decode_image(wm_img, *logo_img.size, len(logo_img.getbands()))
        ex_fn = fixed_name(get_ext(logo_fn), 'extracted')
        decoded.save(os.path.join(UPLOAD, ex_fn))
        return jsonify(message="success", logo_path=f"/uploads/{ex_fn}"), 200
    except Exception as e:
        return jsonify(error=str(e)), 400

# API đánh giá watermark
@app.route('/api/v1/evaluate', methods=['POST'])
def evaluate_api():
    try:
        orig_fn = next((f for f in os.listdir(UPLOAD) if f.startswith('image_original')), None)
        wm_fn = next((f for f in os.listdir(UPLOAD) if f.startswith('encoded_image_filename')), None)
        logo_fn = next((f for f in os.listdir(UPLOAD) if f.startswith('watermark_original')), None)

        if not orig_fn or not wm_fn or not logo_fn:
            return jsonify(error="Required files missing"), 400

        # Mở các ảnh
        orig_img = safe_open_rgb_image(os.path.join(UPLOAD, orig_fn))
        wm_img   = safe_open_rgb_image(os.path.join(UPLOAD, wm_fn))
        logo_img = safe_open_rgb_image(os.path.join(UPLOAD, logo_fn))

        # Convert về mảng numpy
        orig_np = np.array(orig_img)
        wm_np   = np.array(wm_img)
        logo_np = np.array(logo_img)

        # Tính PSNR và SSIM
        psnr = peak_signal_noise_ratio(orig_np, wm_np, data_range=255)
        ssim = structural_similarity(orig_np, wm_np, data_range=255, channel_axis=-1)

        # Tính Normalized Correlation (NC) theo độ dốc Sobel
        def gradient_nc(img1, img2):
            gray1 = cv2.cvtColor(img1, cv2.COLOR_RGB2GRAY)
            gray2 = cv2.cvtColor(img2, cv2.COLOR_RGB2GRAY)
            grad1 = cv2.Sobel(gray1, cv2.CV_64F, 1, 1, ksize=3)
            grad2 = cv2.Sobel(gray2, cv2.CV_64F, 1, 1, ksize=3)
            return np.corrcoef(grad1.flatten(), grad2.flatten())[0, 1]

        nc_gradient = gradient_nc(orig_np, wm_np)

        # Tính NC và BER giữa logo và watermark trích xuất
        decoded = lsb.decode_image(wm_img, *logo_img.size, len(logo_img.getbands()))
        decoded_np = np.array(decoded)
        logo_flat = logo_np.flatten()
        decoded_flat = decoded_np.flatten()

        nc_watermark = np.corrcoef(logo_flat, decoded_flat)[0, 1]
        ber = np.sum(logo_flat != decoded_flat) / len(logo_flat)

        return jsonify({
            'PSNR_color': round(psnr, 4),
            'SSIM_color': round(ssim, 4),
            'NC_gradient': round(nc_gradient, 4),
            'NC_watermark': round(nc_watermark, 4),
            'BER': round(ber, 6)
        }), 200

    except Exception as e:
        return jsonify(error=str(e)), 400



# Serve uploaded files
@app.route('/uploads/<filename>')
def serve_uploads(filename):
    return send_from_directory(UPLOAD, filename)


# Giao diện web test watermark
@app.route('/watermark', methods=['GET', 'POST'])
def watermark_page():
    context = {}
    if request.method == 'POST':
        orig_f = request.files.get('original_file')
        logo_f = request.files.get('logo_file')
        if orig_f and logo_f:
            ext_img = get_ext(orig_f.filename)
            ext_logo = get_ext(logo_f.filename)
            img_fn = fixed_name(ext_img, 'image')
            logo_fn = fixed_name(ext_logo, 'logo')
            wm_fn = fixed_name(ext_img, 'watermarked')
            ex_fn = fixed_name(ext_logo, 'extracted')
            orig_f.save(os.path.join(UPLOAD, img_fn))
            logo_f.save(os.path.join(UPLOAD, logo_fn))
            orig_img = safe_open_rgb_image(os.path.join(UPLOAD, img_fn))
            logo_img = safe_open_rgb_image(os.path.join(UPLOAD, logo_fn))
            context.update({
                'image_original': img_fn,
                'watermark_original': logo_fn,
                'orig_size': orig_img.size,
                'orig_channels': len(orig_img.getbands()),
                'logo_size': logo_img.size,
                'logo_channels': len(logo_img.getbands())
            })
            encoded = lsb.encode_image(orig_img, np.array(logo_img).tobytes())
            encoded.save(os.path.join(UPLOAD, wm_fn))
            decoded = lsb.decode_image(encoded, *logo_img.size, len(logo_img.getbands()))
            decoded.save(os.path.join(UPLOAD, ex_fn))
            context.update({
                'encoded_image_filename': wm_fn,
                'wm_size': encoded.size,
                'wm_channels': len(encoded.getbands()),
                'watermark_extracted': ex_fn,
                'ex_size': decoded.size,
                'ex_channels': len(decoded.getbands())
            })
    return render_template('watermark.html', **context)

if __name__ == '__main__':
    app.run(debug=True, port=5000)
