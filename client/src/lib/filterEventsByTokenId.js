// lib/filterEventsByTokenId.js
export function filterEventsByTokenId(events, tokenId) {
    return events.filter((event) =>
        event.args &&
        event.args.tokenId &&
        event.args.tokenId.toString() === tokenId.toString()
    );
}
