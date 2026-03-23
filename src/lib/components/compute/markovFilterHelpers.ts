export function charBigrams(text:string, startend: {startToken?: string; endToken?: string}={}): [string,string][]{
    return extractBigrams(tokeniseChars(text), startend);
}
export function wordBigrams(text:string): [string,string][]{
    return extractBigrams(tokeniseWords(text));
}
export function subgraphedBigrams(text:string, subgraphId: string): [string,string][]{
    return extractSgBigrams(tokeniseWords(text), subgraphId);
}

export function tokeniseChars(text:string){
    return Array.from(text);
}

//word level tokeniser - for shake it off and TED. lowercases everything, gets rid of non alphanumeric chars, splits on whitespace
export function tokeniseWords(text:string): string[]{
    return text
        .toLowerCase()
        .replace(/[^a-z0-9\s'-]/g, "")
        .split(/\s+/)
        .filter(Boolean);
}

//extract bigram pairs for filtering 
export function extractBigrams(tokens: string[], startend: {startToken?: string; endToken?: string}={}): [string, string][]{
    if (tokens.length === 0) return [];
    const pairs: [string, string][] = [];
    if (startend.startToken) pairs.push([startend.startToken, tokens[0]]);

    for (let i=0; i< tokens.length -1; i++){
        pairs.push([tokens[i], tokens[i+1]]);
    }
    if (startend.endToken) pairs.push([tokens[tokens.length-1], startend.endToken]);

    return pairs;
}

//subgraph filter
export function extractSgBigrams(tokens: string[], subgraphId: string): [string, string][]{
    return extractBigrams(tokens.map(t => `${subgraphId}.${t}`));
}

