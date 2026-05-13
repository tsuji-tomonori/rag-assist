import { spawnSync } from 'node:child_process'

const inputArgs = process.argv.slice(2)
const args = ['run']

for (const arg of inputArgs) {
  if (arg === '--runInBand') {
    args.push('--maxWorkers=1')
    continue
  }

  args.push(arg)
}

const result = spawnSync('vitest', args, { stdio: 'inherit', shell: true })

if (result.error) {
  console.error(result.error)
  process.exit(1)
}

process.exit(result.status ?? 1)
