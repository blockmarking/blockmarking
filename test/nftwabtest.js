const { expect } = require("chai");
const { ethers } = require("hardhat");

let nftwab, owner, addr1, addr2;

beforeEach(async function () {
  nftwab = await ethers.deployContract("nftwab");
  [owner, addr1, addr2, _] = await ethers.getSigners();
});

describe("Deployment", function () {
  it("Should set the right owner", async () => {
    const marketplaceOwner = await nftwab.marketplaceOwner();
    expect(marketplaceOwner).to.equal(owner);
  });

  it("Should set the listing fee percentage", async function () {
    const listingFeePercentage = await nftwab.getListingFeePercent();
    expect(listingFeePercentage).to.equal(20);
  });
});

describe("Creating NFTs", function () {
  it("Should create a new token and listing", async function () {
    const tokenURI = "https://example.com/nft";
    const price = ethers.parseEther("1");

    await nftwab.createToken(tokenURI, price);

    const listing = await nftwab.getNFTListing(1);
    expect(listing.tokenId).to.equal(1);
    expect(listing.owner).to.equal(owner);
    expect(listing.price).to.equal(price);
  });
});

describe("Updating Listing Fee", function () {
  it("Should update the listing fee percentage", async function () {
    await nftwab.updateListingFeePercent(10);
    expect(await nftwab.getListingFeePercent()).to.equal(10);
  });

  it("Should only allow owner to update the listing fee percentage", async function () {
    await expect(
      nftwab.connect(addr1).updateListingFeePercent(10)
    ).to.be.revertedWith("Only owner can call this function");
  });
});

describe("Executing Sales", function () {
  beforeEach(async function () {
    const tokenURI = "https://example.com/nft";
    const price = ethers.parseEther("1");
    await nftwab.createToken(tokenURI, price);
  });

  it("Should execute a sale", async function () {
    const price = ethers.parseEther("1");
    await nftwab.connect(addr1).executeSale(1, { value: price });

    const listing = await nftwab.getNFTListing(1);
    expect(listing.seller).to.equal(addr1);
    expect(listing.owner).to.equal(owner);
  });

  it("Should revert if the payment is incorrect", async function () {
    const incorrectPrice = ethers.parseEther("0.5");
    await expect(
      nftwab.connect(addr1).executeSale(1, { value: incorrectPrice })
    ).to.be.revertedWith(
      "Please submit the asking price to complete the purchase"
    );
  });
});

describe("Retrieving NFTs", function () {
  beforeEach(async function () {
    const tokenURI1 = "https://example.com/nft1";
    const tokenURI2 = "https://example.com/nft2";
    const price = ethers.parseEther("1");

    await nftwab.createToken(tokenURI1, price);
    await nftwab.createToken(tokenURI2, price);
  });

  it("Should retrieve all listed NFTs", async function () {
    const allNFTs = await nftwab.getAllListedNFTs();
    expect(allNFTs.length).to.equal(2);
  });

  it("Should retrieve my NFTs", async function () {
    const myNFTs = await nftwab.getMyNFTs();
    expect(myNFTs.length).to.equal(2);
  });
});
