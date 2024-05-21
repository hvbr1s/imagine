const webpack = require('webpack');

module.exports = function override(config) {
  config.resolve.fallback = {
    url: require.resolve('url/'),
    crypto: require.resolve('crypto-browserify'),
    stream: require.resolve('stream-browserify'),
    assert: require.resolve('assert/'),
    http: require.resolve('stream-http'),
    https: require.resolve('https-browserify'),
    os: require.resolve('os-browserify/browser'),
    buffer: require.resolve('buffer/'),
    zlib: require.resolve('browserify-zlib')
  };

  config.plugins = [
    ...config.plugins,
    new webpack.ProvidePlugin({
      process: 'process/browser',
      Buffer: ['buffer', 'Buffer']
    })
  ];

  return config;
};
