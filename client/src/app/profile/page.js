"use client";
import { WalletContext } from "@/context/wallet";
import { useContext, useEffect, useState } from "react";
import { ethers } from "ethers";
import MarketplaceJson from "../marketplace.json";
import styles from "./profile.module.css";
import Header from "../components/header/Header";
import Footer from "../components/footer/Footer";
import axios from "axios";
import NFTTile from "../components/nftCard/NFTCard";

export default function Profile() {
  const [items, setItems] = useState([]);
  const { isConnected, userAddress, signer } = useContext(WalletContext);
  const [loading, setLoading] = useState(true);  // Trạng thái tải dữ liệu

  // Hàm lấy danh sách NFT
  async function getNFTitems() {
    const itemsArray = [];
    if (!signer) return;
    const contract = new ethers.Contract(
      MarketplaceJson.address,
      MarketplaceJson.abi,
      signer
    );

    try {
      const transaction = await contract.getMyNFTs();
      console.log("NFT Transaction Data: ", transaction); // Log để kiểm tra

      for (const i of transaction) {
        const tokenId = parseInt(i.tokenId);
        const tokenURI = await contract.tokenURI(tokenId);
        const meta = (await axios.get(tokenURI)).data;

        const item = {
          tokenId,
          seller: i.seller,
          owner: i.owner,
          image: meta.image,
          name: meta.name,
          description: meta.description,
        };

        itemsArray.push(item);
      }
    } catch (error) {
      console.error("Error fetching NFT items:", error);
    }

    return itemsArray; // Trả về mảng các NFT
  }

  // Lắng nghe sự thay đổi của userAddress và isConnected
  useEffect(() => {
    const fetchData = async () => {
      if (isConnected && userAddress && signer) {
        setLoading(true);  // Bắt đầu tải dữ liệu mới
        setItems([]); // Reset danh sách NFT để tránh hiển thị dữ liệu cũ
        const itemsArray = await getNFTitems();
        setItems(itemsArray);
        setLoading(false);  // Dừng trạng thái tải
      }
    };

    fetchData();
  }, [isConnected, userAddress, signer]); // Theo dõi cả userAddress và signer

  return (
    <div className={styles.container}>
      <Header />
      <div className={styles.innerContainer}>
        <div className={styles.content}>
          {isConnected ? (
            <>
              <div className={styles.userInfo}>
                <span className={styles.label}>Wallet Address:</span>
                <span className={styles.address}>{userAddress}</span>
              </div>
              <div className={styles.stats}>
                <div className={styles.stat}>
                  <span className={styles.label}>Number of NFTs:</span>
                  <span className={styles.value}>{items?.length}</span>
                </div>
              </div>
              <div className={styles.nftSection}>
                <h2 className={styles.heading}>Your NFTs</h2>
                {loading ? (
                  <div>Loading NFTs...</div> // Hiển thị khi đang tải dữ liệu
                ) : items?.length > 0 ? (
                  <div className={styles.nftGrid}>
                    {items?.map((value, index) => (
                      <NFTTile item={value} key={index} />
                    ))}
                  </div>
                ) : (
                  <div className={styles.noNFT}>You don't have any NFT...</div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.notConnected}>You are not connected...</div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
