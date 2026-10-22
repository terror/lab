import {
  type AssistantMessage,
  type ChatAssistantMessage,
  type ChatMessage,
  type ChatResponseState,
  type ChatToolPart,
  type ChatToolState,
  type ChatUserMessage,
  type Message,
  type SessionEntry,
  type SessionSnapshot,
  type SessionTask,
  type ToolResultMessage,
  isToolTask,
  readableErrorMessage,
} from '@lab/shared';

type ToolCall = Extract<
  AssistantMessage['content'][number],
  { type: 'toolCall' }
>;

type LiveTool = NonNullable<
  NonNullable<SessionSnapshot['live']>['tools']
>[number];

type Turn = { id: string; user?: ChatUserMessage; entries: SessionEntry[] };

type ToolProjection = {
  result?: ToolResultMessage;
  live?: LiveTool;
  task?: SessionTask;
  active: boolean;
  preparing: boolean;
};

type Projection = {
  snapshot: SessionSnapshot;
  lastAssistantByTask: Map<string, string>;
  toolTasks: Map<string, SessionTask>;
  toolOwners: Map<string, string>;
  liveTools: Map<string, LiveTool>;
};

export function messageText(message: Message | ChatMessage) {
  if ('parts' in message) {
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => part.text)
      .join('');
  }

  if ('text' in message) {
    return message.text;
  }

  if (typeof message.content === 'string') {
    return message.content;
  }

  return message.content
    .filter((part) => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export function sessionMessages(snapshot: SessionSnapshot): ChatMessage[] {
  const projection: Projection = {
    snapshot,
    lastAssistantByTask: new Map(),
    toolTasks: new Map(),
    toolOwners: new Map(),
    liveTools: new Map(
      snapshot.live?.tools?.map((tool) => [tool.callId, tool])
    ),
  };

  for (const entry of snapshot.entries) {
    if (
      entry.byTaskId &&
      entry.model?.some((message) => message.role === 'assistant')
    ) {
      projection.lastAssistantByTask.set(entry.byTaskId, entry.id);
    }
  }

  for (const task of snapshot.tasks) {
    if (isToolTask(task)) {
      projection.toolTasks.set(
        `${task.input.assistant}:${task.input.callId}`,
        task
      );
      projection.toolOwners.set(task.id, String(task.input.assistant));
    }
  }

  const turns = groupTurns(snapshot.entries);

  return turns.flatMap((turn, index) =>
    projectTurn(
      turn,
      projection,
      index === turns.length - 1 && snapshot.live?.run !== undefined
    )
  );
}

function groupTurns(entries: SessionEntry[]) {
  const turns: Turn[] = [];

  for (const entry of entries) {
    const user =
      entry.kind === 'pi.user'
        ? entry.model?.find((message) => message.role === 'user')
        : undefined;

    if (user) {
      turns.push({
        id: entry.id,
        user: { id: entry.id, role: 'user', text: messageText(user) },
        entries: [],
      });
      continue;
    }

    const turn = turns.at(-1);

    if (turn) {
      turn.entries.push(entry);
    } else {
      turns.push({ id: 'history', entries: [entry] });
    }
  }

  return turns;
}

function projectTurn(
  turn: Turn,
  projection: Projection,
  active: boolean
): ChatMessage[] {
  const assistant: ChatAssistantMessage = {
    id: `assistant:${turn.id}`,
    role: 'assistant',
    parts: [],
    state: { status: 'complete' },
  };

  const results = toolResults(turn.entries, projection.toolOwners);

  function append(
    message: AssistantMessage,
    source: string,
    preparing = false
  ) {
    for (const [index, part] of message.content.entries()) {
      switch (part.type) {
        case 'text':
          if (part.text) {
            assistant.parts.push({
              type: 'text',
              id: `${source}:${index}`,
              text: part.text,
            });
          }
          break;
        case 'toolCall':
          if (part.id && part.name) {
            assistant.parts.push(
              projectTool(part, source, {
                result: results.get(`${source}:${part.id}`),
                live: active ? projection.liveTools.get(part.id) : undefined,
                task: projection.toolTasks.get(`${source}:${part.id}`),
                active,
                preparing,
              })
            );
          }
          break;
        case 'thinking':
          break;
      }
    }

    if (!preparing) {
      assistant.state = responseState(message);
    }
  }

  for (const entry of turn.entries) {
    for (const message of entry.model ?? []) {
      if (message.role === 'assistant') {
        if (replacedAttempt(entry, message, projection)) {
          continue;
        }

        append(message, entry.id);
      }
    }
  }

  if (active) {
    const generation = projection.snapshot.live?.generation;

    if (generation?.message) {
      append(
        generation.message,
        `live:${projection.snapshot.live?.run?.taskId}:${generation.attempt}`,
        true
      );
    }

    assistant.state = generation?.retry
      ? { status: 'retrying' }
      : { status: 'running' };
  } else if (
    turn.user &&
    !assistant.parts.length &&
    assistant.state.status === 'complete'
  ) {
    assistant.state = {
      status: 'error',
      message: 'No response was returned. Please try again.',
    };
  }

  if (turn.user) {
    return [turn.user, assistant];
  }

  if (assistant.parts.length || assistant.state.status !== 'complete') {
    return [assistant];
  }

  return [];
}

function replacedAttempt(
  entry: SessionEntry,
  message: AssistantMessage,
  projection: Projection
) {
  switch (message.stopReason) {
    case 'error':
    case 'aborted':
      if (!entry.byTaskId) {
        return false;
      }

      if (projection.lastAssistantByTask.get(entry.byTaskId) !== entry.id) {
        return true;
      }

      return (
        String(projection.snapshot.live?.run?.taskId) === entry.byTaskId &&
        projection.snapshot.live?.generation !== undefined
      );
    default:
      return false;
  }
}

function responseState(message: AssistantMessage): ChatResponseState {
  switch (message.stopReason) {
    case 'error':
      return {
        status: 'error',
        message: readableErrorMessage(
          message.errorMessage || 'The model could not finish this response.'
        ),
      };
    case 'aborted':
      return { status: 'stopped' };
    case 'pending':
    case 'deferred':
    case 'stop':
    case 'length':
    case 'toolUse':
      return { status: 'complete' };
  }
}

function toolResults(entries: SessionEntry[], owners: Map<string, string>) {
  const results = new Map<string, ToolResultMessage>();
  const sources = new Map<string, string>();

  for (const entry of entries) {
    for (const message of entry.model ?? []) {
      switch (message.role) {
        case 'assistant':
          for (const part of message.content) {
            if (part.type === 'toolCall') {
              sources.set(part.id, entry.id);
            }
          }
          break;
        case 'toolResult': {
          const source =
            owners.get(entry.byTaskId ?? '') ?? sources.get(message.toolCallId);

          if (source !== undefined) {
            results.set(`${source}:${message.toolCallId}`, message);
          }
          break;
        }
        case 'user':
          break;
      }
    }
  }

  return results;
}

function projectTool(
  call: ToolCall,
  source: string,
  state: ToolProjection
): ChatToolPart {
  return {
    type: 'tool',
    id: `${source}:tool:${call.id}`,
    name: call.name,
    input: call.arguments,
    ...toolState(state),
  };
}

function toolState({
  result,
  live,
  task,
  active,
  preparing,
}: ToolProjection): ChatToolState {
  if (result) {
    if (result.isError) {
      return {
        status: 'error',
        message: readableErrorMessage(
          messageText(result) || 'The tool could not finish.'
        ),
      };
    }

    return {
      status: 'complete',
      output: { text: messageText(result), details: result.details },
    };
  }

  if (preparing) {
    return { status: 'preparing' };
  }

  if (!active || task?.status === 'terminal' || live?.status === 'done') {
    return {
      status: 'error',
      message: 'The tool stopped before returning a result.',
    };
  }

  if (live?.output !== undefined || live?.details !== undefined) {
    return {
      status: 'running',
      output: { text: live.output ?? '', details: live.details },
    };
  }

  return { status: 'running' };
}
