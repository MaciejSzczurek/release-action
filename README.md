# Release Action

Release Action is a GitHub Actions workflow designed to facilitate the creation
of draft releases for your application on GitHub. It enables to generate release
names based on tags, create release descriptions from the latest commits in your
repository, and upload assets from a specified directory, provided it's
configured in the parameters.

## Features

- Automatically generates release names based on tags.
- Creates release descriptions using the latest commit messages.
- Uploads assets from a specified directory to the release.

## Usage

To use this action, add it to the steps in GitHub Actions workflow YAML file:

```yaml
- name: Create release draft
  uses: MaciejSzczurek/release-action@main
  with:
    # Repository name with owner. For example, actions/checkout
    # Default: ${{ github.repository }}
    repository: ''

    # Personal access token (PAT) used to fetch the repository. The PAT is configured
    # with the local git config, which enables your scripts to run authenticated git
    # commands. The post-job step removes the PAT.
    # Default: ${{ github.token }}
    token: ''

    # Location of assets to be added to the release.
    assets-directory: dir/assets-directory
```

## Contributing

Pull requests are always welcome.

## License

[Apache License, Version 2.0](https://www.apache.org/licenses/LICENSE-2.0)
