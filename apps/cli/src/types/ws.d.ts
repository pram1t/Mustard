/**
 * Local declaration shim for the optional `ws` dependency. The CLI
 * imports `ws` only inside `collab tail`. We don't want to add
 * @types/ws as a dependency just for that surface, and ws ships no
 * types of its own. The actual runtime contract we use is the small
 * MinimalWS interface declared in collab.ts.
 */
declare module 'ws';
