# kustomize-diff-action

This is a composite action to show the diff of `kustomize build` between head and base ref of a pull request.
It depends on https://github.com/int128/diff-action.

## Getting Started

Here is an example for a project of kubebuilder.

```yaml
name: manifest

on:
  pull_request:
    branches: [master]
    paths:
      - config/**
      - .github/workflows/manifest.yaml

jobs:
  diff:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v3
      - uses: int128/kustomize-action/diff@v1
        with:
          write-individual-files: true
          kustomization: |
            config/default/kustomization.yaml
```
