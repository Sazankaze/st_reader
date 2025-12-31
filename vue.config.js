const { defineConfig } = require('@vue/cli-service')
module.exports = {
  // 这里的 /你的仓库名/ 必须和你 GitHub 上创建的仓库名称完全一致，前后都要有斜杠
  publicPath: process.env.NODE_ENV === 'production'
    ? '/st_reader/'
    : '/'
}