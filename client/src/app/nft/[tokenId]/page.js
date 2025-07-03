"use client";
import { WalletContext } from "@/context/wallet";
import { useParams, useRouter } from "next/navigation";
import { useContext, useEffect, useState } from "react";
import MarketplaceJson from "../../marketplace.json";
import { ethers } from "ethers";
import { Contract, id, zeroPadValue, toBeHex } from "ethers";
//import { Contract, formatUnits } from "ethers"; // đảm bảo dùng từ ethers v6
import axios from "axios";
import GetIpfsUrlFromPinata from "@/app/utils";
import Image from "next/image";
import styles from "./nft.module.css";
import Header from "@/app/components/header/Header";
import Footer from "@/app/components/footer/Footer";
import { fetchTransferEvents } from "@/lib/fetchTransferEvents";
import { filterEventsByTokenId } from "@/lib/getNFTTransactions";


//import download from 'downloadjs';

export default function NFTPage() {

  const params = useParams();
  const tokenId = params.tokenId;
  // ở đầu component NFTPage()
  const [metrics, setMetrics] = useState(null);

  const [item, setItem] = useState();
  const [msg, setmsg] = useState();
  const [btnContent, setBtnContent] = useState("Buy NFT");
  const { isConnected, userAddress, signer } = useContext(WalletContext);
  const router = useRouter();

  // Khai báo trạng thái để quản lý giao dịch
  const [transactions, setTransactions] = useState([]); // Thêm trạng thái cho giao dịch
  const [mintAddress, setMintAddress] = useState(""); // Lưu địa chỉ ví mint
  const [currentOwnerAddress, setCurrentOwnerAddress] = useState(""); // Lưu địa chỉ ví đang sở hữu
  const [loadingTransactions, setLoadingTransactions] = useState(false); // Trạng thái tải giao dịch
  const [copyrightInfo, setCopyrightInfo] = useState(""); // Lưu trữ thông tin bản quyền
  const [showTransactionsModal, setShowTransactionsModal] = useState(false); // Trạng thái để điều khiển hiển thị modal giao dịch

  // Khai báo trạng thái để quản lý hiển thị modal và URL của ảnh
  const [showModal, setShowModal] = useState(false);
  const [imageUrl, setImageUrl] = useState('');

  // Thêm useEffect để gọi getNFTTransactions khi signer thay đổi, khong can dung vì da dung nut bam
  // useEffect(() => {
  //   if (signer) {
  //     getNFTTransactions();
  //   }
  // }, [signer]);

  useEffect(() => {
    async function fetchData() {
      if (!signer) return;
      try {
        const itemTemp = await getNFTData();
        setItem(itemTemp);
      } catch (error) {
        console.error("Error fetching NFT items:", error);
        setItem(null);
      }
    }

    fetchData();
  }, [isConnected]);

  // Thêm useEffect mới để log imageUrl khi nó thay đổi
  useEffect(() => {
    if (imageUrl) {
      console.log(`File ảnh download là: ${imageUrl}`);  // Log URL của ảnh đã giải mã khi có giá trị
    }
  }, [imageUrl]);

  async function getNFTData() {
    if (!signer) return;
    let contract = new ethers.Contract(
      MarketplaceJson.address,
      MarketplaceJson.abi,
      signer
    );
    let tokenURI = await contract.tokenURI(tokenId);
    console.log(tokenURI);
    const listedToken = await contract.getNFTListing(tokenId);
    tokenURI = GetIpfsUrlFromPinata(tokenURI);
    console.log(tokenURI);
    const meta = (await axios.get(tokenURI)).data;

    // Lưu thông tin bản quyền vào state
    setCopyrightInfo(meta.copyrightInfo || "Không có thông tin bản quyền");

    const item = {
      price: meta.price,
      tokenId,
      seller: listedToken.seller,
      owner: listedToken.owner,
      image: meta.image,
      name: meta.name,
      description: meta.description,
    };
    return item;
  }


  // // Hàm lấy lịch sử giao dịch NFT
  async function getNFTTransactions() {
    try {
      const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_ALCHEMY_SEPOLIA_URL);
      const contract = new Contract(
        MarketplaceJson.address,
        MarketplaceJson.abi,
        provider
      );

      const allEvents = await fetchTransferEvents(contract);
      console.log("📦 Tất cả sự kiện Transfer:", allEvents);

      // ✅ Log và lọc rõ ràng theo tokenId
      const filtered = allEvents.filter((e) => {
        const eventTokenId = e.args.tokenId.toString();
        const expectedTokenId = tokenId.toString();

        console.log("🔍 So sánh tokenId:");
        console.log("  tokenId từ URL:", expectedTokenId);
        console.log("  tokenId từ event:", eventTokenId);

        return eventTokenId === expectedTokenId;
      });

      console.log("🎯 Sự kiện Transfer đúng token:", filtered);

      const transfers = filtered.map((event) => ({
        from: event.args.from,
        to: event.args.to,
        tokenId: event.args.tokenId.toString(),
        txHash: event.transactionHash,
        blockNumber: event.blockNumber,
      }));

      setTransactions(transfers);

      if (transfers.length > 0) {
        const mintTx = transfers.find(tx => tx.from === "0x0000000000000000000000000000000000000000");
        if (mintTx) {
          setMintAddress(mintTx.to); // ví đầu tiên nhận token
        } else {
          setMintAddress("Không tìm thấy giao dịch mint");
        }

        setCurrentOwnerAddress(transfers[transfers.length - 1].to); // người đang sở hữu hiện tại
      } else {
        setMintAddress("Không có dữ liệu");
        setCurrentOwnerAddress("Không có dữ liệu");
      }


    } catch (error) {
      console.error("❌ Lỗi trong getNFTTransactions:", error.message);
      setTransactions([]);
      setMintAddress("Lỗi");
      setCurrentOwnerAddress("Lỗi");
    }
  }


  // checkWatermark() version2 theo route ${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/download_and_extract_logo bên Flask
  async function checkWatermark() {
    try {
      const imageUrlFromIPFS = item?.image; // Lấy URL của ảnh từ metadata

      console.log("Link ảnh cần download từ IPFS:", imageUrlFromIPFS);  // Log để kiểm tra URL ảnh

      if (!imageUrlFromIPFS) {
        alert("Không có URL ảnh hợp lệ.");
        return;
      }

      // Gửi yêu cầu đến Flask để tải và trích xuất logo từ ảnh
      const response = await fetch('${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/download_and_extract_logo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ image_url: imageUrlFromIPFS }),  // Gửi URL ảnh từ IPFS
      });

      const data = await response.json();
      console.log("Kết quả phản hồi từ Flask:", data);  // Log để kiểm tra phản hồi từ Flask

      if (response.status === 200) {
        alert(data.message);  // Thông báo thành công

        const logoUrl = `${process.env.NEXT_PUBLIC_API_BASE_URL}${data.logo_path}`;  // URL của logo đã trích xuất
        console.log("Link logo trích xuất:", logoUrl);  // Log để kiểm tra URL của logo

        setImageUrl(logoUrl); // Hiển thị logo sau khi trích xuất


        /////////////

        // --- Bước 2: lấy metrics từ endpoint evaluate ---
        const evRes = await fetch('${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/evaluate', { method: 'POST' });
        if (!evRes.ok) {
          const err = await evRes.json();
          throw new Error(err.error || 'Failed to evaluate');
        }
        const evData = await evRes.json();
        setMetrics(evData);
        /////////// hết bước 2 lấy metrics từ endpoint evaluate 

        setShowModal(true);   // Hiển thị modal với logo

      } else {
        alert(data.error);  // Thông báo lỗi
      }
    } catch (e) {
      console.error("Error checking watermark:", e);
      alert("Lỗi khi kiểm tra watermark!");
    }
  }


  async function buyNFT() {
    try {
      if (!signer) return;
      let contract = new ethers.Contract(
        MarketplaceJson.address,
        MarketplaceJson.abi,
        signer
      );

      setBtnContent("Processing...");
      setmsg("Buying the NFT... Please Wait (Upto 5 mins)");
      let transaction = await contract.executeSale(tokenId);
      await transaction.wait();
      alert("You successfully bought the NFT!");
      setmsg("");
      setBtnContent("Buy NFT");
      router.push("/");
    } catch (e) {
      console.log("Buying Error: ", e);
    }
  }

  // Hàm renderTransaction để tái sử dụng
  const renderTransaction = (tx, txIndex) => {
    return (
      <p>
        <strong>#{txIndex + 1}</strong> {/* Thêm số thứ tự cho giao dịch */}
        <br />
        <strong>From:</strong> {tx.from} <br />
        <strong>To:</strong> {tx.to} <br />
        <strong>Transaction Hash:</strong> {tx.transactionHash} <br />
        <strong>Block Number:</strong> {tx.blockNumber}
      </p>
    );
  };

  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.innerContainer}>
        {isConnected ? (
          <div className={styles.content}>
            <div className={styles.nftGrid}>
              <Image src={item?.image} alt="" width={800} height={520} />
              <div className={styles.details}>
                <div className={styles.stats}>
                  <div className={styles.stat}>
                    <span className={styles.label}>Name:</span>
                    <span className={styles.value}>{item?.name}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.label}>Description:</span>
                    <span className={styles.value}>{item?.description}</span>
                  </div>
                  <div className={styles.stat}>
                    <span className={styles.label}>Seller:</span>
                    <span className={styles.value}>{item?.seller}</span>
                  </div>
                </div>
                <div className={styles.ctaBtn}>
                  <div className={styles.msg}>{msg}</div>

                  {/* Kiểm tra nếu ví sở hữu thì hiển thị nút Check Watermark và Check giao dịch */}
                  {userAddress.toLowerCase() === item?.owner.toLowerCase() ? (
                    <>
                      <div className={styles.msgAlert}>You already Own!</div>
                      <button
                        onClick={() => {
                          checkWatermark(); // Thực thi chức năng kiểm tra watermark
                          getNFTTransactions(); // Lấy giao dịch của NFT

                        }}
                        className={styles.BtnCheck}
                      >
                        Check Watermark
                      </button>

                      {/* Modal hiển thị ảnh */}
                      {showModal && (
                        <div className="modal">
                          <div className="modal-content">
                            <span className="close" onClick={() => setShowModal(false)}>&times;</span>

                            {/* Hiển thị thông tin ví Mint và ví hiện đang sở hữu */}
                            <p><strong>* Mint Wallet:</strong> {mintAddress}</p>
                            <p><strong>* Wallet Holding:</strong> {currentOwnerAddress}</p>
                            {/* Hiển thị thông tin bản quyền */}
                            <p><strong>* Copyright Information:</strong> {copyrightInfo}</p>
                            {/* Hiển Ảnh logo trích xuất */}
                            <img src={imageUrl} alt="Decoded Watermark" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }} />

                            {metrics && (
                              <div style={{ textAlign: 'left', marginTop: '1rem' }}>
                                <h3>Evaluation Metrics</h3>
                                <ul>
                                  {metrics.PSNR_color !== undefined && (
                                    <li>PSNR (color): {metrics.PSNR_color.toFixed(4)}</li>
                                  )}
                                  {metrics.SSIM_color !== undefined && (
                                    <li>SSIM (color): {metrics.SSIM_color.toFixed(4)}</li>
                                  )}
                                  {metrics.PSNR_alpha !== undefined && (
                                    <li>PSNR (alpha): {metrics.PSNR_alpha.toFixed(4)}</li>
                                  )}
                                  {metrics.SSIM_alpha !== undefined && (
                                    <li>SSIM (alpha): {metrics.SSIM_alpha.toFixed(4)}</li>
                                  )}
                                  {metrics.NCC_gradient !== undefined && (
                                    <li>NCC (gradient): {metrics.NCC_gradient.toFixed(4)}</li>
                                  )}
                                  {metrics.BER !== undefined && (
                                    <li>BER: {metrics.BER.toFixed(6)}</li>
                                  )}
                                  {metrics.NCC_watermark !== undefined && (
                                    <li>NCC (watermark): {metrics.NCC_watermark.toFixed(6)}</li>
                                  )}
                                </ul>
                              </div>
                            )}

                          </div>
                        </div>
                      )}

                      {/* Nút "Check giao dịch của NFT" */}
                      <button
                        onClick={async () => {
                          setLoadingTransactions(true);         // ✅ Hiện loading
                          await getNFTTransactions();           // 🧠 Gọi hàm truy vấn
                          setLoadingTransactions(false);        // ✅ Tắt loading
                          setShowTransactionsModal(true);       // ✅ Hiện modal
                        }}
                        className={styles.BtnCheck}
                      >
                        {loadingTransactions ? "🔍 Checking..." : "Check Transactions"}
                      </button>

                      {/* Thêm modal hiển thị danh sách giao dịch với nút đóng và thanh cuộn */}
                      {showTransactionsModal && (
                        <div className={styles.modalOverlay}>
                          <div className={styles.modalContent}>
                            <button
                              className={styles.closeBtn}
                              onClick={() => setShowTransactionsModal(false)}
                            >
                              &times; {/* Nút đóng modal */}
                            </button>

                            <h3>Transactions for Token {item?.tokenId}</h3>
                            <div className={styles.transactionList}>

                              <ul>
                                <li><strong>* Mint Wallet:</strong> {mintAddress || "(chưa có dữ liệu)"}</li>
                                <li><strong>* Wallet Holding:</strong> {currentOwnerAddress}</li>

                                {transactions.map((tx, txIndex) => (
                                  <li key={txIndex} className={styles.transactionItem}>
                                    {renderTransaction(tx, txIndex)}
                                  </li>
                                ))}
                              </ul>

                            </div>
                          </div>
                        </div>
                      )}


                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          checkWatermark(); // Thực thi chức năng kiểm tra watermark
                          getNFTTransactions(); // Lấy giao dịch của NFT
                        }}
                        className={styles.BtnCheck}
                      >
                        Check Watermark
                      </button>

                      {/* Modal hiển thị ảnh */}
                      {showModal && (
                        <div className="modal">
                          <div className="modal-content">
                            <span className="close" onClick={() => setShowModal(false)}>&times;</span>

                            {/* Hiển thị thông tin ví Mint và ví hiện đang sở hữu */}
                            <p><strong>* Mint Wallet:</strong> {mintAddress}</p>
                            <p><strong>* Wallet Holding:</strong> {currentOwnerAddress}</p>
                            {/* Hiển thị thông tin bản quyền */}
                            <p><strong>* Copyright Information:</strong> {copyrightInfo}</p>
                            {/* Hiển Ảnh logo trích xuất */}
                            <img src={imageUrl} alt="Decoded Watermark" style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto' }} />
                          </div>
                        </div>
                      )}

                      {/* Nút "Check giao dịch của NFT" */}
                      <button
                        onClick={async () => {
                          setLoadingTransactions(true);         // ✅ Hiện loading
                          await getNFTTransactions();           // 🧠 Gọi hàm truy vấn, Lấy giao dịch của NFT
                          setLoadingTransactions(false);        // ✅ Tắt loading
                          setShowTransactionsModal(true);       // ✅ Hiện modal
                        }}
                        className={styles.BtnCheck}
                      >
                        {loadingTransactions ? "🔍 Checking..." : "Check Transactions"}
                      </button>

                      {/* Thêm modal hiển thị danh sách giao dịch với nút đóng và thanh cuộn */}
                      {showTransactionsModal && (
                        <div className={styles.modalOverlay}>
                          <div className={styles.modalContent}>
                            <button
                              className={styles.closeBtn}
                              onClick={() => setShowTransactionsModal(false)}
                            >
                              &times; {/* Nút đóng modal */}
                            </button>

                            <h3>Transactions for Token {item?.tokenId}</h3>
                            <div className={styles.transactionList}>
                              <ul>
                                {/* Hiển thị thông tin ví Mint và ví hiện đang sở hữu */}
                                <p><strong>* Mint Wallet     :</strong> {mintAddress}</p>
                                <p><strong>* Wallet Holding:</strong> {currentOwnerAddress}</p>
                                {transactions.map((tx, txIndex) => (
                                  <li key={txIndex} className={styles.transactionItem}>
                                    {renderTransaction(tx, txIndex)}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      <button
                        onClick={() => {
                          buyNFT(); // Thực hiện mua NFT
                        }}
                        className={styles.Btn}
                      >
                        {btnContent === "Processing..." && (
                          <span className={styles.spinner} />
                        )}
                        {btnContent}
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.notConnected}>You are not connected...</div>
        )}
      </div>
      <Footer />
    </div>
  );
}