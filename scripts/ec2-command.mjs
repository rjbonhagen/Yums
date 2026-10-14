import { readFileSync, writeFileSync } from 'node:fs'

const image = process.env.IMAGE_URI || ''
if (!/^\d{12}\.dkr\.ecr\.[a-z0-9-]+\.amazonaws\.com\/[a-z0-9/_.-]+@sha256:[a-f0-9]{64}$/.test(image)) {
  throw new Error('IMAGE_URI must be a private ECR image digest URI')
}
const script = readFileSync(new URL('../infra/release-ec2.sh', import.meta.url), 'utf8').replace(/\r\n/g, '\n')
const encoded = Buffer.from(script).toString('base64')
writeFileSync(process.argv[2] || 'ec2-command.json', JSON.stringify({ commands: [
  'install -d -m 755 /opt/yums',
  `printf '%s' '${encoded}' | base64 --decode > /opt/yums/release.sh`,
  'chmod 700 /opt/yums/release.sh',
  `/opt/yums/release.sh '${image}'`,
] }))
