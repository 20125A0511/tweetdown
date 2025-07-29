/** @type {import('next').NextConfig} */
const nextConfig = {
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Don't resolve 'fs' module on the client to prevent this error on build --> Error: Can't resolve 'fs'
      config.resolve.fallback = {
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };
    }
    
    // Handle undici and other Node.js modules
    config.externals = config.externals || [];
    if (!isServer) {
      config.externals.push({
        'undici': 'commonjs undici',
        'node:fs': 'commonjs node:fs',
        'node:path': 'commonjs node:path',
        'node:url': 'commonjs node:url',
        'node:stream': 'commonjs node:stream',
        'node:util': 'commonjs node:util',
        'node:buffer': 'commonjs node:buffer',
        'node:events': 'commonjs node:events',
        'node:process': 'commonjs node:process',
        'node:querystring': 'commonjs node:querystring',
        'node:http': 'commonjs node:http',
        'node:https': 'commonjs node:https',
        'node:zlib': 'commonjs node:zlib',
        'node:os': 'commonjs node:os',
        'node:assert': 'commonjs node:assert',
        'node:constants': 'commonjs node:constants',
        'node:domain': 'commonjs node:domain',
        'node:punycode': 'commonjs node:punycode',
        'node:string_decoder': 'commonjs node:string_decoder',
        'node:timers': 'commonjs node:timers',
        'node:tty': 'commonjs node:tty',
        'node:vm': 'commonjs node:vm',
        'node:worker_threads': 'commonjs node:worker_threads',
        'node:child_process': 'commonjs node:child_process',
        'node:cluster': 'commonjs node:cluster',
        'node:dgram': 'commonjs node:dgram',
        'node:dns': 'commonjs node:dns',
        'node:fs/promises': 'commonjs node:fs/promises',
        'node:http2': 'commonjs node:http2',
        'node:https': 'commonjs node:https',
        'node:inspector': 'commonjs node:inspector',
        'node:module': 'commonjs node:module',
        'node:net': 'commonjs node:net',
        'node:perf_hooks': 'commonjs node:perf_hooks',
        'node:readline': 'commonjs node:readline',
        'node:repl': 'commonjs node:repl',
        'node:tls': 'commonjs node:tls',
        'node:trace_events': 'commonjs node:trace_events',
        'node:v8': 'commonjs node:v8',
        'node:wasm_web_api': 'commonjs node:wasm_web_api',
      });
    }
    
    return config;
  },
  experimental: {
    serverComponentsExternalPackages: ['cheerio', 'undici']
  }
}

module.exports = nextConfig 