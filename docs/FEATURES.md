# Navigation Features

Uranus YAML resolves Argo Workflow calls in VS Code and Language Server Protocol clients. Use **Go to Definition** (`F12`, or Ctrl+Click in VS Code) from a call. Use **Find All References** (`Shift+F12`) from a declaration.

## Supported Navigation

| Call site | Definition target | Reference search from target |
| --- | --- | --- |
| `templateRef.template` | Template in a `WorkflowTemplate` or `ClusterWorkflowTemplate` | Matching `templateRef` calls and local calls in that reusable template |
| `templateRef.name` | Reusable-template `metadata.name` | Matching `templateRef` and `workflowTemplateRef` calls |
| `workflowTemplateRef.name` | Reusable-template `metadata.name` | Matching reusable-template calls |
| `entrypoint`, `onExit`, local `template`, hook `template` | Template in the same Argo resource | Local calls in that resource |
| DAG `dependencies` or `depends` task name | DAG task declaration in the same template | Dependencies on that task |

When a `templateRef` or `workflowTemplateRef` block includes `clusterScope: true`, lookup is limited to `ClusterWorkflowTemplate`. Without it, lookup uses `WorkflowTemplate`.

## Scope Rules

- Local template calls are matched inside the surrounding `Workflow`, `CronWorkflow`, or reusable-template resource.
- DAG dependency references are matched only within the same DAG template; similarly named tasks in other templates do not match.
- Enhanced `depends` expressions match the task prefix in values such as `build.Succeeded`; result suffixes are not declarations.
- Cross-resource templates are disambiguated by the reusable-template name and cluster scope, not by template name alone.

## Fixtures

- `packages/core/test-files/workflow.yaml` and `tem1.yaml`: basic cross-resource navigation.
- `packages/core/test-files/multiple-templates.yaml` and `complex-workflow.yaml`: same-named template disambiguation.
- `packages/core/test-files/argo-call-methods.yaml`: local calls and namespaced versus cluster-scoped reusable templates.
- `packages/core/test-files/dag-dependencies.yaml`: inline `dependencies`, multiline `dependencies`, and enhanced `depends`.

See [TESTING.md](TESTING.md) for verification steps.
