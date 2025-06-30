"use client";
import { WalletContext } from "@/context/wallet";
import { BrowserProvider } from "ethers";
import Image from "next/image";
import Link from "next/link";
import { useContext, useEffect } from "react";
import styles from "./Header.module.css";

export default function Header() {
  const {
    isConnected,
    setIsConnected,
    userAddress,
    setUserAddress,
    signer,
    setSigner,
  } = useContext(WalletContext);

  const connectWallet = async () => {
    if (!window.ethereum) {
      throw new Error("Metamask is not installed");
    }

    try {
      const provider = new BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      setSigner(signer);
      const accounts = await provider.send("eth_requestAccounts", []);
      setIsConnected(true);
      setUserAddress(accounts[0]);
      const network = await provider.getNetwork();
      const chainID = network.chainId;
      const sepoliaNetworkId = "11155111";

      if (chainID.toString() !== sepoliaNetworkId) {
        alert("Please switch your MetaMask to sepolia network");
        return;
      }
    } catch (error) {
      console.error("connection error: ", error);
    }
  };

  // Lắng nghe sự thay đổi của tài khoản Metamask và cập nhật userAddress và signer
  useEffect(() => {
    if (window.ethereum) {
      // Khi tài khoản Metamask thay đổi
      window.ethereum.on("accountsChanged", async (accounts) => {
        if (accounts.length === 0) {
          setIsConnected(false); // Không còn kết nối khi không có tài khoản
          setUserAddress(null);
          setSigner(null);
        } else {
          const provider = new BrowserProvider(window.ethereum);
          const signer = await provider.getSigner();
          setSigner(signer);
          setUserAddress(accounts[0]);
          setIsConnected(true); // Cập nhật trạng thái kết nối
        }
      });
    }

    // Cleanup: Xóa listener khi component unmount
    return () => {
      if (window.ethereum) {
        window.ethereum.removeListener("accountsChanged", () => {});
      }
    };
  }, [setUserAddress, setIsConnected, setSigner]);

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <div className={styles.logo}>
          <Link href="/">
            <Image src="/logo.png" width={280} height={44} alt="logo" />
          </Link>
        </div>
        <nav className={styles.nav}>
          <ul className={styles.navLinks}>
            <li>
              <Link href="/marketplace" className={styles.link}>
                MarketPlace
              </Link>
            </li>
            <li>
              <Link href="/sellNFT" className={styles.link}>
                List
              </Link>
            </li>
            <li>
              <Link href="/profile" className={styles.link}>
                Profile
              </Link>
            </li>
          </ul>
          <button
            className={`${styles.ctaBtn} ${
              isConnected ? styles.activebtn : styles.inactivebtn
            }`}
            onClick={connectWallet}
          >
            {isConnected ? (
              <>{userAddress?.slice(0, 8)}...</>
            ) : (
              "Connect wallet"
            )}
          </button>
        </nav>
      </div>
    </header>
  );
}
