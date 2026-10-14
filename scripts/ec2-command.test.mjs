import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, sep } from 'node:path'
import { spawnSync } from 'node:child_process'

test('release command uses a validated digest and preserves shell source without line ending changes', () => {
  const directory = mkdtempSync(join(tmpdir(), 'yums-command-'))
  try {
    const output = join(directory, 'command.json')
    const image = `123456789012.dkr.ecr.us-west-1.amazonaws.com/pilot@sha256:${'a'.repeat(64)}`
    const run = spawnSync(process.execPath, ['scripts/ec2-command.mjs', output], { env: { ...process.env, IMAGE_URI: image }, encoding: 'utf8' })
    assert.equal(run.status, 0, run.stderr)
    const { commands } = JSON.parse(readFileSync(output, 'utf8'))
    const encoded = commands[1].match(/printf '%s' '([^']+)'/)[1]
    assert.equal(Buffer.from(encoded, 'base64').toString(), readFileSync('infra/release-ec2.sh', 'utf8').replace(/\r\n/g, '\n'))
    assert.equal(commands.at(-1), `/opt/yums/release.sh '${image}'`)
  } finally {
    assert.ok(realpathSync(directory).startsWith(`${realpathSync(tmpdir())}${sep}yums-command-`))
    rmSync(directory, { recursive: true, force: true })
  }
})

for (const image of ['repo:latest', 'https://example.com/image', "repo'; touch /tmp/unwanted", '']) {
  test(`rejects an invalid or mutable release reference: ${JSON.stringify(image)}`, () => {
    const run = spawnSync(process.execPath, ['scripts/ec2-command.mjs'], { env: { ...process.env, IMAGE_URI: image }, encoding: 'utf8' })
    assert.notEqual(run.status, 0)
    assert.match(run.stderr, /private ECR image digest URI/)
  })
}
