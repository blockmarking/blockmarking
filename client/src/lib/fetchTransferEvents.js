export async function fetchTransferEvents(contract) {
    try {
        const provider = contract.runner.provider;
        const latestBlock = await provider.getBlockNumber();

        const BATCH_SIZE = 500; 
        const startBlock = 8673700; // 🟢 Tùy chỉnh sát với block mint

        let fromBlock = startBlock;
        const allEvents = [];

        while (fromBlock <= latestBlock) {
            const toBlock = Math.min(fromBlock + BATCH_SIZE - 1, latestBlock);
            console.log(`📦 Đang lấy log từ block ${fromBlock} đến ${toBlock}`);

            const events = await contract.queryFilter(
                contract.filters.Transfer(null, null),
                fromBlock,
                toBlock
            );

            allEvents.push(...events);
            fromBlock = toBlock + 1;
        }

        return allEvents;
    } catch (err) {
        console.error("❌ fetchTransferEvents error:", err);
        return [];
    }
}
