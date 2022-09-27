# kustomize-action [![ts](https://github.com/int128/kustomize-action/actions/workflows/ts.yaml/badge.svg)](https://github.com/int128/kustomize-action/actions/workflows/ts.yaml)

This is an action to run `kustomize build` in parallel.


## Problem to solve

If `kustomization.yaml` depends on an external resource such as HTTPS, `kustomize build` takes a long time.
For GitOps, a manifest repository contains many `kustomization.yaml` and it would be take a very long time to build all.
This action builds them in parallel to reduce time.


## Getting Started

To build manifests, create a workflow as follows:

```yaml
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: int128/kustomize-action@v1
        id: kustomize
        with:
          kustomization: overlays/*/kustomization.yaml
      - run: find ${{ steps.kustomize.outputs.directory }}
```

If the following files are matched,

```
overlays/development/kustomization.yaml
overlays/production/kustomization.yaml
```

this action writes the manifests to a temporary directory.
You can get the paths from `outputs.files`, for example,

```
/tmp/kustomize-action-xyz/overlays/development/generated.yaml
/tmp/kustomize-action-xyz/overlays/production/generated.yaml
```

You can get the base directory from `outputs.directory`, for example,

```
/tmp/kustomize-action-xyz
```


### Errors

If `kustomize build` returned an error, 
you can see it from GitHub Actions summary page or pull request review comment.

<img width="860" alt="image" src="https://user-images.githubusercontent.com/321266/191903175-24c69251-0ef9-4515-8a24-91c9c3c5e598.png">

<img width="860" alt="image" src="https://user-images.githubusercontent.com/321266/191903273-db04a861-b9ff-4157-8e15-ba169e33e09b.png">

As well as you can set `error-comment` input to post a comment to a pull request.

<img width="920" alt="image" src="https://user-images.githubusercontent.com/321266/174432028-24a3cc12-e3b0-45a6-aa5a-8137eb8237fe.png">

You can set `ignore-kustomize-error` input to suppress kustomize errors.
If it is set to true,

- It exits successfully even if kustomize exited with non-zero code
- It does not add a pull request review comment
- It dows not add an error annotation

### Write individual files

You can set `write-individual-files` to write individual files (see [kustomize#960](https://github.com/kubernetes-sigs/kustomize/pull/960)).

```yaml
      - uses: int128/kustomize-action@v1
        with:
          kustomization: overlays/*/kustomization.yaml
          write-individual-files: true
```

This action writes the individual manifests as follows:

```
/tmp/kustomize-action-xyz/overlays/development/apps_v1_deployment_echoserver.yaml
/tmp/kustomize-action-xyz/overlays/development/v1_service_echoserver.yaml
/tmp/kustomize-action-xyz/overlays/production/apps_v1_deployment_echoserver.yaml
/tmp/kustomize-action-xyz/overlays/production/v1_service_echoserver.yaml
```


### Copy extra files

You can set `extra-files` to copy the extra files with the results of `kustomize build`.

```yaml
      - uses: int128/kustomize-action@v1
        with:
          kustomization: overlays/*/kustomization.yaml
          extra-files: overlays/*/metadata.yaml
```

This action writes the generated manifests with the extra files as follows:

```
/tmp/kustomize-action-xyz/overlays/development/generated.yaml
/tmp/kustomize-action-xyz/overlays/development/metadata.yaml
/tmp/kustomize-action-xyz/overlays/production/generated.yaml
```


## Diff between head and base ref of pull request

When you open or update a pull request, you can see the diff of generated manifests between head and base ref.
See [kustomize-diff-action](diff/) for details.


## Inputs

| Name | Default | Description
|------|----------|------------
| `kustomization` | (required) | glob patterns to `kustomization.yaml`
| `extra-files` | - | glob patterns to extra files to copy
| `base-directory` | (workspace) | base directory to compute a relative path to `kustomization.yaml`
| `retry-max-attempts` | 2 | max attempts of retry to run kustomize (0 = no retry)
| `retry-wait-ms` | 2,000 (2s) | wait before retry kustomize in milliseconds
| `max-process` | 5 | max number of kustomize processes
| `write-individual-files` | `false` | set true to write individual files
| `ignore-kustomize-error` | `false` | set true to ignore kustomize errors
| `error-comment` | `false` | post a comment on error
| `error-comment-header` | - | header in a comment to post on error
| `error-comment-footer` | - | footer in a comment to post on error
| `token` | `github.token` | GitHub token to post a comment on error

### Retry options

Eventually `kustomize` command fails due to a temporary error such as network error.
This action retries if `kustomize` command returned non-zero exit status.

You can turn off the retry by `retry-max-attempts` option.


## Outputs

| Name | Description
|------|------------
| `directory` | directory to results of `kustomize build`
| `files` | multi-line string of files generated by `kustomize build`
