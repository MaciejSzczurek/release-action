import { getInput, info } from '@actions/core'
import { getOctokit } from '@actions/github'
import { StatusCodes } from 'http-status-codes'
import { readdir, readFile } from 'fs/promises'
// @ts-expect-error CommonJS module error
import mime from 'mime'

async function run(): Promise<void> {
  const token = getInput('token')
  const octokit = getOctokit(token)
  const [owner, repo] = getInput('repository').split('/')

  const [latestRelease, tagToRelease] = await Promise.all([
    octokit.rest.repos.getLatestRelease({
      repo,
      owner
    }),
    octokit.rest.repos
      .listTags({
        repo,
        owner,
        page: 1,
        per_page: 1
      })
      .then(release => release.data[0])
  ])

  const body =
    latestRelease.status !== +StatusCodes.NOT_FOUND
      ? await octokit.rest.repos
          .compareCommits({
            repo,
            owner,
            base: `tags/${latestRelease.data.tag_name}`,
            head: `tags/${tagToRelease.name}`
          })
          .then(({ data: { commits } }) =>
            commits.map(({ commit: { message } }) => `* ${message}`).join('\n')
          )
          .then(
            commitMessages => `# Changelog

${commitMessages}

**Full Changelog**: https://github.com/${owner}/${repo}/compare/${latestRelease.data.tag_name}...${tagToRelease.name}`
          )
      : await octokit
          .paginate(octokit.rest.repos.compareCommits, {
            repo,
            owner,
            base: tagToRelease.name,
            head: 'master'
          })
          .then(({ commits }) =>
            commits.map(({ commit: { message } }) => `* ${message}`).join('\n')
          )
          .then(
            commitMessages => `# Changelog

${commitMessages}`
          )

  const release = await octokit.rest.repos.createRelease({
    name: tagToRelease.name,
    repo,
    owner,
    body,
    draft: true,
    tag_name: tagToRelease.name
  })

  info(`Created draft release ${release.data.name}`)

  const assetsPath = getInput('assets-directory')
  if (assetsPath !== '') {
    info('Set up assets directory')

    const files = await readdir(assetsPath, { withFileTypes: true })
    for (const { name, path } of files.filter(file => file.isFile())) {
      info(`Uploading file ${name}`)
      const { headers, method, url } =
        octokit.rest.repos.uploadReleaseAsset.endpoint({
          repo,
          owner,
          release_id: release.data.id,
          name
        })
      const data = await readFile(`${path}/${name}`)
      await fetch(url, {
        method,
        headers: {
          accept: headers.accept ?? '',
          'user-agent': headers['user-agent'] ?? '',
          'content-type': mime.getType(name) ?? 'application/octet-stream',
          'content-length': `${data.length}`,
          authorization: `bearer ${token}`
        },
        body: data
      })
    }
  }
}

// noinspection JSIgnoredPromiseFromCall
run()
