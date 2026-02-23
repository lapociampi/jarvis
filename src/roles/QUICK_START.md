# Role Engine - Quick Start Guide

## Installation

The Role Engine is already installed as part of J.A.R.V.I.S. No additional dependencies needed beyond the existing `yaml` package.

## Basic Usage

### 1. Import the Role Engine

```typescript
import {
  loadRolesFromDir,
  buildSystemPrompt,
  canPerform,
} from '/home/vierisid/jarvis/src/roles/index.ts';
```

### 2. Load Roles

```typescript
// Load all roles from config directory
const roles = loadRolesFromDir('/home/vierisid/jarvis/config/roles');

// Get a specific role
const execRole = roles.get('executive_assistant');
```

### 3. Generate System Prompt

```typescript
const prompt = buildSystemPrompt(execRole, {
  userName: 'John Doe',
  currentTime: new Date().toLocaleString(),
  activeCommitments: ['Task 1', 'Task 2'],
  recentObservations: ['User prefers morning meetings'],
});

// Use prompt with LLM
```

### 4. Check Permissions

```typescript
// Check if role can perform an action
if (canPerform(execRole, 'execute_command')) {
  // Execute command
}

// Get full permission list
const summary = getRolePermissionsSummary(execRole);
console.log('Allowed:', summary.allowed);
console.log('Denied:', summary.denied);
```

## Creating a New Role

Create a YAML file in `/home/vierisid/jarvis/config/roles/`:

```yaml
id: my_role
name: My Role
description: What this role does

responsibilities:
  - First responsibility
  - Second responsibility

autonomous_actions:
  - Actions without approval

approval_required:
  - Actions needing approval

kpis:
  - name: KPI Name
    metric: What to measure
    target: Target value
    check_interval: How often

communication_style:
  tone: Friendly and helpful
  verbosity: adaptive
  formality: casual

heartbeat_instructions: |
  What to check periodically

sub_roles: []

tools:
  - tool1
  - tool2

authority_level: 5  # 1-10
```

## Authority Levels Quick Reference

| Level | Can Do |
|-------|--------|
| 1-2   | Read data only |
| 3-4   | Read, write, send messages |
| 5-6   | + Execute commands, control apps |
| 7-8   | + Spawn agents, send email, install software |
| 9-10  | + Make payments, modify settings, delete data |

## Running Tests

```bash
# Test basic functionality
bun run /home/vierisid/jarvis/src/roles/test.ts

# Test multi-role loading
bun run /home/vierisid/jarvis/src/roles/test-multi.ts

# Test utility functions
bun run /home/vierisid/jarvis/src/roles/test-utils.ts

# See complete example
bun run /home/vierisid/jarvis/src/roles/example-usage.ts
```

## Common Patterns

### Find Least Privileged Role for Action

```typescript
import { findMinimalRoleForAction } from './roles/index.ts';

const role = findMinimalRoleForAction(roles, 'execute_command');
// Returns role with lowest authority that can execute commands
```

### Compare Two Roles

```typescript
import { compareRoles } from './roles/index.ts';

const diff = compareRoles(role1, role2);
console.log('Only in role1:', diff.onlyInRole1);
console.log('Only in role2:', diff.onlyInRole2);
console.log('In both:', diff.inBoth);
```

### Validate Role Hierarchy

```typescript
import { validateRoleHierarchy } from './roles/index.ts';

const validation = validateRoleHierarchy(roles);
if (!validation.valid) {
  console.error('Errors:', validation.errors);
}
```

### Get Statistics

```typescript
import { getRoleStats } from './roles/index.ts';

const stats = getRoleStats(roles);
console.log(`Total roles: ${stats.totalRoles}`);
console.log(`Average authority: ${stats.averageAuthorityLevel}`);
```

## Example Roles

Four example roles are provided in `/home/vierisid/jarvis/config/roles/`:

1. **executive-assistant.yaml** (Level 6)
   - Schedule, email, task management
   - Can execute commands and control apps

2. **research-specialist.yaml** (Level 4)
   - Research and report generation
   - Read/write with messaging

3. **system-admin.yaml** (Level 9)
   - System maintenance and security
   - Full access to all operations

4. **activity-observer.yaml** (Level 2)
   - Passive monitoring
   - Read-only access

## File Locations

**Core Implementation**:
- `/home/vierisid/jarvis/src/roles/*.ts`

**Role Configurations**:
- `/home/vierisid/jarvis/config/roles/*.yaml`

**Documentation**:
- `/home/vierisid/jarvis/src/roles/README.md` - Full documentation
- `/home/vierisid/jarvis/src/roles/IMPLEMENTATION.md` - Implementation details
- `/home/vierisid/jarvis/src/roles/QUICK_START.md` - This file

## Need Help?

1. Check `README.md` for detailed documentation
2. Run `example-usage.ts` for a complete integration example
3. Look at existing role YAML files in `config/roles/`
4. Run tests to see expected behavior

## Next Steps

1. Create your own role in `config/roles/`
2. Load it with `loadRolesFromDir()`
3. Generate system prompts with `buildSystemPrompt()`
4. Check permissions with `canPerform()`
5. Integrate with your agent system
