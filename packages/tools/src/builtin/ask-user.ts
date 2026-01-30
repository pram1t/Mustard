/**
 * AskUserQuestion Tool
 *
 * Allows the agent to ask interactive questions with multiple choice answers.
 * Uses the prompts library for CLI interaction.
 */

import { BaseTool } from '../base.js';
import type { ToolResult, ExecutionContext, ToolParameters } from '../types.js';
import prompts from 'prompts';

/**
 * Question option interface
 */
interface QuestionOption {
  label: string;
  description: string;
}

/**
 * Question interface
 */
interface Question {
  question: string;
  header: string;
  options: QuestionOption[];
  multiSelect: boolean;
}

/**
 * AskUserQuestionTool - Interactive prompts for user input
 */
export class AskUserQuestionTool extends BaseTool {
  readonly name = 'AskUserQuestion';
  readonly description = `Ask the user questions when you need clarification, want to validate assumptions, or need decisions.

Use this to:
- Gather user preferences or requirements
- Clarify ambiguous instructions
- Get decisions on implementation choices
- Offer choices about what direction to take

Features:
- 1-4 questions per call
- 2-4 options per question
- Auto-adds "Other" option for custom input
- Supports multi-select for non-exclusive choices`;

  readonly parameters: ToolParameters = {
    type: 'object',
    properties: {
      questions: {
        type: 'array',
        description: 'Questions to ask the user (1-4 questions)',
        items: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'The complete question to ask (should end with ?)',
            },
            header: {
              type: 'string',
              description: 'Short label/tag (max 12 chars), e.g., "Auth method"',
              maxLength: 12,
            },
            options: {
              type: 'array',
              description: 'Available choices (2-4 options)',
              items: {
                type: 'object',
                properties: {
                  label: {
                    type: 'string',
                    description: 'Display text for the option (1-5 words)',
                  },
                  description: {
                    type: 'string',
                    description: 'Explanation of what this option means',
                  },
                },
                required: ['label', 'description'],
              },
            },
            multiSelect: {
              type: 'boolean',
              description: 'Allow multiple selections (default: false)',
              default: false,
            },
          },
          required: ['question', 'header', 'options', 'multiSelect'],
        },
      },
    },
    required: ['questions'],
  };

  async execute(
    params: Record<string, unknown>,
    context: ExecutionContext
  ): Promise<ToolResult> {
    return this.safeExecute(params, context, async () => {
      const questions = params.questions as Question[];

      // Validate question count
      if (questions.length < 1 || questions.length > 4) {
        return this.failure('Must provide 1-4 questions');
      }

      // Validate each question
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];
        if (!q.options || q.options.length < 2 || q.options.length > 4) {
          return this.failure(
            `Question ${i + 1} must have 2-4 options (has ${q.options?.length || 0})`
          );
        }
        if (q.header && q.header.length > 12) {
          return this.failure(
            `Question ${i + 1} header must be max 12 characters (has ${q.header.length})`
          );
        }
      }

      const answers: Record<string, string | string[]> = {};

      // Ask each question
      for (let i = 0; i < questions.length; i++) {
        const q = questions[i];

        // Build choices with descriptions
        const choices = q.options.map((opt, idx) => ({
          title: opt.label,
          description: opt.description,
          value: opt.label,
        }));

        // Add "Other" option
        choices.push({
          title: 'Other',
          description: 'Provide a custom answer',
          value: '__OTHER__',
        });

        console.log(`\n[${q.header}]`);

        if (q.multiSelect) {
          // Multi-select
          const response = await prompts({
            type: 'multiselect',
            name: 'value',
            message: q.question,
            choices,
            hint: '- Space to select. Return to submit',
            instructions: false,
          });

          if (response.value === undefined) {
            return this.failure('User cancelled the prompt');
          }

          let selectedValues = response.value as string[];

          // Handle "Other" selection
          if (selectedValues.includes('__OTHER__')) {
            const otherResponse = await prompts({
              type: 'text',
              name: 'value',
              message: 'Please specify:',
            });

            if (otherResponse.value) {
              selectedValues = selectedValues.filter(v => v !== '__OTHER__');
              selectedValues.push(otherResponse.value);
            }
          }

          answers[q.header] = selectedValues;
        } else {
          // Single select
          const response = await prompts({
            type: 'select',
            name: 'value',
            message: q.question,
            choices,
          });

          if (response.value === undefined) {
            return this.failure('User cancelled the prompt');
          }

          let selectedValue = response.value as string;

          // Handle "Other" selection
          if (selectedValue === '__OTHER__') {
            const otherResponse = await prompts({
              type: 'text',
              name: 'value',
              message: 'Please specify:',
            });

            if (otherResponse.value) {
              selectedValue = otherResponse.value;
            }
          }

          answers[q.header] = selectedValue;
        }
      }

      // Format output
      let output = 'User responses:\n\n';
      for (const [header, answer] of Object.entries(answers)) {
        if (Array.isArray(answer)) {
          output += `**${header}**: ${answer.join(', ')}\n`;
        } else {
          output += `**${header}**: ${answer}\n`;
        }
      }

      return this.success(output, { answers });
    });
  }
}
