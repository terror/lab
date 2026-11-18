import { ErrorMessage } from '@/components/error-message';
import { ToolConversation } from '@/components/tools';
import { Checkbox } from '@/components/ui/checkbox';
import { editPlan } from '@/lib/conversations';
import { cn } from '@/lib/utils';
import { PLAN_LIMIT, type PlanStep, STEP_LENGTH } from '@lab/server/schemas';
import { useMutation } from '@tanstack/react-query';
import {
  ArrowDown,
  ArrowUp,
  LoaderCircle,
  Pencil,
  Plus,
  X,
} from 'lucide-react';
import {
  type KeyboardEvent,
  type SubmitEvent,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

const action =
  'flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40';

const field =
  'h-7 min-w-0 flex-1 rounded-md bg-transparent px-1.5 text-sm outline-none placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring/50';

function keys(steps: readonly PlanStep[]) {
  const seen = new Map<string, number>();

  return steps.map(({ text }) => {
    const count = seen.get(text) ?? 0;

    seen.set(text, count + 1);

    return `${count}:${text}`;
  });
}

function swapped(steps: readonly PlanStep[], index: number, other: number) {
  const step = steps[index];
  const neighbor = steps[other];

  if (!step || !neighbor) {
    return [...steps];
  }

  return steps.with(index, neighbor).with(other, step);
}

function StepText({
  label,
  onDone,
  text,
}: {
  label: string;
  onDone: (text: string) => void;
  text: string;
}) {
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.currentTarget.value = text;
    }

    if (event.key === 'Enter' || event.key === 'Escape') {
      event.preventDefault();
      event.currentTarget.blur();
    }
  };

  return (
    <input
      aria-label={label}
      className={cn(field, '-ml-1.5')}
      defaultValue={text}
      maxLength={STEP_LENGTH}
      onBlur={(event) => onDone(event.currentTarget.value.trim())}
      onKeyDown={onKeyDown}
      ref={input}
    />
  );
}

function Step({
  editable,
  first,
  last,
  onChange,
  onMove,
  onRemove,
  step,
}: {
  editable: boolean;
  first: boolean;
  last: boolean;
  onChange: (step: PlanStep) => void;
  onMove: (offset: number) => void;
  onRemove: () => void;
  step: PlanStep;
}) {
  const [editing, setEditing] = useState(false);

  const id = useId();

  const done = step.status === 'done';

  const finish = (text: string) => {
    setEditing(false);

    if (text && text !== step.text) {
      onChange({ ...step, text });
    }
  };

  return (
    <li className='group/step flex min-h-8 items-center gap-2.5 text-sm'>
      <Checkbox
        checked={done}
        disabled={!editable}
        id={id}
        onCheckedChange={() =>
          onChange({ ...step, status: done ? 'pending' : 'done' })
        }
      />
      {editing ? (
        <StepText
          label={`Edit “${step.text}”`}
          onDone={finish}
          text={step.text}
        />
      ) : (
        <label
          className={cn(
            'min-w-0 flex-1 wrap-break-word',
            done && 'text-muted-foreground line-through'
          )}
          htmlFor={id}
        >
          {step.text}
          {step.status === 'active' && (
            <span className='sr-only'> (in progress)</span>
          )}
        </label>
      )}
      {step.status === 'active' && (
        <LoaderCircle
          aria-hidden='true'
          className='size-3.5 shrink-0 text-muted-foreground motion-safe:animate-spin'
        />
      )}
      {editable && !editing && (
        <div className='flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/step:opacity-100 group-hover/step:opacity-100 pointer-coarse:opacity-100'>
          <button
            aria-label={`Edit “${step.text}”`}
            className={action}
            onClick={() => setEditing(true)}
            type='button'
          >
            <Pencil aria-hidden='true' className='size-3.5' />
          </button>
          <button
            aria-label={`Move “${step.text}” up`}
            className={action}
            disabled={first}
            onClick={() => onMove(-1)}
            type='button'
          >
            <ArrowUp aria-hidden='true' className='size-3.5' />
          </button>
          <button
            aria-label={`Move “${step.text}” down`}
            className={action}
            disabled={last}
            onClick={() => onMove(1)}
            type='button'
          >
            <ArrowDown aria-hidden='true' className='size-3.5' />
          </button>
          <button
            aria-label={`Remove “${step.text}”`}
            className={action}
            onClick={onRemove}
            type='button'
          >
            <X aria-hidden='true' className='size-3.5' />
          </button>
        </div>
      )}
    </li>
  );
}

function AddStep({ onAdd }: { onAdd: (text: string) => void }) {
  const [text, setText] = useState('');

  const onSubmit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (text.trim()) {
      onAdd(text.trim());
      setText('');
    }
  };

  return (
    <form className='flex min-h-8 items-center gap-2.5' onSubmit={onSubmit}>
      <Plus
        aria-hidden='true'
        className='size-4 shrink-0 text-muted-foreground'
      />
      <input
        aria-label='Add a step'
        autoComplete='off'
        className={cn(field, '-ml-1.5')}
        data-1p-ignore
        maxLength={STEP_LENGTH}
        onChange={(event) => setText(event.target.value)}
        placeholder='Add a step'
        value={text}
      />
    </form>
  );
}

type Pending = { base: readonly PlanStep[]; steps: PlanStep[] };

export function Plan({
  editable,
  steps,
}: {
  editable: boolean;
  steps: readonly PlanStep[];
}) {
  const conversationId = useContext(ToolConversation);

  const [pending, setPending] = useState<Pending>();

  const save = useMutation({
    meta: { inlineError: true },
    mutationFn: (next: PlanStep[]) => editPlan(conversationId ?? 0, next),
    onError: () => setPending(undefined),
  });

  const shown = pending?.base === steps ? pending.steps : steps;

  const change = (next: PlanStep[]) => {
    setPending({ base: steps, steps: next });
    save.mutate(next);
  };

  const heading = useId();

  const done = shown.filter(({ status }) => status === 'done').length;

  const stepKeys = keys(shown);

  return (
    <section
      aria-labelledby={heading}
      className='flex flex-col gap-1 rounded-2xl border px-4 py-3'
    >
      <div className='flex items-baseline justify-between gap-3'>
        <h3 className='text-sm font-medium' id={heading}>
          Plan
        </h3>
        <span className='text-xs text-muted-foreground tabular-nums'>
          {done} of {shown.length} done
        </span>
      </div>
      <ol className='flex flex-col'>
        {shown.map((step, index) => (
          <Step
            key={stepKeys[index]}
            editable={editable}
            first={index === 0}
            last={index === shown.length - 1}
            onChange={(next) => change(shown.with(index, next))}
            onMove={(offset) => change(swapped(shown, index, index + offset))}
            onRemove={() => change(shown.toSpliced(index, 1))}
            step={step}
          />
        ))}
      </ol>
      {editable && shown.length < PLAN_LIMIT && (
        <AddStep
          onAdd={(text) => change([...shown, { status: 'pending', text }])}
        />
      )}
      {save.error && <ErrorMessage>{save.error.message}</ErrorMessage>}
    </section>
  );
}
