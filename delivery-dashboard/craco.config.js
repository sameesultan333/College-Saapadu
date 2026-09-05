module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      webpackConfig.ignoreWarnings = [
        ...(webpackConfig.ignoreWarnings || []),
        {
          module: /@zxing[\\/]browser/,
          message: /Failed to parse source map/,
        },
      ];

      return webpackConfig;
    },
  },
};
