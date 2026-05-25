# Feature Summary: Go to Definition + Find All References

## Overview

Your VS Code extension now supports **two complementary features** for Argo WorkflowTemplate navigation:

1. **Go to Definition** - Navigate TO template definitions
2. **Find All References** - Navigate FROM template definitions to see where they're used

## How It Works

### 1. Go to Definition (Ctrl+Click in usage files)

**When**: Clicking on template references in Workflow/CronWorkflow files
**What**: Navigate to the template definition

```yaml
# In workflow.yaml - Ctrl+Click on "step1" here:
templateRef:
  name: tem-tem1
  template: step1  # Click here to go to tem1.yaml line 7
```

### 2. Find All References (Shift+F12 in definition files)

**When**: Clicking on template names in WorkflowTemplate files
**What**: Show all places where this template is referenced

```yaml
# In tem1.yaml - Shift+F12 on "step1" here:
spec:
  templates:
    - name: step1  # Click here to show all references
      container:
        image: alpine
```

## Test Scenarios

### Scenario 1: "Where is this template defined?"
1. Open `workflow.yaml`
2. Ctrl+Click on `step1` in `templateRef.template`
3. Jumps to `tem1.yaml` template definition

### Scenario 2: "Where is this template used?"
1. Open `tem1.yaml`
2. Press Shift+F12 on `step1` in `- name: step1`
3. Shows references panel with all usages:
   - `workflow.yaml` line 13
   - `cronworkflow.yaml` line 13
   - `composite-template.yaml` lines 8, 19

### Scenario 3: "Disambiguate same-named templates"
1. Multiple WorkflowTemplates have `step1` templates
2. Extension correctly uses `templateRef.name` to find the right one
3. References are grouped by WorkflowTemplate name

### Scenario 4: "Use local calls and DAG dependencies"
1. Use Go to Definition on `entrypoint`, `onExit`, local `template`, `dependencies`, or `depends`
2. Navigation resolves the local template or DAG task declaration in the same Argo resource
3. Find All References on that declaration returns its callers or dependent tasks

### Scenario 5: "Select cluster-scoped reusable templates"
1. Set `clusterScope: true` in `templateRef` or `workflowTemplateRef`
2. Go to Definition resolves `ClusterWorkflowTemplate`, not a same-named `WorkflowTemplate`

## Files for Testing

- **Template Definitions**:
  - `tem1.yaml` - Simple templates (step1, step2)
  - `multiple-templates.yaml` - Overlapping template names

- **Template Usage**:
  - `workflow.yaml` - Basic Workflow
  - `cronworkflow.yaml` - Scheduled workflows
  - `composite-template.yaml` - WorkflowTemplate using other templates
  - `complex-workflow.yaml` - Complex disambiguation cases

## VS Code UI Integration

- **Go to Definition**: Uses VS Code's built-in "Go to Definition" (F12)
- **Find All References**: Uses VS Code's built-in "Find All References" (Shift+F12)
- **References Panel**: Shows in VS Code's References view with file paths and line numbers

## Performance Features

- **Parallel Processing**: Multiple files processed concurrently
- **Intelligent Caching**: File contents cached with auto-invalidation
- **Cancellation Support**: Long operations can be cancelled
- **Smart Filtering**: Skips irrelevant directories (node_modules, .git, etc.)

Both features work together to provide a complete navigation experience for Argo WorkflowTemplate development!
