#!/bin/bash
set -e

AGENT="claude"

# Parse agent flag
if [[ "$1" == "--codex" ]]; then
  AGENT="codex"
  shift
elif [[ "$1" == "--claude" ]]; then
  shift
fi

if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 [--claude|--codex] <plan-name> <iterations> [custom-prompt]"
  exit 1
fi

PLAN_INPUT="$1"
ITERATIONS="$2"
CUSTOM_PROMPT="$3"

# Strip .plans/ prefix and .md extension if provided
PLAN_NAME="${PLAN_INPUT#.plans/}"
PLAN_NAME="${PLAN_NAME%.md}"

PLAN_FILE=".plans/${PLAN_NAME}.md"
PROGRESS_FILE=".plans/${PLAN_NAME}_progress.txt"

if [ ! -f "$PLAN_FILE" ]; then
  echo "Error: Plan file not found: $PLAN_FILE"
  exit 1
fi

# Create progress file if it doesn't exist
if [ ! -f "$PROGRESS_FILE" ]; then
  echo "# Progress for ${PLAN_NAME}" > "$PROGRESS_FILE"
  echo "# Started: $(date)" >> "$PROGRESS_FILE"
  echo "" >> "$PROGRESS_FILE"
fi

echo "Plan: $PLAN_FILE | Agent: $AGENT | Iterations: $ITERATIONS"
[ -n "$CUSTOM_PROMPT" ] && echo "Custom: $CUSTOM_PROMPT"
echo ""

INSTRUCTIONS="
1. Find the highest-priority task and implement it.
2. Validate, run your tests and type checks.
3. Append your progress to ${PROGRESS_FILE}. Keep progress file concise and high-level, mention changes at a file level only, how you would update colleagues on your progress. Do not spell-out code - that's what commits are for.
4. If you discovered findings neccessitating changes in the plan are needed, update the plan itself
5. Commit your changes. If plan and progress document are gitignored, that is by design, do not force them.

ONLY WORK ON A SINGLE TASK/PHASE from the plan.

6. Last 3 tasks in the plan should always be equivalent to (see below). If the plan lacked these tasks, add them to the plan explicitly.
  - ## Code review and Self quality control of (squashed) changes. Conduct a code review and document findings and recommendations for cleanup or refactoring. Only review and document, do not fix.
  - ## Work through the findings from the previous task and resolve them. Rerun the tests. 
  - ## Review the solution end-to-end and make sure there is nothing else you wanted to improve and cleanup in terms of the code quality and conciseness, but do not add more features or introduce scope creep. Smaller PR is better.  

If the plan delivery is complete, including these final self-review and remediation tasks, output <promise>COMPLETE</promise>. "

if [ -n "$CUSTOM_PROMPT" ]; then
  FULL_PROMPT="ADDITIONAL INSTRUCTIONS: ${CUSTOM_PROMPT}

@${PLAN_FILE} @${PROGRESS_FILE}

${INSTRUCTIONS}"
else
  FULL_PROMPT="@${PLAN_FILE} @${PROGRESS_FILE}

${INSTRUCTIONS}"
fi

for ((i=1; i<=$ITERATIONS; i++)); do
  echo "=== Iteration $i of $ITERATIONS ==="

  if [ "$AGENT" = "claude" ]; then
    result=$(claude --dangerously-skip-permissions -p "$FULL_PROMPT")
  else
    result=$(codex --dangerously-bypass-approvals-and-sandbox "$FULL_PROMPT")
  fi

  echo "$result"

  if [[ "$result" == *"<promise>COMPLETE</promise>"* ]]; then
    echo ""
    echo "Plan complete after $i iterations."
    exit 0
  fi
done

echo ""
echo "Reached maximum iterations ($ITERATIONS). Plan may not be complete."
