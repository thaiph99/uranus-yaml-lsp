
# VS Code Usage

This guide explains how to use the Uranus YAML VS Code extension.

## ✨ Features

- **🎯 Smart Context-Aware Navigation**: Single Ctrl+Click does different actions based on where you click
- **📍 Go to Definition**: Navigate from template references to their definitions
- **🔍 Find All References**: Show all usages of templates and WorkflowTemplates
- **⚡ High Performance**: Parallel processing, intelligent caching, and smart filtering
- **🎨 Intelligent Disambiguation**: Handles multiple templates with same names correctly
- **🌐 Cross-Resource Support**: Works with Workflows, WorkflowTemplates, CronWorkflows, etc.

## 🚀 How It Works

The extension uses **context-aware navigation** - a single **Ctrl+Click** performs different actions based on what you're clicking on:

### Context 1: Template Reference → Go to Definition

**When**: Ctrl+Click on template references in usage files
**Action**: Navigate to template definition

```yaml
# In workflow.yaml - Ctrl+Click on "step1":
templateRef:
  name: tem-tem1
  template: step1  # ← Ctrl+Click here goes to definition in tem1.yaml
```

### Context 2: Template Definition → Find All References

**When**: Ctrl+Click on template names in WorkflowTemplate definition files
**Action**: Show all references to this template

```yaml
# In tem1.yaml - Ctrl+Click on "step1":
spec:
  templates:
    - name: step1  # ← Ctrl+Click here shows all references
      container:
        image: alpine
```

### Context 3: WorkflowTemplate Name → Find All References

**When**: Ctrl+Click on WorkflowTemplate names in metadata section
**Action**: Show all references to this WorkflowTemplate

```yaml
# In tem1.yaml - Ctrl+Click on "tem-tem1":
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: tem-tem1  # ← Ctrl+Click here shows all WorkflowTemplate references
spec:
  templates:
    - name: step1
```

## 🧪 Testing & Examples

### Example Files Structure

```
test-files/
├── tem1.yaml                    # WorkflowTemplate with step1, step2
├── workflow.yaml                # Workflow referencing tem1
├── multiple-templates.yaml      # Multiple WorkflowTemplates with overlapping names
├── composite-template.yaml      # WorkflowTemplate using other templates
├── cronworkflow.yaml           # CronWorkflow referencing templates
└── ...
```

### Test Cases

#### Test Case 1: Go to Definition

1. Open `workflow.yaml`
2. Ctrl+Click on `step1` in `template: step1`
3. **Expected**: Navigate to `tem1.yaml` line 7 (`- name: step1`)

#### Test Case 2: Find Template References

1. Open `tem1.yaml`
2. Ctrl+Click on `step1` in `- name: step1`
3. **Expected**: Shows references in:
   - `workflow.yaml`
   - `cronworkflow.yaml`
   - `composite-template.yaml`

#### Test Case 3: Find WorkflowTemplate References

1. Open `tem1.yaml`
2. Ctrl+Click on `tem-tem1` in `name: tem-tem1`
3. **Expected**: Shows all WorkflowTemplate references across workspace

#### Test Case 4: Disambiguation

1. Open `complex-workflow.yaml`
2. Multiple WorkflowTemplates have `step1` templates
3. Ctrl+Click correctly uses `templateRef.name` to find the right template

## 📋 Requirements

- VS Code 1.80.0 or higher
- YAML language support (usually built-in)
- Files must be in a workspace folder

## 🐛 Troubleshooting

### Common Issues

**Extension not working?**

- Check that extension is activated (look for "Uranus YAML extension activated" message)
- Ensure you're in a `.yaml` file (check bottom right corner shows "YAML")
- Try clicking directly on the template name, not surrounding whitespace

**No results found?**

- Verify YAML structure is correct (proper indentation)
- Check that WorkflowTemplate and template names match exactly
- Look for typos in template names

**Performance issues?**

- Large workspaces may take longer to search
- Check VS Code Developer Console for error messages
- Try reloading the window (Ctrl+R)

### Debug Mode

1. Open VS Code Developer Console: Help → Toggle Developer Tools → Console tab
2. Look for `ArgoTemplateDefinitionProvider` and `TemplateSearchService` logs
3. Messages show what the extension is detecting and searching for
