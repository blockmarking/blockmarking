export default function GetIpfsUrlFromPinata(pinataUrl) {
  let IPFSUrl = pinataUrl.split("/");
  const lastIndex = IPFSUrl.length;
  IPFSUrl = "https://gateway.pinata.cloud/ipfs/" + IPFSUrl[lastIndex - 1];
  return IPFSUrl;
}
