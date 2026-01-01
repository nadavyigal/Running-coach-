const path = require("node:path")
const { spawnSync } = require("node:child_process")

const eslintPath = path.join(__dirname, "..", "node_modules", "eslint", "bin", "eslint.js")
const args = process.argv.slice(2)
const env = {
  ...process.env,
  ESLINT_USE_FLAT_CONFIG: "false",
}

const result = spawnSync(process.execPath, [eslintPath, ".", ...args], {
  stdio: "inherit",
  env,
})

process.exit(result.status ?? 1)
