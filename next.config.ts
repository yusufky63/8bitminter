import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactStrictMode: false, // Hydration hatalarını önlemek için strictMode'u devre dışı bırakıyoruz
  
  // İstemci tarafı paketleri sunucu tarafında import etmeyi engelle
  webpack: (config, { dev, isServer }) => {
    // SSR sırasında istemci tarafı modülleri boş modülle değiştir
    if (isServer) {
      // Sunucu tarafında boş modül kullanmak için
      const originalEntry = config.entry;
      
      config.externals = [...(config.externals || []), {
        '@farcaster/frame-sdk': 'commonjs @farcaster/frame-sdk',
        '@rainbow-me/rainbowkit': 'commonjs @rainbow-me/rainbowkit',
        '@zoralabs/protocol-sdk': 'commonjs @zoralabs/protocol-sdk'
      }];
    }
    
    if (!dev && !isServer) {
      // Production client build için React strictMode'u devre dışı bırak
      Object.assign(config.resolve.alias, {
        'react': 'react',
        'react-dom': 'react-dom'
      });
    }
    
    return config;
  },
  
  // Bu paketleri yalnızca istemci tarafında kullan
  // transpilePackages ve serverExternalPackages için aynı paketleri kullanmamak gerekiyor
  serverExternalPackages: [
    '@farcaster/frame-sdk',
    '@rainbow-me/rainbowkit',
    '@zoralabs/protocol-sdk'
  ]
};

export default nextConfig;
