/** @type {import('prettier').Config} */
const prettierConfig = {
  plugins: ['prettier-plugin-embed', 'prettier-plugin-sql'],
  singleQuote: true,
  trailingComma: 'all',
}

/** @type {import('prettier-plugin-embed').PrettierPluginEmbedOptions} */
const prettierPluginEmbedConfig = {
  embeddedSqlTags: ['sql'],
}

/** @type {import('prettier-plugin-sql').SqlBaseOptions} */
const prettierPluginSqlConfig = {
  language: 'postgresql',
  keywordCase: 'upper',
}

const config = {
  ...prettierPluginEmbedConfig,
  ...prettierPluginSqlConfig,
  ...prettierConfig,
}

export default config