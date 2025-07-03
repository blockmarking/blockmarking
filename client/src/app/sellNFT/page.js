"use client";
import { useContext, useState } from "react";
import styles from "./sellNFT.module.css";
import Header from "../components/header/Header";
import Footer from "../components/footer/Footer";
import { useRouter } from "next/navigation";
import { uploadFileToIPFS, uploadJSONToIPFS } from "../pinata";
import marketplace from "./../marketplace.json";
import { ethers } from "ethers";
import { WalletContext } from "@/context/wallet";

export default function SellNFT() {
    const [formParams, updateFormParams] = useState({
        name: "",
        description: "",
        //price: "",
    });
    const [fileURL, setFileURL] = useState();
    const [logoFile, setLogoFile] = useState();  // Quản lý file logo
    const [selectedFile, setSelectedFile] = useState();  // Quản lý file ảnh gốc
    const [message, updateMessage] = useState("");
    const [btn, setBtn] = useState(false);
    const [btnContent, setBtnContent] = useState("Upload Image");  // Thêm nút Upload
    const router = useRouter();
    const { isConnected, signer } = useContext(WalletContext);

    const [showUploadButton, setShowUploadButton] = useState(true);

    // Hàm xử lý khi người dùng chọn ảnh gốc
    function onFileChange(e) {
        const file = e.target.files[0];
        setSelectedFile(file);  // Lưu file ảnh gốc đã chọn vào state
    }

    // Hàm xử lý khi người dùng chọn logo
    function onLogoFileChange(e) {
        const file = e.target.files[0];
        setLogoFile(file);  // Lưu file logo đã chọn vào state
    }

    // Hàm xử lý upload ảnh và logo lên Flask API
    async function handleUpload() {
        if (!selectedFile || !logoFile) {
            updateMessage("Please select both an image and a logo file.");
            return;
        }

        const data = new FormData();
        data.set("original_file", selectedFile); // Sử dụng file ảnh gốc
        data.set("logo_file", logoFile); // Gửi kèm file logo

        const watermarkApiUrl = "${process.env.NEXT_PUBLIC_API_BASE_URL}/api/v1/add_watermark"; // Flask API để thêm watermark

        // Gọi API Flask để thêm watermark
        setBtnContent("Processing watermark...");
        setBtn(false);
        updateMessage("Processing watermark... Please wait.");

        try {
            const watermarkResponse = await fetch(watermarkApiUrl, {
                method: "POST",
                body: data,
            });

            if (!watermarkResponse.ok) {
                updateMessage("Error processing watermark");
                return;
            }

            const watermarkData = await watermarkResponse.json();
            const encodedImageFilename = watermarkData.encoded_image_filename;  // Lấy tên file encode từ Flask
            console.log("Encoded image filename: ", encodedImageFilename);  // Debug để xem file encode

            // Lấy file encode vừa tạo từ Flask và upload lên IPFS
            const fileResponse = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}/uploads/${encodedImageFilename}`);
            if (!fileResponse.ok) {
                throw new Error(`Error fetching encoded image: ${encodedImageFilename}`);
            }

            const fileBlob = await fileResponse.blob();
            console.log("File Blob received from Flask: ", fileBlob);  // Debug để kiểm tra fileBlob

            const ipfsData = new FormData();
            ipfsData.set("file", fileBlob);
            ipfsData.set("nftName", formParams.name); // Truyền NFT name khi upload ảnh
            updateMessage("Uploading image with watermark to IPFS...");

            const response = await uploadFileToIPFS(ipfsData);  // Upload lên IPFS
            if (response.success === true) {
                setBtn(true);
                updateMessage("Image uploaded successfully. You can now list the NFT.");
                setFileURL(response.pinataURL);
                // Ẩn nút upload sau khi upload hoàn tất
                setShowUploadButton(false);
                //setBtnContent("List NFT");  // Bật nút "List NFT" sau khi upload thành công
            } else {
                throw new Error("Failed to upload file to IPFS");
            }
        } catch (e) {
            console.error("Error during file upload process:", e);
            updateMessage("Error uploading image");
        }
    }

    // Hàm upload metadata của NFT lên IPFS
    async function uploadMetadataToIPFS() {
        const { name, description, copyrightInfo /*, price */ } = formParams;
        if (!name || !description || !copyrightInfo  /*|| !price */ || !fileURL) {
            updateMessage("Please fill all the fields!");
            return -1;
        }

        const nftJSON = {
            name,
            description,
            //price,
            image: fileURL,
            copyrightInfo, // Thêm thông tin bản quyền vào metadata
        };

        try {
            const response = await uploadJSONToIPFS(nftJSON);
            if (response.success === true) {
                return response.pinataURL;
            }
        } catch (e) {
            console.log("Error uploading JSON metadata: ", e);
        }
    }

    // Hàm list NFT lên Marketplace
    async function listNFT(e) {
        try {
            const metadataURL = await uploadMetadataToIPFS();
            if (metadataURL === -1) return;

            updateMessage("Uploading NFT...Please wait!");

            let contract = new ethers.Contract(
                marketplace.address,
                marketplace.abi,
                signer
            );
            //const price = ethers.parseEther(formParams.price);

            let transaction = await contract.createToken(metadataURL/*, price*/);
            await transaction.wait();

            updateMessage("");
            setBtnContent("Upload Image");
            updateFormParams({ name: "", description: "" /*, price: ""*/ });
            alert("Successfully listed your NFT!");
            router.push("/");
        } catch (e) {
            console.log("Error uploading NFT", e);
        }
    }

    return (
        <div className={styles.container}>
            <Header />
            {isConnected ? (
                <div className={styles.innerContainer}>
                    <div className={styles.content}>
                        <h2 className={styles.heading}>Upload your NFT</h2>
                        <div className={styles.Form}>
                            <div className={styles.FormContent}>
                                <label className={styles.Label}>NFT name</label>
                                <input
                                    type="text"
                                    className={styles.Input}
                                    value={formParams.name}
                                    onChange={(e) =>
                                        updateFormParams({ ...formParams, name: e.target.value })
                                    }
                                />
                            </div>
                            <div className={styles.FormContent}>
                                <label className={styles.Label}>NFT description</label>
                                <textarea
                                    type="text"
                                    className={`${styles.Input} ${styles.TextArea}`}
                                    value={formParams.description}
                                    onChange={(e) =>
                                        updateFormParams({
                                            ...formParams,
                                            description: e.target.value,
                                        })
                                    }
                                />
                            </div>
                            {/* <div className={styles.FormContent}>
                                <label className={styles.Label}>Price (in Eth)</label>
                                <input
                                    type="number"
                                    className={styles.Input}
                                    value={formParams.price}
                                    onChange={(e) =>
                                        updateFormParams({ ...formParams, price: e.target.value })
                                    }
                                />
                            </div> */}
                            <div className={styles.FormContent}>
                                <label className={styles.Label}>Upload image (Original image file)</label>
                                <input
                                    type="file"
                                    className={styles.Input}
                                    onChange={onFileChange} // Gọi khi người dùng chọn ảnh gốc
                                />
                            </div>
                            <div className={styles.FormContent}>
                                <label className={styles.Label}>Upload logo (Embedded logo file)</label>
                                <input
                                    type="file"
                                    className={styles.Input}
                                    onChange={onLogoFileChange} // Gọi khi người dùng chọn logo
                                />
                            </div>


                            <div className={styles.FormContent}>
                                <label className={styles.Label}>Copyright information</label>
                                <textarea
                                    className={`${styles.Input} ${styles.TextArea}`}
                                    value={formParams.copyrightInfo || ""}
                                    onChange={(e) =>
                                        updateFormParams({
                                            ...formParams,
                                            copyrightInfo: e.target.value,
                                        })
                                    }
                                />
                            </div>

                            <br></br>
                            <div className={styles.msg}>{message}</div>

                            {/* <button
                                onClick={handleUpload}  // Thực hiện Upload
                                type="submit"
                                className={`${styles.btn} ${styles.activebtn}`}
                            >
                                {btnContent}
                            </button> */}

                            {showUploadButton && (
                                <button
                                    onClick={handleUpload}  // Thực hiện Upload
                                    type="submit"
                                    className={`${styles.btn} ${styles.activebtn}`}
                                >
                                    {btnContent}
                                </button>
                            )}

                            <button
                                onClick={listNFT} // Nút "List NFT" chỉ bật sau khi Upload thành công
                                type="submit"
                                className={
                                    btn
                                        ? `${styles.btn} ${styles.activebtn}`
                                        : `${styles.btn} ${styles.inactivebtn}`
                                }
                                disabled={!btn}
                            >
                                List NFT
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={styles.innerContainer}>
                    <div className={styles.notConnected}>
                        Connect Your Wallet to Continue...
                    </div>
                </div>
            )}
            <Footer />
        </div>
    );
}
