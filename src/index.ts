import * as core from '@actions/core'
import * as github from '@actions/github'
import { StatusCodes } from 'http-status-codes'
import * as fs from 'fs/promises'
// @ts-ignore
import mime from 'mime'

async function run(): Promise<void> {
  const token = core.getInput('token')
  const octokit = github.getOctokit(token)
  const [owner, repo] = core.getInput('repository').split('/')

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

  core.info(`Created draft release ${release.data.name}`)

  const assetsPath = core.getInput('assets-directory')
  if (assetsPath !== '') {
    core.info('Set up assets directory')

    fs.readdir(assetsPath, { withFileTypes: true })
      .then(files => files.filter(file => file.isFile()))
      .then(files =>
        files.map(({ name, path }) => {
          core.info(`Uploading file ${name}`)
          const { headers, method, url } =
            octokit.rest.repos.uploadReleaseAsset.endpoint({
              repo,
              owner,
              release_id: release.data.id,
              name
            })
          return fs.readFile(`${path}/${name}`).then(data =>
            fetch(url, {
              method,
              headers: {
                accept: headers.accept ?? '',
                'user-agent': headers['user-agent'] ?? '',
                'content-type':
                  mime.getType(name) ?? 'application/octet-stream',
                'content-length': `${data.length}`,
                authorization: `bearer ${token}`
              },
              body: data
            })
          )
        })
      )
  }
}

run().then()
