# 💾 Demo blockmarking.com tại: http://62.84.180.94:3000

🔹 Thư mục nftwab

* Hardhat (blockchain) chính:

```plaintext
contracts/
hardhat.config.js
.env
node_modules/
package-lock.json
```

🔹 Thư mục client
Là một dự án frontend (Next.js hoặc React).

```plaintext
package.json
.env
next.config.mjs
src/
public/
```

Đây là một Next.js app riêng biệt

## Cài đặt các phần mềm cần thiết trên Ubuntu 22.04

### Clone dự án nếu chưa có

```bash
git clone https://github.com/blockmarking/blockmarking
```

### ⚙️ Python / Flask / FastAPI

```bash
sudo apt update
sudo apt install python3 python3-pip python3-venv git -y
```

### ⚙️ Node.js / npm (cho frontend React/Next.js)

#### Bước 1: Cài Node.js (ví dụ Node.js v18 chính thức từ Nodesource)

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
```

#### Bước 2: Kiểm tra lại

```bash
node -v   # nên là v18.x
```

#### Bước 3: Cài thư viện từ package-lock.json
```
npm ci     # hoặc npm install nếu chưa dùng CI
```

#### Cụ thể:
```
cd blockmarking
npm ci  # Cài package đúng phiên bản theo package-lock.json

cd client
npm ci  # Cài package đúng phiên bản theo package-lock.json
```

### Chạy Next.js với `HOST=0.0.0.0` , Lúc này Next.js sẽ lắng nghe trên tất cả các IP, không chỉ `localhost`

```bash
HOST=0.0.0.0 npm run dev
```

#### Mở port 3000 trên VPS (tường lửa)

```bash
sudo ufw allow 3000
```

### Truy cập từ bên ngoài

#### Từ trình duyệt máy khác, truy cập: http://62.84.180.94:3000

#### WATERMARK

```python
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)
```

#### Mở port 5000

```bash  
sudo ufw allow 5000
```
