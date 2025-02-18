import { defineConfig } from 'vitest/config.js';

export default defineConfig({
    test: {
        globals: true,
    },
    resolve: {
        alias: [
            {
                find: /^@elizaos\/core$/,
                replacement: '../core/src/index.ts'
            },
            {
                find: /^attps-sdk-js$/,
                replacement: '../node_modules/attps-sdk-js/src/index.ts'
            }
        ]
    }
});
