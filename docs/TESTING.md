# Testing Guide for Go to Definition and Find All References Features

This guide explains how to test both the "Go to Definition" and "Find All References" functionality for Argo WorkflowTemplate references.

## Quick Test

1. **Launch the Extension**:
   - Open VS Code in this project folder
   - Press `F5` to launch the Extension Development Host
   - In the new window, open the `test-files` folder

2. **Test Go to Definition**:
   - Open `workflow.yaml`
   - Find line 13: `template: step1`
   - Hold `Ctrl` and click on `step1`
   - **Expected**: Navigate to `tem1.yaml` line 7 (`- name: step1`)

3. **Test Find All References**:
   - Open `tem1.yaml`
   - Find line 7: `- name: step1`
   - Hold `Ctrl` and click on `step1`
   - **Expected**: Show references panel with all places where `step1` from `tem-tem1` is used

## Comprehensive Test Cases

### Test Case 1: Basic Template Navigation (Go to Definition)
**File**: `workflow.yaml`
- `Ctrl+Click` on `tem-tem1` (line 12) should go to `tem1.yaml` line 4 (WorkflowTemplate name)
- `Ctrl+Click` on `step1` (line 13) should go to `tem1.yaml` line 7 (template definition)

### Test Case 2: Find All References
**File**: `tem1.yaml`
- `Ctrl+Click` on `step1` (line 7) should show references in:
  - `workflow.yaml` line 13
  - `cronworkflow.yaml` line 13
  - `composite-template.yaml` line 8 and line 19
- `Ctrl+Click` on `step2` (line 12) should show references in:
  - `cronworkflow.yaml` line 17
  - `composite-template.yaml` line 23

### Test Case 3: Disambiguating Same Template Names
**File**: `complex-workflow.yaml`
- `Ctrl+Click` on `step1` at line 14 should go to `multiple-templates.yaml` line 7 (template-a step1)
- `Ctrl+Click` on `step1` at line 19 should go to `multiple-templates.yaml` line 21 (template-b step1)

**File**: `multiple-templates.yaml`
- `Ctrl+Click` on `step1` at line 7 should show references only to template-a step1
- `Ctrl+Click` on `step1` at line 21 should show references only to template-b step1

This demonstrates that the extension correctly uses the `templateRef.name` to find the right WorkflowTemplate before locating the template.

### Test Case 3: Multiple Templates with Same Name
**File**: `complex-workflow.yaml`
- `Ctrl+Click` on `common-step` at line 21 should go to template-a common-step
- `Ctrl+Click` on `common-step` at line 26 should go to template-b common-step

## How It Works

The extension follows this logic:

1. **Detect Context**: When you click on a template name, it checks if you're in a `templateRef` block
2. **Find WorkflowTemplate**: It looks backward for the `templateRef.name` to identify which WorkflowTemplate is being referenced
3. **Locate Template**: It searches for that specific WorkflowTemplate and finds the template with the matching name
4. **Navigate**: It jumps to the exact line where the template is defined

## File Structure for Testing

```
test-files/
├── tem1.yaml                    # Simple WorkflowTemplate with step1, step2
├── workflow.yaml                # Simple workflow referencing tem1
├── multiple-templates.yaml      # Two WorkflowTemplates with overlapping template names
├── complex-workflow.yaml        # Complex workflow demonstrating disambiguation
├── other-template.yaml          # Additional WorkflowTemplate
└── test-workflow.yaml           # Additional test cases
```

## Expected Behavior

**Correct**: When clicking on `step1` in different `templateRef` blocks, navigate to the correct template based on the `templateRef.name`

**Incorrect**: Navigate to the first `step1` found, regardless of which WorkflowTemplate should be referenced

## Troubleshooting

If the extension isn't working:

1. Confirm the extension is installed and enabled in the Extension Development Host
2. Ensure you're clicking exactly on the template name, not surrounding whitespace
3. Verify the YAML structure is correct (proper indentation)
4. Check VS Code's Output panel for any error messages
