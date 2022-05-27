declare const PAGE_INDEX: KVNamespace;

const stopWords = /^(I|a|about|an|are|as|at|be|by|com|for|from|how|in|is|it|of|on|or|that|the|the|this|to|was|what|when|where|who|will|with)$/i;
export function searchWords(s: string): string[] {
    return s.split(/\W/).filter(s => !s.match(/\W/) && !s.match(stopWords) && !(s.length == 0));
}

async function index(pageName: string, pageContent: string): Promise<string[]> {
    const pageWords = Array.from(new Set(searchWords(pageContent)));
    for (const word of pageWords) {
        find([word]).then((pages) => {
            if (pages.includes(pageName)) {
                return;
            }
            pages.push(pageName);
            PAGE_INDEX.put(word, JSON.stringify(pages));
        })
    }
    return pageWords;
}

async function find(words: string[]): Promise<string[]> {
    let hits: string[] = [];
    for (const word of words) {
        const pages = await PAGE_INDEX.get(word).then(result => JSON.parse(result || '[]'));
        hits.push(...pages);
    }
    hits = Array.from(new Set(hits));
    hits.sort();
    return hits;
}

async function clear(): Promise<void> {
    const allKeys = (await PAGE_INDEX.list()).keys.map(k => k.name);
    for (const name of allKeys) {
        await PAGE_INDEX.delete(name);
    }
}

export default { index, find, clear }
