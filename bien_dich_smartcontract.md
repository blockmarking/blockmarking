#Cách biên dịch hợp đồng thông minh

##1. Reset xóa hết cũ:

`npx hardhat ignition reset --network sepolia`

Xóa thủ công thư mục: Nếu mục tiêu chỉ đơn giản là triển khai lại một hợp đồng mới hoàn toàn (không giữ trạng thái cũ), chỉ cần xóa thủ công thư mục lưu trạng thái deployment cũ.

ignition/deployments/
Xóa thư mục con bên trong (ví dụ thư mục chain-11155111, là mạng Sepolia).


##2. Chạy lại lệnh triển khai hợp đồng mới

###Bước 1. Biên dịch hợp đồng thông minh

Chạy lệnh ở thư mục cài hardhat (Ví dụ H:\nftwab):

`npx hardhat compile`

###Bước 2: Deploy (triển khai) hợp đồng lên mạng Sepolia

Chạy lệnh từ thư mục cài đặt hardhat (Ví dụ H:\nftwab>)
 
`npx hardhat ignition deploy ./ignition/modules/Token.js --network sepolia`

* Cần thêm địa chỉ hợp đồng thông minh sau khi biên dịch vào marketplace.json trong client của Next:
(Vì khi copy toàn bộ nội dung "H:\nftwab\artifacts\contracts\nftwab.sol\nftwab.json" đưa vào file "client\src\app\marketplace.json" thì không có địa chỉ hợp đồng thông minh). Do vậy bổ sung thêm hợp đồng thông minh để Next có thể chạy được.

Ví dụ trong marketplace.json :

```
{
  "_format": "hh-sol-artifact-1",
  "contractName": "nftwab",
  "sourceName": "contracts/nftwab.sol",
  "address": "0x94E43043F3488D0902951cfd8b9ab4b655131fc5", // thêm địa chỉ hợp đồng thông minh vào đây
  
  "abi": [
  ...
}
```
