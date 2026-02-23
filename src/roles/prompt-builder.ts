import type { RoleDefinition } from './types.ts';

export type PromptContext = {
  userName?: string;
  currentTime?: string;
  activeCommitments?: string[];
  recentObservations?: string[];
  agentHierarchy?: string;
};

/**
 * Build a full system prompt from a role definition and context
 */
export function buildSystemPrompt(role: RoleDefinition, context?: PromptContext): string {
  const sections: string[] = [];

  // Identity
  sections.push('# Identity');
  sections.push(`You are ${role.name}. ${role.description}`);
  sections.push('');

  // Responsibilities
  sections.push('# Responsibilities');
  for (const responsibility of role.responsibilities) {
    sections.push(`- ${responsibility}`);
  }
  sections.push('');

  // Autonomous Actions
  sections.push('# Autonomous Actions (do without asking)');
  if (role.autonomous_actions.length > 0) {
    for (const action of role.autonomous_actions) {
      sections.push(`- ${action}`);
    }
  } else {
    sections.push('- None. Always ask for permission before taking any action.');
  }
  sections.push('');

  // Approval Required
  sections.push('# Approval Required (always ask first)');
  if (role.approval_required.length > 0) {
    for (const action of role.approval_required) {
      sections.push(`- ${action}`);
    }
  } else {
    sections.push('- N/A');
  }
  sections.push('');

  // Communication Style
  sections.push('# Communication Style');
  sections.push(`Tone: ${role.communication_style.tone}.`);
  sections.push(`Verbosity: ${role.communication_style.verbosity}.`);
  sections.push(`Formality: ${role.communication_style.formality}.`);
  sections.push('');

  // KPIs
  sections.push('# Key Performance Indicators (KPIs)');
  if (role.kpis.length > 0) {
    sections.push('| KPI | Metric | Target | Check Interval |');
    sections.push('|-----|--------|--------|----------------|');
    for (const kpi of role.kpis) {
      sections.push(`| ${kpi.name} | ${kpi.metric} | ${kpi.target} | ${kpi.check_interval} |`);
    }
  } else {
    sections.push('- No specific KPIs defined.');
  }
  sections.push('');

  // Heartbeat Instructions
  sections.push('# Heartbeat Instructions');
  sections.push(role.heartbeat_instructions);
  sections.push('');

  // Available Tools
  sections.push('# Available Tools');
  if (role.tools.length > 0) {
    for (const tool of role.tools) {
      sections.push(`- ${tool}`);
    }
  } else {
    sections.push('- No tools assigned.');
  }
  sections.push('');

  // Sub-roles (if any)
  if (role.sub_roles.length > 0) {
    sections.push('# Sub-Roles You Can Spawn');
    for (const subRole of role.sub_roles) {
      sections.push(`- **${subRole.name}** (${subRole.role_id}): ${subRole.description}`);
      sections.push(`  - Reports to: ${subRole.reports_to}`);
      sections.push(`  - Max budget per task: ${subRole.max_budget_per_task}`);
    }
    sections.push('');
  }

  // Authority Level
  sections.push('# Authority Level');
  sections.push(`Your authority level is ${role.authority_level}/10.`);
  sections.push('This determines which actions you can perform autonomously.');
  sections.push('');

  // Current Context
  if (context) {
    sections.push('# Current Context');

    if (context.userName) {
      sections.push(`User: ${context.userName}`);
    }

    if (context.currentTime) {
      sections.push(`Time: ${context.currentTime}`);
    }

    if (context.agentHierarchy) {
      sections.push('');
      sections.push('## Agent Hierarchy');
      sections.push(context.agentHierarchy);
    }

    if (context.activeCommitments && context.activeCommitments.length > 0) {
      sections.push('');
      sections.push('## Active Commitments');
      for (const commitment of context.activeCommitments) {
        sections.push(`- ${commitment}`);
      }
    }

    if (context.recentObservations && context.recentObservations.length > 0) {
      sections.push('');
      sections.push('## Recent Activity');
      for (const observation of context.recentObservations) {
        sections.push(`- ${observation}`);
      }
    }

    sections.push('');
  }

  return sections.join('\n');
}
