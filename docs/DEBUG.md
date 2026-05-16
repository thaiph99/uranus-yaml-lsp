# Debug Guide for Ctrl+Click Navigation

## How Ctrl+Click Works Now

The extension now uses **Ctrl+Click** for smart navigation based on context:

### Context 1: Template Reference to Go to Definition
**When**: Ctrl+Click on template references in usage files
**Action**: Navigate to template definition

```yaml
# In workflow.yaml - Ctrl+Click on "step1":
templateRef:
  name: tem-tem1
  template: step1  # Ctrl+Click here goes to definition
```

### Context 2: Template Definition to Find All References
**When**: Ctrl+Click on template names in WorkflowTemplate definition files
**Action**: Show all references to this template

```yaml
# In tem1.yaml - Ctrl+Click on "step1":
spec:
  templates:
    - name: step1  # Ctrl+Click here shows all references
      container:
        image: alpine
```

### Context 3: WorkflowTemplate Name Definition to Find All References
**When**: Ctrl+Click on WorkflowTemplate names in metadata section
**Action**: Show all references to this WorkflowTemplate

```yaml
# In tem1.yaml - Ctrl+Click on "tem-tem1":
apiVersion: argoproj.io/v1alpha1
kind: WorkflowTemplate
metadata:
  name: tem-tem1  # Ctrl+Click here shows all WorkflowTemplate references
spec:
  templates:
    - name: step1
```

## Testing Steps

1. **Launch Extension Development Host**:
   ```
   Press F5 in VS Code
   ```

2. **Test Go to Definition**:
   - Open `workflow.yaml`
   - Ctrl+Click on `step1` in `template: step1`
   - Should navigate to `tem1.yaml`

3. **Test Find Template References**:
   - Open `tem1.yaml`
   - Ctrl+Click on `step1` in `- name: step1`
   - Should show references panel with template usage

4. **Test Find WorkflowTemplate References**:
   - Open `tem1.yaml`
   - Ctrl+Click on `tem-tem1` in `name: tem-tem1`
   - Should show references panel with WorkflowTemplate usage

## Expected Results

- **From `workflow.yaml`**: Ctrl+Click navigates to definition
- **From `tem1.yaml` template names**: Ctrl+Click shows template references
- **From `tem1.yaml` WorkflowTemplate name**: Ctrl+Click shows WorkflowTemplate references
- **Smart Context Detection**: Extension automatically detects what you're clicking on
