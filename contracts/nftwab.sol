// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title NFTWAB Marketplace with watermark protection
contract nftwab is ERC721URIStorage, EIP712 {
    using ECDSA for bytes32;

    address payable public marketplaceOwner;
    uint256 public listingFeePercent = 20;
    uint256 private currentTokenId;
    uint256 private totalItemsSold;

    // On-chain watermark checksum per token
    mapping(uint256 => bytes32) public watermarkHash;
    // Prevent same watermark from minting multiple tokens
    mapping(bytes32 => bool) public watermarkUsed;

    // Event to log on-chain watermark verification
    event WatermarkChecked(
        uint256 indexed tokenId,
        address indexed checker,
        uint256 timestamp,
        bytes32 resultHash
    );

    struct NFTListing {
        uint256 tokenId;
        address payable owner;
        address payable seller;
    }
    mapping(uint256 => NFTListing) private tokenIdToListing;

    // EIP-712 type hash for MintRequest
    bytes32 private constant _MINTREQUEST_TYPEHASH =
        keccak256("MintRequest(string tokenURI,bytes32 watermarkHash)");

    modifier onlyOwner() {
        require(msg.sender == marketplaceOwner, "Only owner can call this function");
        _;
    }

    constructor() ERC721("nftwab", "NFTWAB") EIP712("NFTWAB", "1") {
        marketplaceOwner = payable(msg.sender);
    }

    /**
     * @dev Mint a new token, store its URI and watermark hash on-chain.
     *      Requires a valid EIP-712 signature by the contract owner.
     */
    function createToken(
        string memory _tokenURI,
        bytes32 _watermarkHash,
        bytes memory signature
    ) public returns (uint256) {
        // Verify EIP-712 signature
        bytes32 structHash = keccak256(
            abi.encode(
                _MINTREQUEST_TYPEHASH,
                keccak256(bytes(_tokenURI)),
                _watermarkHash
            )
        );
        bytes32 digest = _hashTypedDataV4(structHash);
        address signer = digest.recover(signature);
        require(signer == marketplaceOwner, "Invalid or unauthorized signature");

        // Ensure this watermark hasn't been minted before
        require(!watermarkUsed[_watermarkHash], "Watermark already used");
        watermarkUsed[_watermarkHash] = true;

        // Proceed with minting
        currentTokenId++;
        uint256 newTokenId = currentTokenId;

        _safeMint(msg.sender, newTokenId);
        _setTokenURI(newTokenId, _tokenURI);

        // Store watermark checksum on-chain
        watermarkHash[newTokenId] = _watermarkHash;

        tokenIdToListing[newTokenId] = NFTListing(
            newTokenId,
            payable(msg.sender),
            payable(msg.sender)
        );

        return newTokenId;
    }

    /**
     * @dev Verify extracted watermark hash against on-chain record and emit event.
     */
        /**
     * @dev Verify extracted watermark hash against on-chain record and emit event.
     */
    function verifyWatermark(uint256 tokenId, bytes32 extractedHash) external {
        // Ensure token was minted (has watermarkHash)
        require(watermarkHash[tokenId] != bytes32(0), "Token does not exist");
        require(extractedHash == watermarkHash[tokenId], "Watermark mismatch");

        emit WatermarkChecked(
            tokenId,
            msg.sender,
            block.timestamp,
            extractedHash
        );
    }

    function updateListingFeePercent(uint256 _listingFeePercent) public onlyOwner {
        listingFeePercent = _listingFeePercent;
    }

    function getListingFeePercent() public view returns (uint256) {
        return listingFeePercent;
    }

    function getCurrentTokenId() public view returns (uint256) {
        return currentTokenId;
    }

    function getNFTListing(uint256 _tokenId) public view returns (NFTListing memory) {
        return tokenIdToListing[_tokenId];
    }

    function executeSale(uint256 tokenId) public payable {
        NFTListing storage listing = tokenIdToListing[tokenId];
        address payable seller = listing.seller;

        require(listing.owner != msg.sender, "You already own this NFT");

        _transfer(listing.owner, msg.sender, tokenId);

        listing.owner = payable(msg.sender);
        listing.seller = payable(msg.sender);

        totalItemsSold++;

        seller.transfer(msg.value);
    }

    function getAllListedNFTs() public view returns (NFTListing[] memory) {
        uint256 totalNFTCount = currentTokenId;
        NFTListing[] memory listedNFTs = new NFTListing[](totalNFTCount);

        for (uint256 i = 0; i < totalNFTCount; i++) {
            listedNFTs[i] = tokenIdToListing[i + 1];
        }

        return listedNFTs;
    }

    function getMyNFTs() public view returns (NFTListing[] memory) {
        uint256 totalNFTCount = currentTokenId;
        uint256 myNFTCount = 0;

        for (uint256 i = 0; i < totalNFTCount; i++) {
            NFTListing storage listing = tokenIdToListing[i + 1];
            if (listing.owner == msg.sender || listing.seller == msg.sender) {
                myNFTCount++;
            }
        }

        NFTListing[] memory myNFTs = new NFTListing[](myNFTCount);
        uint256 idx = 0;
        for (uint256 i = 0; i < totalNFTCount; i++) {
            NFTListing storage listing = tokenIdToListing[i + 1];
            if (listing.owner == msg.sender || listing.seller == msg.sender) {
                myNFTs[idx++] = listing;
            }
        }

        return myNFTs;
    }
}
